The right-hand column where you make the one decision the game is waiting on.

**Replaces** `ActionBar.tsx`, `BidControls.tsx`, `TradeWizard.tsx` and the `MoneyPicker` modals for pay / offer / counter.

**Anatomy** — `.head` (a CountdownRing + `title` heading + one `muted` line saying the timeout default or context), then `.push` pinned to the bottom edge with the buttons. `.mine` adds the `accent` outline whenever the decision is yours.

**States** — one per `deriveControls().kind`:
- `watch` — "Anna’s move" + what they're doing. No buttons.
- `turn` — Auction (primary, "Flip the top card · N left") and Cow trade (secondary, or disabled with its reason).
- `bid` — stepper (−/amount/+ in steps of 10, starting at `minBid`), +10/+50/+100, Pass and **Bid N**. Long-press the amount for a numeric sheet.
- `decide` — Sell (primary, "Ben pays you 120") and Buy it (disabled with "You can’t cover 120" when `buyEnabled` is false — only you see why).
- `pay` — meter of selected / owed, a hint ("30 over — no change given."), Best fit and **Pay N**. Notes are picked in the Hand.
- `tradeSetup` — one row per legal (rival, animal) with a ×1/×2 segmented toggle, then Cancel / **Offer N**. For a repeat round (`fixed` terms) only the offer step shows.
- `respond` — "Anna wants your 2 Pigs · They put down 3 cards", Put nothing / **Counter N**.
- `away` — the existing AwayBanner content in the dock.

**Consumer provides** — the `Controls` object, the decision deadline and `decisionSeconds`, and the Hand's current selection for pay/offer/counter.

**Don't** add a second primary button; the right-hand button in a pair is the primary one.
