# Table Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-game table (`web/src/ui/Table.tsx` and its children) with the "Kuhhandel Table" design so the running app looks the same as the design previews.

**Architecture:** The design was drawn as a fixed 780×360 px canvas. We render the table at those px values and scale the whole canvas to the phone with one CSS `transform: scale()`. The scale fits the height, and the width stretches because the grid's left column is `1fr`. That makes it pixel-faithful on every landscape phone without converting values to em. The design's stylesheet is copied into the app **verbatim**. Preact components output the **same class names and DOM structure** as the reference markup. All decisions (ordering, states, copy) live in pure, unit-tested functions under `web/src/model/`. Components are thin.

**Tech Stack:** Preact 10.29 + `@preact/signals` 2.11, Vite 8, Vitest 4.1 (Node environment, model tests only), TypeScript 5.9.

**Spec:** `docs/design/kuhhandel-table/`. Read these files:
- `README.md`: rules (colour meaning, copy voice, layout regions).
- `proposal.md`: what changes and why, and the old → new file map.
- `components/<Name>/README.md`: behaviour of each component.
- `components/bundle.css`: **the stylesheet. Copy it, don't rewrite it.**
- `tokens.json`: every colour, space, radius and shadow value.
- `markup.mjs`: **the exact DOM for every component and the nine table scenes.** Functions `pod`, `ledger`, `tile`, `chip`, `lot`, `note`, `backs`, `ring`, `pile`, `hand`, `ticker`, `dock.*`, `herdBoard`, `table`, plus the `scenes` object. Running `node docs/design/kuhhandel-table/markup.mjs /tmp/out` writes the preview HTML files.
- Visual reference: the published design system (TableLayout page), and `components/*/preview.html`.

Also `kuhhandel-spec.md` (game rules, §7 UI). This plan changes §7.3 (see Task 10).

## Global Constraints

- **Visual fidelity:** class names, element nesting and text in every component match `markup.mjs`. Every CSS value comes from `bundle.css` / `tokens.json`. No new colours, sizes or radii. The only stylesheet edits allowed are the three listed in Task 1.
- Design canvas: height **360px**, minimum width **700px**, grid `minmax(0,1fr) 248px` × `58px 22px minmax(0,1fr) 100px`, gap 6px, padding 8px.
- Copy is fixed by the design. Where this plan quotes a string, use it character for character, including `’` (U+2019) in "Anna’s move", "Ben’s lot" and "You can’t cover 120", and `—` / `−` / `·` / `×`.
- Hidden values never render outside your own hand or the private reveal. Pods and board rows show money **counts** only. Log text is shown as-is (the server already filters it).
- `deriveControls`, `waitingOnPublic`, `tradeTargets`, `sheetKey` (`web/src/model/controls.ts`) and every `ClientMessage` sent stay unchanged. This is a presentation change only; no server or rules changes.
- Out of scope (keep as they are, restyle later): Home, RoomForm, Lobby, EndScreen, BluffOverlay, TradeRevealModal, PauseOverlay, ConfirmDialog, RotateOverlay, Toast.
- Server strings render as text only, never through `dangerouslySetInnerHTML`.
- npm scripts stay cross-platform (no `rm`/`cp` in scripts).

## Review Focus

1. **16-character names** (the maximum) in a pod, bidder pill, board row header, dock heading ("Hieronymus Third’s move") and the intro order. Each must ellipsize or wrap inside its box and never push the layout. Covered by the `long` dev scene in Task 10.
2. **Out players:** they stay in the rail as "Out · watching". They must never appear as bidders or as cow-trade targets on the herd board. Covered by tests in Tasks 2–3.
3. **Picked notes that leave your hand** (the server view changes mid-selection, e.g. a donkey payout arrives or a reconnect happens): the selection must drop ids you no longer hold, so the Pay/Offer total never counts a ghost card. Test in Task 4.
4. **Short or wide phones** (667×375 iPhone SE, 932×430 Pro Max, landscape heights under 360): the canvas must fit with no scrolling and no clipping. Tests in Task 1.
5. **Paused or reconnecting mid-decision:** while `PAUSED`, rings show no seconds and the intro never shows. On reconnect during the first turn the intro may show again but still auto-dismisses. Tests in Task 3.

---

### Task 1: Tokens, stylesheet and the scaled canvas

**Files:**
- Create: `web/src/styles/tokens.css`, `web/src/styles/table.css`, `web/src/model/fit.ts`, `web/src/model/fit.test.ts`, `web/src/styles/tokens.test.ts`
- Modify: `web/src/main.tsx` (import both stylesheets after `./styles.css`), `web/src/styles.css:1-4` (delete the `:root` block; tokens.css now defines those names with the same values)

**Interfaces:**
- Produces: `fitTable(viewportW: number, viewportH: number): { scale: number; width: number; height: number }`. Exports `DESIGN_H = 360` and `MIN_W = 700`. All `.kh-*` classes become available globally.

- [ ] **Step 1: Write failing tests**

`fit.test.ts`:
```ts
it("fills a 844×390 phone by height", () => expect(fitTable(844, 390)).toEqual({ scale: 390 / 360, width: 844 / (390 / 360), height: 360 }));
it("fits width on a 667×375 phone", () => expect(fitTable(667, 375)).toEqual({ scale: 667 / 700, width: 700, height: 360 }));
it("handles a 932×430 phone", () => expect(fitTable(932, 430).height).toBe(360));
it("handles a 640×320 landscape window", () => { const f = fitTable(640, 320); expect(f.scale * f.height).toBeLessThanOrEqual(320); expect(f.scale * f.width).toBeLessThanOrEqual(640); });
```
`tokens.test.ts`: read `docs/design/kuhhandel-table/tokens.json` and `web/src/styles/tokens.css` with `node:fs`. For every token in `color`, `spacing`, `radius` and `shadow`, assert the css contains `--${name}:${value};`. Also assert it contains `--font-sans:` followed by `type.families.sans`.

- [ ] **Step 2: Run** `npx vitest run web/src/model/fit.test.ts web/src/styles/tokens.test.ts`. Expected: FAIL (modules or files missing).

- [ ] **Step 3: Implement**
  - `fit.ts`: `scale = Math.min(vh / DESIGN_H, vw / MIN_W)`, `width = vw / scale`, `height = DESIGN_H`.
  - `tokens.css`: one `:root{…}` block in the exact `--name:value;` form the test expects (colours, spacing, radius, shadow, `--font-sans`).
  - `table.css`: a verbatim copy of `components/bundle.css` with exactly three edits:
    1. `.kh-table{width:780px;height:360px;` → `.kh-table{width:100%;height:100%;`
    2. Append `.kh-frame{position:fixed;inset:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);background:var(--felt-dark);overflow:hidden;display:flex;align-items:center;justify-content:center}`
    3. Append `.kh-canvas{flex:none;transform-origin:center}`

- [ ] **Step 4: Run** the same command. Expected: PASS. Then run `npm run typecheck`. Expected: no errors.

- [ ] **Step 5: Commit** `feat(web): add table design tokens, stylesheet and canvas fit`

---

### Task 2: Rail and herd models

**Files:**
- Create: `web/src/model/herds.ts`, `web/src/model/herds.test.ts`
- Modify: `web/src/model/layout.ts` (replace `POSITIONS`/`seatPositions` with `railOrder`), `web/src/model/layout.test.ts`

**Interfaces:**
- Consumes: `ANIMALS`, `Herd`, `Animal` (`src/rules/types.ts`); `tradeableAnimals` (`src/rules/herd.ts`); `PublicPlayer` (`src/protocol.ts`).
- Produces:
  - `railOrder(players: readonly PublicPlayer[], meId: string): PublicPlayer[]`: opponents clockwise by seat, starting after you, you excluded. If `meId` isn't seated, start from the lowest seat.
  - `ledger(herd: Herd): { animal: Animal; count: number; set: boolean }[]`: always 10 entries, in `ANIMALS` order.
  - `podBadge(p: PublicPlayer, isHost: boolean): "Offline" | "Away" | "Out" | "Host" | null`
  - `deckLeft(players: readonly PublicPlayer[]): Record<Animal, number>`: 4 minus the total held, per animal.
  - `boardRows(players: readonly PublicPlayer[], meId: string): { player: PublicPlayer; me: boolean; sets: number; tradeable: Animal[] }[]`: you first, then `railOrder`. `tradeable` is `tradeableAnimals(me.herd, p.herd)` for in-game opponents, `[]` for you and for out players.

- [ ] **Step 1: Write failing tests** with a local helper `pp(id, seat, herd: Partial<Herd> = {}, extra = {})` that returns a `PublicPlayer`:
  - `railOrder`: seats 1..5 with me at seat 3 → ids at seats 4, 5, 1, 2. With 3 players, me at seat 1 → seats 2, 3.
  - `ledger({...empty, horse: 4, cat: 1})` has length 10; `[0].animal === "rooster"`; the `horse` entry is `{animal:"horse",count:4,set:true}`; the `cat` entry has `set:false`.
  - `podBadge`: offline + away + host → `"Offline"`; away + host → `"Away"`; out + host → `"Out"`; host only → `"Host"`; none → `null`.
  - `deckLeft`: the LATE cast from `markup.mjs` (copy those five herds) gives `{rooster:0,goose:0,cat:2,dog:0,sheep:0,goat:0,donkey:0,pig:3,cow:1,horse:1}`.
  - `boardRows` (LATE cast, me = "You"): row 0 is me with `tradeable: []`. Anna's row has `tradeable` = `["sheep","goat"]` and Clara's has `["sheep"]` (Clara's rooster set is excluded). With Dan marked `out: true`, Dan's row has `tradeable: []`.

- [ ] **Step 2: Run** `npx vitest run web/src/model/herds.test.ts web/src/model/layout.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions above in `herds.ts` and `railOrder` in `layout.ts`. Delete `Pos`, `POSITIONS` and `seatPositions`, and update `layout.test.ts` to test `railOrder` only.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): rail order, herd ledger and herd board models`

---

### Task 3: Stage, dock and intro models

**Files:**
- Create: `web/src/model/stage.ts`, `web/src/model/stage.test.ts`

**Interfaces:**
- Consumes: `PublicPhase`, `View`, `PublicPlayer`; `TradeTarget` (`model/controls.ts`); `railOrder` (Task 2).
- Produces:
  - `bidderPills(phase: Extract<PublicPhase, { kind: "bidding" | "decision" }>, players: readonly PublicPlayer[], meId: string): { id: string; label: string; state: "now" | "top" | "passed" | "excl" | "wait"; amount: number | null }[]`. Order: clockwise starting after the auctioneer. Excludes the auctioneer and out players. `label` is `"You"` for you. State precedence: excl > passed > now (`turnId`) > top (`topBidderId`) > wait. `amount` is `topBid` on the `top` pill, otherwise `null`.
  - `tradeOptions(targets: readonly TradeTarget[]): { playerId: string; animal: Animal; maxCount: 1 | 2 }[]`: flattened in target order, then animal order.
  - `payHint(selected: number, owed: number): string`. Exact copy: `"${owed - selected} still to go."`, `"Exact."`, `"${selected - owed} over — no change given."`
  - `stepBid(amount: number, minBid: number, dir: -1 | 1): number` returns `max(minBid, amount + 10 * dir)`.
  - `ringState(secondsLeft: number | null, decisionSeconds: number, paused: boolean): { p: number; low: boolean; label: string | null }`. `p` is clamped to 0..1. `low` is `secondsLeft <= 5`. `label` is `null` when paused or when `secondsLeft` is null.
  - `intro(view: View): { key: string; firstId: string; order: { id: string; label: string; first: boolean; me: boolean }[] } | null`. Non-null only when `status === "PLAYING"`, `game.deckCount === 40` and `phase.kind === "action"`. `key = \`${roomId}:${game.deadline}\``. `order` runs clockwise from the active player through all players, with label `"You"` for you.

- [ ] **Step 1: Write failing tests**
  - `bidderPills`: auctioneer at seat 2 of 5, me at seat 4, `turnId` = seat 3, `topBidderId` = seat 5 with `topBid` 120, `passed` = [seat 1], `excluded` = []. Expect the order seats 3, 4, 5, 1 with states `now`, `wait`, `top`, `passed`. The seat-4 label is `"You"` and the seat-5 amount is 120. A second case: a player who is both passed and the turn holder → `passed`; an excluded player → `excl`; an out player is absent.
  - `tradeOptions`: two targets, `[{Ben:[horse(1)]},{Clara:[sheep(2)]}]` → 2 rows, the Clara row with `maxCount: 2`.
  - `payHint(110,160)` → `"50 still to go."`; `(160,160)` → `"Exact."`; `(190,160)` → `"30 over — no change given."`
  - `stepBid(100, 100, -1)` → 100; `stepBid(100, 90, 1)` → 110.
  - `ringState(12, 20, false)` → `{p:0.6, low:false, label:"12"}`; `(4,20,false).low` → true; `(12,20,true).label` → null; `(25,20,false).p` → 1.
  - `intro`: build a view with `buildView(game(), tok("Clara"), T0)` (helpers from `test/rules/helpers`, as `controls.test.ts` does) → non-null. `order[0].first` is true and exactly one entry has `me` true. The same view after one `act(..., auction)` → null. The same view with status `"PAUSED"` → null.
- [ ] **Step 2: Run** `npx vitest run web/src/model/stage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions in `stage.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): stage, dock and intro view models`

---

### Task 4: Shared note selection

The hand picks notes and the dock submits them, so the selection is shared state.

**Files:**
- Modify: `web/src/state.ts`, `web/src/state.test.ts`

**Interfaces:**
- Produces: `picked = signal<string[]>([])`, `togglePick(list: readonly string[], id: string): string[]`, and `validPicks(list: readonly string[], money: readonly MoneyCard[]): string[]` (keeps only ids still in `money`, preserving order).

- [ ] **Step 1: Write failing tests:** `togglePick(["a"],"b")` → `["a","b"]`; `togglePick(["a","b"],"a")` → `["b"]`; `validPicks(["a","x","b"], [{id:"b",value:10},{id:"a",value:0}])` → `["a","b"]`.
- [ ] **Step 2: Run** `npx vitest run web/src/state.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the signal and both functions.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): shared money selection state`

---

### Task 5: Small components

All markup must equal the matching `markup.mjs` function's output for the same input (classes, nesting, text, `aria-*`, `title`, `alt`). Instead of `/_blob/...` URLs, use `ANIMAL_ART`, `NOTE_ART`, `CARD_BACK` and `ANIMAL_COLOR` from `web/src/art`. Set `style={{"--c": \`var(--animal-${animal})\`}}` as markup.mjs does.

**Files:**
- Create: `web/src/ui/table/CountdownRing.tsx`, `web/src/ui/table/Animals.tsx` (`AnimalTile`, `AnimalChip`, `LotCard`), `web/src/ui/table/Money.tsx` (`Note`, `NoteButton`, `Backs`), `web/src/ui/table/SeatPod.tsx` (includes `Ledger`), `web/src/ui/table/LogTicker.tsx`

**Interfaces:**
- Consumes: Task 2 (`ledger`, `podBadge`), Task 3 (`ringState`), `secondsLeft` + `offset` (the existing countdown math).
- Produces:
  - `CountdownRing(props: { deadline: number | null; decisionSeconds: number; paused: boolean; size?: "md" | "lg"; idleLabel?: string })`: re-renders every 250 ms like the old `Countdown.tsx`; with no deadline it renders `.kh-ring.idle` showing `idleLabel`.
  - `AnimalTile(props: { animal: Animal; count?: number })`, `AnimalChip(props: { animal: Animal; count: number })`, `LotCard(props: { animal: Animal })`.
  - `Note(props: { value: MoneyValue; size?: "md" | "sm" })`, `NoteButton(props: { card: MoneyCard; pressed: boolean; disabled: boolean; onToggle: () => void })`, `Backs(props: { count: number })`.
  - `SeatPod(props: { player: PublicPlayer; isHost: boolean; active: boolean; dim: boolean; deadline: number | null; decisionSeconds: number; paused: boolean; onOpen: () => void })`
  - `LogTicker(props: { log: readonly LogEntry[]; onOpen: () => void })`: shows the last entry, plus the previous one in `.prev` when there is one.

- [ ] **Step 1:** Implement the five files. `SeatPod`: `dim` means passed or excluded in the current auction; the parent decides. An out player renders `<em>Out · watching</em>` instead of the ledger.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: no errors.
- [ ] **Step 3: Commit** `feat(web): ring, animal, money, pod and ticker components`

---

### Task 6: Stage

**Files:**
- Create: `web/src/ui/table/Stage.tsx`

**Interfaces:**
- Consumes: Task 3 `bidderPills`; Task 5 `LotCard`, `Note`. `CARD_BACK`, `DONKEY_PAYOUTS`, `MAX_TIES`, `ANIMAL_NAME`.
- Produces: `Stage(props: { room: RoomView; game: GameView; meId: string })` → `<div class="kh-stage">…</div>`

- [ ] **Step 1: Implement** one branch per phase. Markup comes from the `scenes.*.stage` strings in `markup.mjs`; copy per `components/Stage/README.md`:
  - Pile: `pile(deck, donkeys)`. The caption is `"Next +" + DONKEY_PAYOUTS[n]` or `"All paid"`.
  - `action`: `label` "Round 1" while `deckCount === 40`, otherwise "Your turn" / "<Name>’s turn"; banner "You open." / "<Name> opens." on round 1, otherwise "Your turn." / "<Name>’s turn."
  - `bidding` / `decision`: `LotCard`, cap "Auction · Your lot" or "Auction · <Name>’s lot", `.kh-big` with `topBid` + `<small>` top bidder name ("You" if you), and the bidder pills from `bidderPills`. Pill text: excluded → "<label> · bluffed"; top → "<label> <b>amount</b>".
  - `payment`: `LotCard`, cap "Payment", `.kh-big` with `amount` + `<small>` "you → Ben" / "Ben → you" / "Anna → Ben", plus the hint line from `scenes.pay`, adjusted to name the two players.
  - `tradeSetup`: copy from `scenes.setup`, with " · repeat N of 3" appended to the cap when `ties > 0`.
  - `tradeResponse`: `.kh-offer` with the challenger's `offerCount` card backs vs the defender's side, which says `deciding…` (copy from `scenes.respond`).
  - `bluff`: `LotCard` and cap "Auction · bluff called"; the existing `BluffOverlay` does the rest.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: no errors.
- [ ] **Step 3: Commit** `feat(web): stage component`

---

### Task 7: Hand

**Files:**
- Create: `web/src/ui/table/Hand.tsx`

**Interfaces:**
- Consumes: Task 4 `picked`, `togglePick`, `validPicks`; Task 5 `AnimalChip`, `AnimalTile`, `NoteButton`; `herdChips` (`model/money.ts`).
- Produces: `Hand(props: { player: PublicPlayer; money: readonly MoneyCard[]; mode: "view" | "pay" | "offer" | "counter"; owed?: number; onOpenHerds: () => void })`

- [ ] **Step 1: Implement** per `components/Hand/README.md` and `markup.mjs` `hand()`:
  - Notes are sorted by value, then id.
  - The herd row uses `.kh-chip`s when there are ≤ 4 types, otherwise `.herdrow.tiles` with `AnimalTile`s. Tapping the herd row calls `onOpenHerds`.
  - `mode !== "view"` adds `.picking` and enables the note buttons. On every render, write `picked.value = validPicks(picked.value, money)` if the result differs.
  - Sum caption: "Cash" in view mode; "Selected" in pay mode with `<span>/ owed</span>`; "Offer · N cards" / "Counter · N cards" otherwise (1 card → "card").
- [ ] **Step 2: Run** `npm run typecheck`. Expected: no errors.
- [ ] **Step 3: Commit** `feat(web): hand with inline note picking`

---

### Task 8: Action dock

**Files:**
- Create: `web/src/ui/table/ActionDock.tsx`, `web/src/ui/table/BidAmountSheet.tsx`
- Delete: `web/src/ui/ActionBar.tsx`, `BidControls.tsx`, `TradeWizard.tsx`, `MoneyPicker.tsx`, `MyArea.tsx`, `Countdown.tsx`, `MoneyNote.tsx`

**Interfaces:**
- Consumes: `deriveControls`, `sheetKey`, `bidStep`, `canSubmitBid`; Task 3 `tradeOptions`, `payHint`, `stepBid`; Task 4 `picked`; `autoPay` (`src/rules/payment.ts`); `sendOrToast`; Task 5 `CountdownRing`, `AnimalTile`.
- Produces:
  - `ActionDock(props: { room: RoomView; meId: string })`
  - `dockHandMode(c: Controls): "view" | "pay" | "offer" | "counter"`: exported for Table. `pay` → "pay"; `tradeSetup` with a chosen row or fixed terms → "offer"; `respond` → "counter"; everything else → "view".

- [ ] **Step 1: Implement** one view per `Controls.kind`. Markup and copy come from `markup.mjs` `dock.*`; behaviour from `components/ActionDock/README.md`:
  - Reset `picked.value = []` in an effect keyed on `sheetKey(c, deadline)`.
  - `watch`: heading `"<Name>’s move"`. Sub-line by phase: action "Choosing an action"; bidding "Bidding on <Auctioneer>’s <Animal>" (or "your <Animal>"); decision "Deciding: sell or buy"; payment "Paying <amount>"; tradeSetup "Setting up a cow trade"; tradeResponse "Answering a cow trade". Hint: "Nothing for you to do. Look busy." When `waitingOnId` is null (bluff), heading "Bluff called".
  - `turn`: Auction `<small>` "Flip the top card · N left". Cow trade `<small>` "Challenge someone for an animal", or the disabled `reason`. Sub-line "Timeout = auction" (or "Timeout = skip turn" when the deck is empty).
  - `bid`: the stepper starts at `minBid`; − / + use `stepBid`; quick buttons use `bidStep`; the Bid button reads "Bid N" and is disabled unless `canSubmitBid`. Long-press (500 ms pointerdown) on `<output>` opens `BidAmountSheet` (numeric input, Set / Cancel). Pass sends `pass`.
  - `decide`: heading "<Name> bid N"; Sell "<Name> pays you N"; Buy it "You pay <Name> N", or disabled with "You can’t cover N".
  - `pay`: the meter `--m = min(1, sel / owed)` gets `.done` when `sel >= owed`; `payHint`; Best fit sets `picked.value = autoPay(money, amount).map((c) => c.id)`; "Pay N" sends `pay` with the picked ids.
  - `tradeSetup`: rows from `tradeOptions(c.targets)` as `.kh-opt` (a `div`, not a `button`), with the ×1/×2 `.kh-seg` (×2 disabled when `maxCount < 2`). Local state `{ row, count }`. "Offer N" is enabled once a row is chosen and ≥ 1 note is picked, and sends `cowTradeOffer`. With `c.fixed`, show no rows: the hint "Repeat round: N <animal> with <Name>" plus the buttons. Cancel sends nothing; the server times the setup out as today.
  - `respond`: heading per `markup.mjs` (`"Anna wants your Pig"` / `"Anna wants your 2 Pigs"`); "Put nothing" sends `cowTradeResponse` with `[]`; "Counter N" sends the picked ids and is enabled when ≥ 1 note is picked.
  - `away`: render the existing `AwayBanner` inside `.kh-dock`.
- [ ] **Step 2: Run** `npm run typecheck && npm test`. Expected: no errors; all tests pass (`controls.test.ts` unchanged).
- [ ] **Step 3: Commit** `feat(web): action dock replaces action bar and money picker modals`

---

### Task 9: Herd board, menu and game-start intro

**Files:**
- Create: `web/src/ui/table/HerdBoard.tsx`, `web/src/ui/table/TableMenu.tsx`, `web/src/ui/table/GameStart.tsx`
- Delete: `web/src/ui/CollectionModal.tsx`, `web/src/ui/HostMenu.tsx` (its pause/close logic moves into `TableMenu`)

**Interfaces:**
- Consumes: Task 2 `boardRows`, `deckLeft`; Task 3 `intro`; Task 5 `AnimalTile`, `Note`, `CountdownRing`; `RulesScreen`, `GameLog`, `ConfirmDialog`.
- Produces:
  - `HerdBoard(props: { room: RoomView; meId: string; focusId: string | null; onClose: () => void })`
  - `TableMenu(props: { room: RoomView; isHost: boolean; onOpen: (panel: "rules" | "log" | "herds") => void; onClose: () => void })`
  - `GameStart(props: { view: View; onDone: () => void })`

- [ ] **Step 1: Implement**
  - `HerdBoard`: markup from `markup.mjs` `herdBoard()`, copy from `components/HerdBoard/README.md`. Row header: "You" or the name, then `"N set(s) · "` when sets > 0, then "M cards". The In deck row uses `deckLeft`, with `—` for 0. Tapping the backdrop or Close calls `onClose`. While the game waits on you, show a `CountdownRing` in `.bhead`.
  - `TableMenu`: `.sheet` from the existing styles, with buttons "Herds", "Rules & settings", "Log", and for the host "Pause"/"Resume" and "Close room" (the confirm dialog copy is the same as `HostMenu` today).
  - `GameStart`: markup from `markup.mjs` `intro`. Cap "Shuffled · 40 animals · 4 donkeys somewhere". Heading `<em>Name</em> goes first.` or `<em>You</em> go first.` Line "Picked at random. Complaints go to the random number generator." Then the order pills joined by `<i>→</i>`, cap "Your money", your notes (`size="sm"`) and the total. The `.kh-bar i` width animates 100% → 0 over 3000 ms (CSS transition). It calls `onDone` after 3 s or on any pointerdown.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: no errors.
- [ ] **Step 3: Commit** `feat(web): herd board, table menu and game-start intro`

---

### Task 10: Assemble the table, dev scenes, docs

**Files:**
- Modify: `web/src/ui/Table.tsx` (rewrite), `web/src/app.tsx` (dev route), `kuhhandel-spec.md` §7.3, `README.md` (playtest list)
- Create: `web/src/dev/scenes.ts`, `web/src/dev/TableScenes.tsx`
- Delete: `web/src/ui/OpponentPanel.tsx`, `web/src/ui/Center.tsx`, `web/src/ui/AnimalCard.tsx` (once nothing imports them; `EndScreen`/`Lobby` must not depend on them — check with `grep -rn` first)

**Interfaces:**
- Consumes: everything above. `revealToShow`/`markSeen` and the pause, bluff and reveal overlays as today.
- Produces: `Table(props: { room: RoomView })` (same signature); `TableScenes()`, a dev-only page at `/?table`.

- [ ] **Step 1: Rewrite `Table`:**
  - Use `fitTable` with a `ResizeObserver` on `.kh-frame` (the content box inside the safe-area padding). Render `<div class="kh-frame"><div class="kh-canvas" style={{ width, height, transform: \`scale(${scale})\` }}><div class="kh kh-table …">`.
  - The rail is `railOrder` → `SeatPod` (active = `waitingOnPublic(phase) === id`; dim = in `passed` or `excluded` during bidding/decision), then `<button class="menu" aria-label="Menu">⋯</button>`.
  - Then `LogTicker`, `Stage`, `Hand` (mode from `dockHandMode`) and `ActionDock`.
  - Panels state: `"menu" | "rules" | "log" | "herds" | null`, plus `focusId`. Tapping a pod opens the herd board focused on that player.
  - `GameStart` shows when `intro(view)` is non-null and its key isn't in a component-level `dismissed` set.
  - Keep `.paused-table` on the grid and keep the overlays outside the canvas exactly as today.
- [ ] **Step 2: Dev scenes:** `scenes.ts` exports `SCENES: Record<string, View>`, nine `View` objects matching `markup.mjs` `scenes` (intro, start, bidding, mybid, pay, setup, respond, late, board), plus `long` (five players with 16-character names, 6 animal types each, you mid-bid). `TableScenes` renders `/?table=<name>` by setting `view.value` to that scene and rendering `<Table>`. `Table` takes an optional `initialPanel` prop so the board scene can open the herd board. Gate it like `?art` with `import.meta.env.DEV`.
- [ ] **Step 3: Visual check.** Run `npm run dev:web`. For each scene, open `http://localhost:5173/?table=<name>` at a 780×360 viewport and compare it side by side with the same frame in `docs/design/kuhhandel-table/components/TableLayout/preview.html`. To render that file with art, run `node docs/design/kuhhandel-table/markup.mjs <dir>` and map `/_blob/` ids → `web/src/art` paths as listed in `markup.mjs`. Expected: same layout, colours, sizes and copy. Fix any differences in the component, never in `table.css`. Repeat `long`, `late` and `bidding` at 667×375 and 932×430. Expected: no clipping, no scrollbars, and `long` names ellipsize.
- [ ] **Step 4: Docs.** Update `kuhhandel-spec.md` §7.3:
  - Replace the positions table with: "Opponents sit in one row along the top, clockwise from the player after you."
  - Replace the opponent panel's "Animals as small cards with counts" with the ledger description from `components/SeatPod/README.md`.
  - Replace the tap-to-open collection modal with the herd board.
  - Replace "Compact money summary" with "Your money notes, always visible; tap to pick them for payments and offers".
  - Replace the corner Info/Log/Host buttons with the ⋯ menu.

  In `README.md`'s playtest list, add "Check the table on the smallest and largest phone in the group".
- [ ] **Step 5: Run** `npm run typecheck && npm test && npm run build`. Expected: no errors; all tests pass; the build succeeds.
- [ ] **Step 6: Commit** `feat(web): new game table layout matching the Kuhhandel Table design`
