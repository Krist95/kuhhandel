Buttons for the dock: primary, secondary, quick-raise, and disabled-with-reason.

**Replaces** the global `button`, `.secondary`, `.small` styles in `styles.css` for in-game controls.

**Variants** — default (`accent` fill, `ink` text, `lift`); `secondary` (transparent with a `line` outline); `quick` (36px, `felt-dark`, for +10/+50/+100); `big` (52px, for the two turn actions). A `<small>` second line states the consequence or, when disabled, the reason.

**Do** keep at most one primary per decision, on the right of a pair or on top of a stack. **Don't** hide a disabled action — show it with its reason.
