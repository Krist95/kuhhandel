# Kuhhandel Online – Development Spec

A private, browser-based version of the board game Kuhhandel (Cow Trading) for 3–5 friends, played on phones in landscape mode, hosted for free on Cloudflare.

This document is the single source of truth for the build. Where something is not specified, prefer the simplest behavior consistent with these rules, and flag it.

---

## 1. Overview

- **Players:** 3–5, all friends, English UI only.
- **Device:** mobile phones, **landscape only**, installed as a **PWA** (full screen from the home screen).
- **Hosting:** Cloudflare free plan (Workers + static assets + one Durable Object). No other services, no database, no accounts.
- **Rooms:** only **one room exists at a time** on the whole site.
- **Authority:** the server enforces every rule. Browsers only display state and send intents.
- **Artwork:** original, created for this project (see section 10). Do not use Ravensburger artwork.

---

## 2. Architecture

### 2.1 Components

| Component | Responsibility |
|---|---|
| **Worker** (`src/worker.ts`) | Serves the static frontend. Routes `GET /ws` WebSocket upgrades to the GameRoom. |
| **GameRoom Durable Object** (`src/room.ts`) | The single room. Holds all state, accepts WebSocket connections, validates messages via the rules engine, persists state, broadcasts per-player views, runs timers via alarms. |
| **Rules engine** (`src/rules/`) | Pure TypeScript, no I/O. `(state, action, now) -> { state, events }`. Fully unit-tested. |
| **Frontend** (`web/`) | Lightweight TypeScript app (vanilla TS or Preact, built with Vite) rendering lobby and table. PWA manifest + service worker. |

### 2.2 Platform details

- Use a **SQLite-backed Durable Object** (the only type allowed on the Workers Free plan).
- Always address the same instance: `env.GAME_ROOM.idFromName("main")`.
- Use the **WebSocket Hibernation API** (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`) so an idle room costs no compute.
- Persist the full room state in Durable Object storage after every accepted change, so it survives eviction/restarts.
- Use **one Durable Object alarm** for all timing: store the next deadline in state and set the alarm to the earliest of: current decision deadline, host-transfer check, room-closing deadline, bluff-reveal end.
- Deploy with Wrangler (`npx wrangler deploy`), or connect the GitHub repo for automatic deploys.

### 2.3 Identity

- On first visit, the browser generates a random `clientToken` (UUID v4) and stores it in `localStorage`.
- Every WebSocket connection starts with a `hello` message carrying the token.
- A player is bound to a token. Reconnecting with the same token restores the seat and the current view.
- Tokens are secrets: never send one player's token to another client.

### 2.4 Hidden information

The server sends **each player their own view** (section 8.3). Hidden values must never reach a client that is not allowed to see them, including through the game log.

---

## 3. Room lifecycle

States: `EMPTY → LOBBY → PLAYING (⇄ PAUSED) → FINISHED → EMPTY`

### 3.1 Create room

- Homepage shows two buttons: **Create room** and **Join room**.
- Create form: room name, password, player name, seat (1–5).
- If a room already exists, creation is refused with: "A room is already in use. Ask the host for the room ID and password."
- On success:
  - Generate a 6-character **room ID** from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no confusable characters).
  - Store the password **hashed** (PBKDF2 via Web Crypto, random salt). Never store or send it in plain text.
  - The creator becomes **host** and is seated.
- The host's lobby shows the room ID and password with a copy/share button.

### 3.2 Join room

- Join form: room ID, password, player name, seat.
- Any mismatch returns the same generic error: "Room not found or wrong password."
- Rate-limit: max 5 failed join attempts per connection per minute.
- Joining is only possible in `LOBBY`. Once the game has started, new players are refused ("This game has already started").
- **Seated players can always reconnect**, in any state, via their token.

### 3.3 Host

- The creator is host.
- If the host is disconnected for **2 minutes** while other players are connected, host status passes to the next connected seated player in seat order (clockwise from the old host). Applies in every state, including `PAUSED`.

### 3.4 Closing the room

The room returns to `EMPTY` (all state deleted, all clients sent back to the homepage) when any of these happens:

1. **Host closes it** – "Close room" button, host only, available in every state (with a confirm dialog).
2. **Game finished** – 5 minutes after the end screen appears, unless the host starts a new game (Play again) or closes it sooner.
3. **Nobody connected** – no player connected for **10 minutes**. Any reconnect cancels this countdown. Applies in every state, including `PAUSED`.

Brief disconnects never close the room.

---

## 4. Lobby

- 5 seats around a table. A player picks a free seat when creating/joining.
- **Names** must be unique, compared case-insensitively after trimming whitespace. Length 1–16 characters.
- Players may **leave their seat** before the game starts (they return to the homepage).
- The host may **remove** any player before the game starts. A removed player's token is blocked from rejoining this room. (A different browser can bypass this; acceptable for a friends' game. The host can close the room and create a new one with a new password.)
- The host sees **Start game** once 3–5 players are seated. Starting with fewer than 3 is impossible.
- On start the room locks to new players.

### 4.1 Settings (host only, visible to all, locked at start)

| Setting | Options | Default |
|---|---|---|
| **Cow trade money** | `swap` – winner takes loser's offer, loser takes winner's offer (official). `loserTakesBoth` – loser keeps own offer and also receives winner's offer. | `swap` |
| **Time per decision** | 10, 20, 30, 60 seconds | 20 |

The chosen settings are shown in the in-game info/rules screen.

---

## 5. Game rules

### 5.1 Components

**Animals** – 10 types, 4 cards each, 40 cards total, shuffled at start:

| Animal | Value |
|---|---|
| Rooster | 10 |
| Goose | 40 |
| Cat | 90 |
| Dog | 160 |
| Sheep | 250 |
| Goat | 350 |
| Donkey | 500 |
| Pig | 650 |
| Cow | 800 |
| Horse | 1000 |

**Money cards** – values 0, 10, 50, 100, 200, 500. Each card has a unique ID so players select specific cards.

**Starting money** – each player: 0, 0, 10, 10, 10, 10, 50 (total 90).

The bank is unlimited (for donkey payouts).

### 5.2 Turn order

- At start, the first player is chosen **at random**.
- Turns then proceed **clockwise in seat order**, skipping players who are out.
- After each auction or cow trade (or skipped/cancelled turn), the turn passes to the next player.

### 5.3 Turn action

On their turn, the active player chooses one:

- **Auction** – only if the deck is not empty.
- **Cow trade** – only if a legal cow trade exists (section 5.5) and the player holds at least one money card.

Special cases:
- Deck empty and the player has **no animals at all** → the player is **out**: all future turns are skipped and they become a spectator (see 5.8).
- Deck empty and the player has animals but **no legal cow trade** (or no money cards) → turn skipped automatically, player stays in the game.

Timeout: auction if the deck is not empty, otherwise the turn is skipped.

### 5.4 Auction

1. **Reveal** the top card of the deck. The active player is the **auctioneer**.
2. **Donkey payout:** if the revealed card is a donkey, every player still in the game first receives one money card from the bank: 1st donkey → 50, 2nd → 100, 3rd → 200, 4th → 500. Then the donkey is auctioned normally.
3. **Bidding:**
   - Bidders are all players in the game except the auctioneer and anyone **excluded** from this card's auction.
   - Bidding is **turn-based**, clockwise, starting with the player after the auctioneer.
   - On a bid turn a player either **raises** to any multiple of 10 above the current top bid (first bid at least 10; any jump allowed, e.g. 10 → 120) or **passes**.
   - **Passing is final** for this auction.
   - Bids may exceed the bidder's actual cash (bluffing is allowed).
   - Timeout on a bid turn = pass.
   - Bidding ends when only one non-passed bidder remains **and** they hold the top bid, or when everyone has passed with no bid. A remaining bidder who has not yet bid still gets their bid turn.
4. **No bids:** the auctioneer takes the animal for free. Turn ends.
5. **Auctioneer decision** (when there is a top bid):
   - **Sell** – the top bidder pays the bid to the auctioneer and takes the animal.
   - **Buy** – the auctioneer pays the bid to the top bidder and keeps the animal. **Only enabled if the auctioneer's total cash ≥ top bid.** Other players never learn whether Buy was available.
   - Timeout = Sell.
6. **Bluff called (Sell only):** before payment, the server checks whether the top bidder's total cash ≥ bid.
   - If not: the bidder's money cards are **revealed to all players** (overlay for 5 seconds + log entry), the bidder is **excluded** from bidding on this card, and the auction **restarts from step 3** for the same card (bids reset to zero, starting again after the auctioneer).
   - Exclusions accumulate if several players bluff on the same card.
   - If nobody bids in a restarted auction, the auctioneer takes the animal for free.
   - Exclusions end when this card's auction ends.

### 5.5 Cow trade

**Legal trade:** the challenger and a target player (in the game) both hold at least one card of the same animal type, and neither holds all four of that type. (Complete sets of four can never be traded.)

1. **Setup (challenger):**
   - Choose the target player and the animal.
   - Choose **1 or 2 animals** – the "2" option exists only if **both** players hold at least two of that animal; otherwise it is 1.
   - Choose a face-down **offer** of money cards from their hand: **at least one card**, zeros allowed.
   - Timeout = trade cancelled, turn passes.
2. **Response (defender):**
   - The defender sees: challenger, animal, number of animals, and **how many cards** were offered (never their values).
   - The defender either puts down **any number of their own money cards** as a counter-offer, or **puts nothing**.
   - Timeout = puts nothing.
3. **Forfeit (defender put nothing):**
   - The challenger wins the animals immediately. No comparison and no reveal.
   - The defender receives **all of the challenger's offered cards** (even if it is just a single 0). They see the values only in their own hand.
4. **Reveal (defender countered):**
   - Offer totals are revealed **only to the two players involved**.
   - Higher total wins the animals.
   - Money, per the **Cow trade money** setting:
     - `swap`: winner receives loser's offer; loser receives winner's offer.
     - `loserTakesBoth`: loser receives both offers; winner receives nothing.
5. **Tie (equal totals):**
   - Both players take back their offers and the trade repeats from step 1's offer (same target, animal, and count), then step 2. Forfeit is possible in a repeat round.
   - After **3 consecutive ties**, there is no 4th round: the **challenger wins** the animals.
6. **What other players see:** who challenged whom, the animal, the number of animals, how many cards each side put down, whether the defender forfeited, and who won. **Never** the values.

### 5.6 Paying

- Applies to auction payments (Sell: bidder → auctioneer; Buy: auctioneer → bidder).
- The **payer chooses** which money cards to hand over. The total must be ≥ the amount.
- **No change** is given. Overpayment goes to the receiver.
- Timeout = automatic payment using the combination with the **smallest total ≥ amount**, breaking ties by fewest cards.
- Public: the bid amount and the number of cards handed over. Private (payer and receiver only): the card values.

### 5.7 End of game and scoring

- The game ends when the deck is empty and **no legal cow trade exists for any player** (in practice, every animal type is a complete set of four in one player's hands).
- Score = (sum of the values of the player's complete sets) × (number of complete sets).
- End screen: final ranking, each player's sets, values, multiplier, and total; winner highlighted.
- **Tiebreak:** if top scores are equal, the player with **more complete sets** wins. Only if both the score and the number of complete sets are equal is it a shared win.
- Host sees **Play again**: restarts with the same seated players and settings, new shuffle, new random first player, and cancels the 5-minute closing countdown.

### 5.8 Out players (spectators)

- Become "out" only when the deck is empty and they hold no animals.
- They remain at the table marked **Out**, see the public board and log, receive no private information about others, and take no actions.

---

## 6. Timers, timeouts, and away players

### 6.1 One timer length

Every decision uses the same **Time per decision** setting.

| Decision | Who | Timeout default |
|---|---|---|
| Choose action | Active player | Auction if deck not empty, else skip turn |
| Bid turn | Current bidder | Pass |
| Sell or buy | Auctioneer | Sell |
| Cow trade setup | Challenger | Cancel trade, turn passes |
| Cow trade response | Defender | Put nothing (forfeit) |
| Payment | Payer | Auto-pay (section 5.6) |

- Timers keep running while a player is disconnected.
- All clients see a countdown for the player the game is waiting on. Countdowns are rendered from the server's deadline timestamp (send server time with each view to correct client clock offset).

### 6.2 Away

- A player who times out on **3 decisions in a row** is marked **Away**.
- An away player's decisions resolve **instantly** with the defaults (no waiting).
- Any action by the player clears Away.

### 6.3 Pause

- Host-only **Pause** button during `PLAYING`.
- While paused: all timers freeze, no game actions are accepted, every player's screen is greyed out with a modal "Game paused by [host]".
- The host's modal has **Resume**. On resume, the game continues where it stopped and the in-progress decision's timer **restarts at full length**.
- Host transfer and the 10-minute nobody-connected rule still apply while paused.

---

## 7. UI

### 7.1 General

- **Landscape only.** In portrait, show a full-screen "Please rotate your phone" overlay.
- **PWA:** manifest with `display: "fullscreen"` (fallback `standalone`), `orientation: "landscape"`, icons, theme color; minimal service worker for installability. iPhone ignores orientation lock and has no true fullscreen API; standalone launch from the home screen removes browser bars.
- **Screen Wake Lock** during play (feature-detected, re-acquired on visibility change).
- **Turn alert:** short vibration (where supported) and a short sound when it becomes the player's turn, bid turn, auctioneer decision, defender response, or payment.
- Designed for small landscape heights (≈ 360–430 px). Thumb-reachable controls on the bottom edge and right side.
- Sizes in relative units; no page scrolling during play.

### 7.2 Screens

1. **Homepage:** Create room / Join room.
2. **Create / Join forms** (section 3).
3. **Lobby:** table with 5 seats, room name, room ID + password with share button (host), settings (editable by host, read-only for others), player list with host-only Remove buttons, Leave seat, Start game (host, 3–5 players), Close room (host).
4. **Game table** (7.3).
5. **End screen** (5.7).
6. **Rules & settings screen:** short rules summary plus the active settings; reachable from an info button during the game.

### 7.3 Game table (poker-style)

Every player sees **themselves at the bottom**. Others are placed clockwise in seat order:

| Players | Positions (clockwise from you) |
|---|---|
| 3 | bottom (you), top-left, top-right |
| 4 | bottom (you), left, top, right |
| 5 | bottom (you), left, top-left, top-right, right |

**Opponent panel (compact):**
- Name, host marker, turn marker, Away / Out / disconnected indicator.
- Number of money cards (never values).
- Animals as small cards with counts, e.g. "Cow ×2"; completed sets highlighted.
- Tapping the animals or the panel opens a **modal** with the full collection as larger cards, grouped by type, completed sets marked. Tap outside to close.

**Center of the table:**
- Deck with cards remaining.
- Donkeys revealed so far / next donkey payout.
- Current auction card, auctioneer name.
- During bidding: top bid and bidder, whose bid turn it is, who has passed, who is excluded.
- During a cow trade: challenger vs defender, animal, count, cards put down by each side.
- Countdown for whoever the game is waiting on.

**Your area (bottom):**
- Your animals in one row (same small cards with counts).
- Compact money summary (e.g. "10×4 · 50×1 · Total 90"). Tapping opens the full money view, which is also the card picker for offers and payments.
- Contextual action buttons:
  - Your turn: **Auction**, **Cow trade** (disabled with a reason when not possible).
  - Bid turn: quick raises **+10 / +50 / +100**, a field for any amount (multiples of 10), **Bid**, **Pass**.
  - Auctioneer: **Sell**, **Buy it** (disabled when unaffordable).
  - Cow trade setup: pick player → animal → 1 or 2 (only when allowed) → cards → **Offer**.
  - Defender: pick cards → **Counter**, or **Put nothing**.
  - Payment: pick cards (running total vs amount owed) → **Pay**.

**Other UI elements:**
- **Game log** (collapsible): e.g. "Anna bought the Horse for 120", "Donkey! Everyone receives 100", "Ben forfeited the Cow trade to Clara". Never includes hidden values.
- **Bluff reveal overlay:** the bluffer's money cards shown to everyone for 5 seconds.
- **Cow trade reveal modal:** shown only to the two players involved, with both offers and the result.
- **Pause overlay:** greyed screen, modal "Game paused by [host]"; host sees Resume.
- **Host menu:** Pause/Resume, Close room.

---

## 8. Message protocol

All messages are JSON: `{ "type": string, ...payload }`.

### 8.1 Client → server

| Type | Payload | Allowed when |
|---|---|---|
| `hello` | `clientToken` | On every connect |
| `createRoom` | `roomName, password, playerName, seat` | `EMPTY` |
| `joinRoom` | `roomId, password, playerName, seat` | `LOBBY` |
| `leaveSeat` | – | `LOBBY` |
| `removePlayer` | `playerId` | `LOBBY`, host |
| `updateSettings` | `moneyRule?, decisionSeconds?` | `LOBBY`, host |
| `startGame` | – | `LOBBY`, host, 3–5 players |
| `chooseAction` | `action: "auction" \| "cowTrade"` | Active player's turn (for `cowTrade`, followed by `cowTradeOffer`) |
| `bid` | `amount` | Your bid turn |
| `pass` | – | Your bid turn |
| `auctioneerDecision` | `decision: "sell" \| "buy"` | Auctioneer decision |
| `pay` | `cardIds[]` | Your payment |
| `cowTradeOffer` | `targetId, animal, count, cardIds[]` | Challenger setup (also for repeat rounds; target/animal/count must match) |
| `cowTradeResponse` | `cardIds[]` (empty = put nothing) | Defender response |
| `pause` / `resume` | – | `PLAYING` / `PAUSED`, host |
| `closeRoom` | – | Any state, host |
| `playAgain` | – | `FINISHED`, host |

The server validates every message (state, sender, ownership of card IDs, amounts). Invalid messages get an `error` reply to the sender only and change nothing.

### 8.2 Server → client

| Type | Payload |
|---|---|
| `view` | Full personalized view (8.3) + `serverTime`. Sent to each client after every accepted change. |
| `error` | `code, message` |
| `roomClosed` | `reason` – client returns to homepage |
| `removed` | – sent to a removed player |

Sending the full view each time is fine at this scale and keeps the client simple.

### 8.3 View contents

**Public (everyone):** room name and state, settings, seats and players (name, seat, host, connected, away, out, money card count, animal counts), deck count, donkeys revealed, active player, current phase and its public details (auction card, auctioneer, top bid, top bidder, passed and excluded bidders, bid turn; cow trade participants, animal, count, card counts, forfeit, winner, tie count), decision deadline, paused flag, log, end-of-game scores.

**Private (only to the player):** own money cards with IDs; own current offer; as auctioneer, whether Buy is enabled; as a cow trade participant, the opponent's revealed offer; as payer or receiver, the payment cards; during a bluff reveal, everyone sees the bluffer's cards (this is public by rule).

Host-only: room password (for sharing in the lobby).

---

## 9. Suggested project structure

```
/
├─ wrangler.toml            # Worker, static assets, Durable Object binding + SQLite migration
├─ src/
│  ├─ worker.ts             # routes /ws to GameRoom, serves assets
│  ├─ room.ts               # Durable Object: sockets, storage, alarms, broadcasting
│  ├─ rules/
│  │  ├─ types.ts           # state, actions, cards
│  │  ├─ setup.ts           # deck, starting money, seating, first player
│  │  ├─ auction.ts
│  │  ├─ cowTrade.ts
│  │  ├─ payment.ts         # validation + auto-pay combination search
│  │  ├─ timers.ts          # deadlines, timeout defaults, away tracking
│  │  ├─ scoring.ts
│  │  └─ view.ts            # per-player view filtering
│  └─ protocol.ts           # message types shared with the client
├─ web/                     # frontend (Vite), PWA manifest, service worker, art
└─ test/                    # Vitest unit tests for src/rules
```

- The rules engine takes an injectable random function (seedable) so tests are deterministic.
- `view.ts` must have tests proving hidden values never appear in another player's view or in the log.

---

## 10. Art direction

- **Style:** cartoonish and minimal, for adults. Dry, deadpan humor through attitude, not cuteness. No baby proportions or sparkly eyes. Nothing sexual or crude.
- **Execution:** flat vector (SVG), simple shapes, bold outlines, limited palette, lots of empty space. Must read clearly at small sizes.
- **Personalities:** smug horse, unimpressed rooster, indifferent cat, overconfident pig, mildly confused donkey, and similar dry characters for the rest.
- **Color:** each animal has its own distinct color so sets are recognizable at a glance in opponent panels.
- **Cards:** large, bold value numbers. Money cards look like slightly absurd banknotes in the same tone; the 0 card gets its own joke (it is the bluffing card).
- **Originality:** all artwork is original. Do not copy or imitate the Ravensburger illustrations.

---

## 11. Edge-case checklist (test these)

- [ ] Creating a room while one exists is refused.
- [ ] Wrong room ID and wrong password give the same error; rate limit applies.
- [ ] Duplicate names (case/whitespace variants) are rejected.
- [ ] Removed player's token cannot rejoin.
- [ ] Joining after start is refused; reconnecting seated players restores their seat and view.
- [ ] Host transfer after 2 minutes of host disconnection, including while paused.
- [ ] Room closes on host close, 5 minutes after finish, and after 10 minutes with nobody connected; Play again cancels the finish countdown.
- [ ] Donkey payouts are 50, 100, 200, 500 in order, paid before the donkey's auction.
- [ ] Auction with no bids gives the animal to the auctioneer for free.
- [ ] Passing is final; timeouts count as passes.
- [ ] Bids accept any multiple of 10 above the top bid, including big jumps.
- [ ] Bluff: cash revealed to all, bidder excluded, auction restarts; multiple bluffs accumulate exclusions; restart with no bids gives the animal free.
- [ ] Buy is disabled when the auctioneer can't afford it, and others can't tell.
- [ ] Payment: no change; overpay goes to receiver; auto-pay picks smallest total ≥ amount, then fewest cards.
- [ ] Cow trade "2 animals" option only when both hold ≥ 2.
- [ ] Complete sets can't be targeted.
- [ ] Challenger must offer ≥ 1 card (0 allowed); defender may put nothing.
- [ ] Forfeit: challenger wins, defender receives challenger's cards, no reveal.
- [ ] Revealed values visible only to the two participants, in both money modes.
- [ ] Ties repeat; after the 3rd consecutive tie the challenger wins.
- [ ] Deck empty + no animals → player out and becomes spectator.
- [ ] Deck empty + no legal trade → turn skipped.
- [ ] Game ends when no legal trade exists for anyone; scoring = sum × number of sets; equal scores broken by more complete sets, shared only if both are equal.
- [ ] Away after 3 consecutive timeouts; instant defaults; cleared on action.
- [ ] Timers keep running for disconnected players.
- [ ] Pause freezes everything; resume restarts the current decision's timer at full length.
- [ ] No hidden value ever appears in another player's view or in the log.

---

## 12. Assumptions to confirm

These follow from the agreed rules but were not stated explicitly:

1. **3rd-tie money:** when the challenger wins after 3 ties, the 3rd round's offers are settled with the selected money rule, treating the challenger as the winner.
2. **Challenger with no money cards** cannot start a cow trade (they must put down at least one card). If that leaves no possible action, their turn is skipped.
3. **Host-transfer delay** is 2 minutes.
4. **Bluff reveal** is shown for 5 seconds.
