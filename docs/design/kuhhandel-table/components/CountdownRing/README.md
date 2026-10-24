A ring that drains as the decision deadline approaches, with the seconds in the middle.

**Replaces** `Countdown.tsx`'s text line.

**Use** — set `--p` to seconds-left ÷ `decisionSeconds` (from `secondsLeft(deadline, now, offset)` as today); add `low` at ≤5s to switch the ring to `danger`; `idle` for a resting avatar ring; `lg` in the dock. Set `--ring-bg` to the surface it sits on.

**Don't** show it while paused; the pause overlay covers the table.
