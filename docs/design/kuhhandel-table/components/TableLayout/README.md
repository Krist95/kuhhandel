The full in-game screen: rail of opponents, log ticker, felt stage, your hand and the action dock on a 780×360 base.

**Replaces** `web/src/ui/Table.tsx` (3×3 grid) and the `.corner` Info/Log/Host buttons.

**Structure** — `.kh-table` is a 2-column, 4-row grid: rail (row 1, full width), ticker (row 2, left), stage (row 3, left), hand (row 4, left), dock (rows 2–4, right, 248px). Gaps are `space-2`, padding `space-3`, background `felt-dark`.

**Consumer provides** — the `RoomView` and `me` from the view signal; opponents in rail order (`seatPositions(players, meId)` minus you); the `deriveControls(view)` result for the dock.

**Do** keep the dock in the same place in every state, including watching. **Do** grey the whole grid while paused (`.paused-table` as today) and keep overlays outside it.

**Don't** open modals for decisions — only for the log, rules, a collection, the bluff reveal and the private trade reveal.
