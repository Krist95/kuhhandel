Every player's herd side by side, plus what's still in the deck — the "who has what" view for planning cow trades.

**Replaces** `CollectionModal.tsx` (one player at a time).

**Opens** — tapping any SeatPod (that player's row gets a `paper` outline), tapping your own herd, or from the `⋯` menu. Closes on Close or a tap outside. While it's your decision the ring in its header keeps counting; the dock stays one tap away.

**Layout** — an 11-column grid: a name column, then one column per animal in value order with its art tile and value as the header. One row per player (you first, on `felt-deep`), then an **In deck** row.

**Cells** — empty: a faint dot. Held: the count in bold with four pips. Complete set: `set-gold` fill with "Set". A dashed `accent` outline marks every cell you could cow-trade *right now* (you both hold it and neither has all four — `tradeableAnimals` from `rules/herd.ts`).

**In deck row** — 4 minus everything held, per animal. Every revealed card goes to somebody, so this is exact and public; it tells you, for example, that one Horse is still to come.

**Row header** — name, completed sets, and money-card count (never values).

**Consumer provides** — all `PublicPlayer`s in seat order starting with you, your id, the focused player id, and the decision deadline if it's yours.
