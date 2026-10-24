The in-game table for Kuhhandel Online: a private, phone-only, landscape-only browser game of auctions and cow trades for 3–5 friends. Everything here is drawn for a screen **360–430px tall**. Every rule below exists to make one question answerable at a glance: *who is the game waiting on, and is it me?*

## Content fundamentals

- **Voice: dry, deadpan, adult.** The art already does this ("Backed by pure confidence." on the 0 note). Copy follows suit: short, flat, a little unimpressed. "Nothing for you to do. Look busy." — not "Please wait for other players 🙂".
- **No emoji, no exclamation marks** except the one the rules earn: "Donkey! Everyone receives 100".
- **Second person for you, first names for everyone else.** "Your turn", "Anna’s move", "Ben bid 120". Never "Player 3".
- **Sentence case** for headings and buttons ("Cow trade", "Put nothing", "Buy it"). UPPERCASE only in the `label` style.
- **Say the consequence on the button.** "Sell — Ben pays you 120", "Auction — Flip the top card · 31 left". A disabled button always says why in its second line ("You can’t cover 120"), visible only to you.
- **Never print a hidden value.** Log lines, banners and pods show amounts only where the rules make them public (bids, payment amounts, card *counts*). Values of offers and payments appear only in the hand and in the private reveal.

## Visual foundations

**Colour.** The whole screen is felt. `felt-dark` is the room, `felt` is the table (the stage in the middle), `felt-deep` is *your* stuff (hand and dock). `paper` is text; `ink` is text on anything light and the outline on all art. `accent` means exactly one thing: **you, now** — your turn ring, your primary button, notes you've picked, the top bid. If the game is waiting on someone else, nothing on your screen is accent except their ring. `danger` is for excluded/offline/last five seconds and Close room — always a fill with bold `paper` text, never a text colour. `muted` is for hints on `felt-dark` and `felt-deep` only; it fails on `felt`.

**Animal colours** (`animal-rooster` … `animal-horse`) are identity, not decoration: each appears behind that animal's art and nowhere else. Text never sits directly on them — names go on a `paper` strip, counts on a `paper` badge — because rooster, cat, dog and donkey are too dark for ink text. A completed set of four gets a `set-gold` ring and the word **Set**.

**Type.** One family, the system sans (`sans`). Six styles: `display` for the single number that matters (top bid, bid stepper, who goes first), `title` for dock headings, `body`, `name` for player names, `label` for uppercase captions, `micro` for counts. All numbers use tabular figures. Sizes are px at a 390px-tall screen; in the app they scale with height (`clamp(12px, 3.6vh, 18px)` on body) so never hard-code px in components — use em off the body size.

**Space.** Regions are separated by `space-2` gaps of `felt-dark`, not by lines. Inside pods, dock and hand: `space-3`. Nothing scrolls during play.

**Shape.** Flat. Art has a 3.5px `ink` outline; UI echoes it with `lift` / `lift-lg` — a hard 2–4px offset, never a blur. Radii: `radius-sm` tiles and notes, `radius-md` buttons and chips, `radius-lg` pods, dock, hand and lot card, `radius-table` only on the stage, `radius-pill` on pills and the countdown ring.

**Focus.** A 3px solid `paper` outline, 2px offset — it clears 3:1 on every felt surface.

**Motion.** Two things move: the countdown ring drains, and money notes lift 7px when picked. A turn change pulses the active pod's ring once. Nothing else animates.

## Layout

The table is four regions on a 780×360 base (scales up to any landscape phone):

| Region | Where | Holds |
|---|---|---|
| Rail | top, full width, 58px | one SeatPod per opponent, clockwise from the player after you, then the `⋯` menu. Tap a pod for the HerdBoard. |
| Ticker | under the rail, left | the latest log line; tap to open the full log |
| Stage | middle-left, the `felt` | deck, donkey track, lot card, top bid, bidder pills / cow-trade face-downs |
| Hand | bottom-left, `felt-deep` | your animals as chips, your money as real notes, cash total |
| Dock | right column, `felt-deep` | the one decision you're being asked to make, with its countdown |

Your thumbs live on the bottom and right edges, so the hand and the dock are there. Every decision is made in the dock **plus** the hand — no modal pickers.

## Iconography

There is no icon set. Art is the original flat SVG set in `web/src/art/` (copied here under Assets): ten animal portraits and six banknotes plus a face-down back. Use them through `<img>`, never re-draw or recolour them. UI glyphs are typographic only: `⋯` for the menu, `▾` on the ticker, `→` in turn order, `−`/`+` on the stepper, `×2` for counts.

## Accessibility notes

- Herds never rely on colour alone: the pod ledger has a fixed column per animal (position = identity) and the HerdBoard labels every column with art and value.
- Every coloured signal has a word: the turn ring has a number, Away/Offline/Out are pill words, excluded bidders say "bluffed", sets say "Set".
- Known source pairs that sit just under 4.5:1: `paper` on `danger` (4.4:1) and `accent` text on `felt` (4.4:1). Both are used only bold at 14px+ / 19px+ respectively.
- Hit targets are ≥44px tall in the dock; quick-raise buttons are 36px with 6px gaps.
