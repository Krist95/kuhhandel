One opponent in the top rail: avatar ring, name, money-card count, and a ten-column herd ledger that fits every possible herd.

**Replaces** `OpponentPanel.tsx`. Tapping any pod opens the HerdBoard with that player's row outlined.

**Anatomy** — a CountdownRing as the avatar (their initial when idle, seconds left when the game waits on them) with one status badge under it (Host / Away / Offline / Out, most important wins: Offline > Away > Out > Host); name in `name` style with ellipsis and the card-back `×N` money count on the top row; the herd ledger below.

**Herd ledger** — always ten columns in value order (Rooster → Horse), so *position* names the animal and colour confirms it. Each column is four stacked pips; filled pips in the animal's colour = how many they hold. A complete set gets a `set-gold` ring. Animals they don't own leave a faint baseline pip, so columns line up across all pods and you can compare by glancing down the rail. 98px wide whether they own 1 animal type or all 10 — at 5 players a pod has ~110px for it, which is why tiles with art could only fit two.

**States** — `active` (game waits on them: `accent` outline, ring running, background `felt-deep`), `dim` (passed in the current auction or excluded), `out` (muted, ledger replaced by "Out · watching").

**Consumer provides** — a `PublicPlayer` (herd counts by animal), `isHost`, whether the game waits on them, and the seconds left.

**Don't** show money values — only the count. **Don't** switch back to art tiles when a herd is small; a stable ledger is what makes the rail comparable.
