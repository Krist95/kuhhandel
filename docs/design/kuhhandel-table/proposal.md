# Table redesign proposal

What changes from the current `web/src/ui/Table.tsx` and why. See **TableLayout** under Components for the full screens.

## What's wrong with the table today

1. **You can't tell whose move it is.** The only signals are a small "Turn" badge on a pod and a `Name · 12s` line in the centre text. On a 390px screen they're the same size as everything else.
2. **The centre is a paragraph.** `Center.tsx` stacks 4–6 lines of text ("Auctioneer: Ben", "Top bid 120 · Clara", "Bidding: Anna", struck-through names…). The top bid — the number everyone is watching — is body text.
3. **Your controls are squeezed into one grid cell.** `ActionBar` lives in the bottom-right cell of a 3×3 grid at 0.85em, so Bid/Pass/+10 are the smallest buttons on screen.
4. **Every real decision opens a modal.** Pay, Set up trade and Respond are a button that opens `MoneyPicker`/`TradeWizard` over the table — an extra tap, and it hides the table while you decide. Trade setup is three screens (player → animal → count) before you even pick money.
5. **Your money is hidden behind a text summary** ("10×4 · 50×1 · Total 90"). It's your most important private information.
6. **The number field brings up the keyboard,** which covers most of a landscape phone.
7. **The log is invisible** unless opened, so you miss "Donkey! Everyone receives 100".
8. **Game start is abrupt.** The lobby swaps to the table; nobody is told who goes first or what they were dealt.

## The proposal

| # | Change | Component |
|---|---|---|
| 1 | **A 3-second game-start intro** over the table: who goes first (picked at random — say so), the turn order with you marked, and your dealt notes totalling 90. Auto-dismisses; tap to skip. | GameStart |
| 2 | **Opponents move to a top rail**, clockwise from the player after you — the rail reads left-to-right in turn order. Frees the full middle for the stage and the full right side for your controls. | SeatPod, TableLayout |
| 3 | **The countdown becomes a ring** on the avatar of whoever the game waits on, plus a larger ring in your dock when it's you. It turns `danger` for the last 5s. | CountdownRing |
| 4 | **The stage shows state, not sentences:** deck pile with count, donkey track (4 pips, next payout), a big lot card, the top bid in `display`, and bidder pills in bid order (now / top / passed / excluded). Cow trades show both sides' face-down cards. | Stage |
| 5 | **One action dock on the right**, always the same place, always one decision: heading + ring, a one-line consequence, big buttons at the bottom edge. Watching others it says whose move it is. | ActionDock |
| 6 | **Bidding without the keyboard:** a −/+ stepper with the amount in `display`, quick +10/+50/+100, then Pass / **Bid 130** (the button says the amount). Long-press the number to type. | ActionDock |
| 7 | **Money is picked in your hand, in place.** Pay / Offer / Counter put the hand into picking mode (accent outline); tapped notes lift; the dock shows a meter and "30 over — no change given". **Best fit** fills the auto-pay combination (smallest total ≥ amount, fewest cards — same rule as the server). | Hand, ActionDock |
| 8 | **Cow trade setup in one list:** every legal (rival, animal) pair as a row with a ×1/×2 toggle (×2 only when both hold two). Pick a row, pick notes in your hand, Offer. Two taps instead of four screens. | ActionDock |
| 9 | **Animal chips put text on paper,** colour on the art. Fixes ink-on-dark-animal contrast and makes "Set" explicit. | AnimalCard |
| 10 | **A one-line log ticker** under the rail, latest line plus the previous one dimmed; tap for the full log. | LogTicker |
| 11 | **Pods fit any herd.** Art tiles only fit two animal types in a 5-player pod, so pods use a fixed ten-column ledger (column = animal, pips = count, gold ring = set). | SeatPod |
| 12 | **A herd board** replaces the one-player collection modal: every player × every animal in one grid, cow-tradeable cells outlined, and an exact "In deck" row. Opens from any pod. | HerdBoard |
| 13 | **One `⋯` menu** replaces the Info / Log / Host corner buttons (Rules & settings, Log, and for the host Pause / Close room). | TableLayout |

## Departures from the spec (need a yes)

- **§7.3 seat positions.** The spec places opponents poker-style (left, top-left, top-right, right). This proposal puts them all on a top rail in the same clockwise order. Reason: at 360px tall, side panels cost ~25% of the width that the stage and dock need, and a single row reads as turn order. Fallback if you want to keep poker seating: keep the rail for 3–4 players, use left/right pods only for 5.
- **§7.3 money summary.** The spec says "compact money summary; tapping opens the full money view". This shows the notes directly. Still private: only your own hand shows values.
- **New:** game-start intro and the **Best fit** button. Neither changes rules; Best fit just pre-selects what timeout auto-pay would choose.

## Where it lands in the code

| Today | Becomes |
|---|---|
| `Table.tsx` 3×3 grid, `.corner` buttons | `.kh-table` grid (rail / ticker / stage / hand / dock), `⋯` menu |
| `model/layout.ts` `POSITIONS` | rail order only: `seatPositions` without the `pos` mapping |
| `OpponentPanel.tsx` | SeatPod (ring avatar, status badge, card-back count, herd ledger) |
| `CollectionModal.tsx` | HerdBoard |
| `Center.tsx` | Stage |
| `Countdown.tsx` | CountdownRing (same `secondsLeft` math; `--p = s / decisionSeconds`) |
| `ActionBar.tsx`, `BidControls.tsx`, `TradeWizard.tsx` | ActionDock states, keyed by `deriveControls().kind` as today |
| `MyArea.tsx` + `MoneyPicker.tsx` | Hand with an inline picking mode; `MoneyPicker` stays only as the long-press "type an amount" sheet |
| `GameLog.tsx` | LogTicker + the existing panel behind it |
| — | GameStart overlay, shown once per game when `view.room.game` first appears (keyed on room ID + game start, like `reveals.ts` does for trade reveals) |

`deriveControls`, `waitingOnPublic`, `tradeTargets` and `sheetKey` stay exactly as they are — this is a presentation change. `MoneyPicker`'s `ready` rules (pay: total ≥ owed; offer/counter: ≥1 card) move into the dock unchanged.
