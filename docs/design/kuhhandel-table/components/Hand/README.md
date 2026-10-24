Your own area at the bottom: your animals as chips and your money as real notes, with the cash total.

**Replaces** `MyArea.tsx` and the money summary button; absorbs `MoneyPicker` for pay / offer / counter.

**Modes** — *viewing* (notes are static, total labelled "Cash"); *picking* (hand gets the `accent` outline, notes are toggle buttons with `aria-pressed`, picked notes lift with an `accent` ring, the total reads "Selected", "Offer · 2 cards" or "Counter · 2 cards", plus "/ owed" when paying).

**Many animals** — up to four types show as chips (art, name, value, count). From five types on, the row switches to 28px art tiles with a count badge, which fits all ten. Tap the row to open the HerdBoard for names and values.

**Consumer provides** — your herd (`herdChips`), your `MoneyCard[]` sorted by value then id, the mode, and a selection callback. The dock reads the selection.

**Do** clear the selection when the decision changes (`sheetKey`, as today). **Don't** show this tray's values anywhere else on screen.
