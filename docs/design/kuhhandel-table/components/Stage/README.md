The felt in the middle of the table: what's happening right now, shown as objects rather than sentences.

**Replaces** `Center.tsx`.

**Anatomy** — on the left the pile (deck stack with count, four donkey pips, "Next +100" or "All paid"); then the phase's content:
- `action` — `label` "Round N", a `title` line ("Clara opens.").
- `bidding` / `decision` — the lot card, `label` "Auction · Ben’s lot", the top bid in `display` with the bidder's name, and bidder pills in bid order: `now` (accent), `top` (paper ring + amount), `passed` (struck, dimmed), `excl` (danger, "bluffed").
- `payment` — the lot card and "160 · you → Ben"; a line that only the two players see the notes.
- `tradeSetup` / `tradeResponse` — `label` with animal, count and "repeat N of 3", then each side's face-down card backs.
- `bluff` — the lot card; the bluff reveal overlay does the talking.

**Consumer provides** — `GameView` (phase, deckCount, donkeysRevealed, nextDonkeyPayout) and a name lookup.

**Don't** put a countdown here — it lives on the pod and in the dock.
