# Link-Based Room Invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace room-ID + password entry with a shareable deep link and QR code; joiners type only their name, seats are auto-assigned, and room settings move to creation time.

**Architecture:** Remove password end-to-end (protocol, server hashing, client form/localStorage). Add a minimal `/join/<roomId>` path parse on load that pre-fills a join-only name form. Server auto-assigns the first open seat on join instead of accepting a requested seat. Move `moneyRule`/`decisionSeconds` from post-creation `updateSettings` into the `createRoom` message; remove `updateSettings` and its UI entirely. Extend the existing `shareText`/Share button to build a `<origin>/join/<roomId>` URL and render a QR code next to it.

**Tech Stack:** TypeScript, Preact + `@preact/signals`, Cloudflare Workers Durable Objects, Vitest. New dependency: a client-side QR code renderer (builder's choice of library).

**Spec:** `docs/superpowers/specs/2026-10-24-link-invites-design.md`

## Global Constraints

- Room ID format/length unchanged: 6 chars from `ROOM_ID_ALPHABET` (`src/rules/types.ts:12`).
- No manual room-ID or password entry anywhere, on create or join.
- Settings (`moneyRule`, `decisionSeconds`) are set only at creation and are immutable afterward; `updateSettings` intent/UI is removed, not just hidden.
- Reconnect is unaffected — it already works via the persistent per-browser token (`web/src/net/token.ts`) and must keep working exactly as today; no new reconnect logic is needed.
- A link only works while the room is in `"LOBBY"` status; joining a room that has started must fail with a clear error, not attempt to seat anyone.
- `DEFAULT_SETTINGS` (`src/rules/types.ts:21`) is removed/unused once creation always supplies explicit settings — don't leave a dead export.

## Review Focus

- A join link for a room that was already closed/cleaned up (DO storage empty) — must show a clear "room not found" state, not crash or hang on "Connecting…".
- A join link for a full room (5 players already seated) — must show a clear "room is full" error rather than throwing an unhandled seat-range error.
- A join link for a room whose status is not `"LOBBY"` (`PLAYING`/`PAUSED`/`FINISHED`) — must show "this game has already started", per Global Constraints, not attempt to join.
- Two browser tabs opening the same join link and racing to grab the last open seat — the second must get `seatTaken`-equivalent handling (now server-decided, not client-picked) without a confusing error.
- A `createRoom` message with an out-of-range `decisionSeconds` (not one of `DECISION_SECONDS`) now that it's a creation-time field instead of a post-creation `updateSettings` call — must be rejected the same way `updateSettings` rejected it (`invalid`), not silently accepted.

---

## File Structure

- Modify `src/rules/types.ts` — drop `passwordHash`/`passwordSalt` from `Room`, drop `password*` from the `Action` "create" variant and remove the "join" variant's `seat` field; add `moneyRule`/`decisionSeconds` to the "create" `Action`; remove `DEFAULT_SETTINGS` if unused after this.
- Modify `src/rules/lobby.ts` — `createRoom` takes explicit settings and drops password/seat-for-host handling as needed; `joinRoom` drops the `seat` param and auto-assigns the first open seat; remove `updateSettings`.
- Modify `src/rules/errors.ts` — drop `badPassword`, add `roomNotFound`, `roomFull`, `gameStarted` already exists (confirm wording fits join-link context).
- Modify `src/protocol.ts` — `ClientMessage` "createRoom" drops `password`, adds `moneyRule`/`decisionSeconds`; "joinRoom" drops `password`/`seat` (now just `roomId`/`playerName`); drop `updateSettings` from `ClientMessage`/`Intent` export surface it re-exports.
- Modify `src/room.ts` (`GameRoom`) — drop password hashing/verification and the `fails`/`MAX_FAILS` throttling tied to bad passwords (rename/repurpose if still needed for bad room IDs — see Task 2); `joinRoom` handler no longer takes `seat`.
- Delete `src/password.ts` and `test/server/password.test.ts` once nothing references them.
- Modify `web/src/model/lobby.ts` — `RoomFormValues` drops `password`/`roomId` (join) /`seat`, add `moneyRule`/`decisionSeconds` for create; `shareText` takes a real join URL; drop `savePassword`/`savedPassword`.
- Modify `web/src/ui/RoomForm.tsx` — create mode gets a name field + two settings selects (moved from `Lobby.tsx`); join mode becomes name-only, pre-filled `roomId` from the URL, not a typed field.
- Modify `web/src/ui/Lobby.tsx` — remove the `.settings` block and the password display; Share button builds the deep link and renders a QR code.
- Create `web/src/ui/JoinLink.tsx` (or extend `app.tsx`) — screen shown when `/join/<roomId>` is opened: name-only form, or an error state (not found / full / already started).
- Modify `web/src/app.tsx` / `web/src/main.tsx` — parse `location.pathname` for `/join/<id>` on load, route to the join-link screen instead of `Home`.
- New dependency for QR rendering — add to `package.json`; builder picks the exact library (small, no server round-trip needed since it's rendered client-side from the URL string).

## Task Breakdown

### Task 1: Drop password from rules/types, lobby, and errors

**Files:**
- Modify: `src/rules/types.ts` (`Room` at line 53-58, `Action` at line 68-72, `Settings`/`DEFAULT_SETTINGS` at line 20-21)
- Modify: `src/rules/lobby.ts` (`createRoom` line 33-48, `joinRoom` line 50-62, `updateSettings` line 87-94 — delete)
- Modify: `src/rules/errors.ts` (`ERROR_TEXT`)
- Test: `test/rules/lobby.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createRoom(a: Extract<Action, { type: "create" }>, tx: Tx): Room` where the `"create"` `Action` variant is now `{ type: "create"; token: string; roomName: string; playerName: string; moneyRule: Settings["moneyRule"]; decisionSeconds: Settings["decisionSeconds"] }` (host seat is always 1 — no `seat` field; see rationale below). `joinRoom(room: Room, a: Extract<Action, { type: "join" }>, tx: Tx): void` where the `"join"` `Action` variant is now `{ type: "join"; token: string; playerName: string }` — no `seat`. `Room` no longer has `passwordHash`/`passwordSalt`. `updateSettings` and the `"updateSettings"` `Intent` variant are deleted from `types.ts` and `lobby.ts`.

- [ ] **Step 1: Write failing tests for the new `createRoom`/`joinRoom` signatures**

In `test/rules/lobby.test.ts`, replace/add tests exercising: `createRoom` with a `moneyRule`/`decisionSeconds` pair in the action produces a `Room` whose `settings` matches those values (not `DEFAULT_SETTINGS`); `createRoom` with an invalid `decisionSeconds` (not in `DECISION_SECONDS`) throws `RuleError("invalid")`; `joinRoom` on a room with seats 1 and 2 taken assigns the new player seat 3 (first open seat, ascending) without a `seat` field in the action; `joinRoom` on a full room (seats 1-5 taken) throws `RuleError("roomFull")` (new error code, add to Step 3).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:server -- lobby`
Expected: FAIL (old signatures/behavior don't match)

- [ ] **Step 3: Implement the signature and behavior changes**

In `src/rules/types.ts`: remove `passwordHash: string; passwordSalt: string;` from `Room`; change the `"create"` `Action` variant to drop `seat: number; passwordHash: string; passwordSalt: string` and add `moneyRule: Settings["moneyRule"]; decisionSeconds: Settings["decisionSeconds"]`; change the `"join"` `Action` variant to drop `seat: number`; remove the `"updateSettings"` member from `Intent`; remove `DEFAULT_SETTINGS` (no longer referenced once `createRoom` always supplies settings).

In `src/rules/lobby.ts`: `createRoom` always seats the host at seat `1` (hosts no longer pick a seat — there's only ever one player at creation time, so "first open seat" and "seat 1" are the same thing); validate `a.moneyRule`/`a.decisionSeconds` the same way `updateSettings` used to (reuse the validation logic, inlined), throwing `RuleError("invalid")` on a bad value, and set `room.settings` from them directly instead of spreading `DEFAULT_SETTINGS`. `joinRoom` drops the `isSeat(a.seat)` check and the `seatTaken` check; instead, find the lowest seat number 1-5 not present in `room.players.map(p => p.seat)` and throw `RuleError("roomFull")` if none is free, otherwise use that seat for `newPlayer`. Delete the exported `updateSettings` function.

In `src/rules/errors.ts`: remove `badPassword`; add `roomFull: "The room is full."` and `roomNotFound: "Room not found."` to `ERROR_TEXT`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:server -- lobby`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/rules/types.ts src/rules/lobby.ts src/rules/errors.ts test/rules/lobby.test.ts
git commit -m "feat: creation-time settings and auto-assigned seats in room rules"
```

---

### Task 2: Update protocol and server (room.ts) for password-free create/join

**Files:**
- Modify: `src/protocol.ts` (`ClientMessage` line 7-11, `parseClientMessage` cases `createRoom`/`joinRoom`/`updateSettings` lines 52-73)
- Modify: `src/room.ts` (`createRoom`/`joinRoom` handlers lines 108-138, `Attachment`/`fails` throttling lines 10, 13, 118-136)
- Delete: `src/password.ts`
- Delete: `test/server/password.test.ts`
- Test: `test/protocol.test.ts`, `test/server/room.test.ts`

**Interfaces:**
- Consumes: `createRoom`/`joinRoom` from Task 1 (`Action` "create"/"join" shapes without password/seat, "create" with `moneyRule`/`decisionSeconds`).
- Produces: `ClientMessage` "createRoom" variant `{ type: "createRoom"; roomName: string; playerName: string; moneyRule: Settings["moneyRule"]; decisionSeconds: number }`; "joinRoom" variant `{ type: "joinRoom"; roomId: string; playerName: string }`. `updateSettings` removed from `ClientMessage`/`parseClientMessage`. `GameRoom.joinRoom` no longer does password verification; a `joinRoom` message for an unknown `roomId` or a room not in `"LOBBY"` status sends `sendError(ws, "roomNotFound")` / `sendError(ws, "gameStarted")` respectively instead of `badCredentials`.

- [ ] **Step 1: Write failing tests for the new protocol shapes**

In `test/protocol.test.ts`: `parseClientMessage` on `{"type":"createRoom","roomName":"x","playerName":"y","moneyRule":"swap","decisionSeconds":20}` returns that object; on the same payload with `decisionSeconds` missing or `moneyRule: "bogus"` returns `null`; `{"type":"joinRoom","roomId":"ABC123","playerName":"y"}` returns that object (no `password`/`seat` required); `{"type":"updateSettings", ...}` now returns `null` (unknown type). In `test/server/room.test.ts`: joining a room id that doesn't exist yields a `roomNotFound` error message over the socket; joining a room whose `status` is `"PLAYING"` yields `gameStarted`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:server`
Expected: FAIL

- [ ] **Step 3: Implement the protocol and server changes**

In `src/protocol.ts`: change the `ClientMessage` "createRoom"/"joinRoom" variants and their `parseClientMessage` cases to match the shapes above (validate `moneyRule` via `oneOf(m.moneyRule, ["swap","loserTakesBoth"])` and `decisionSeconds` via `num`); delete the `"updateSettings"` case (falls through to `default: return null`).

In `src/room.ts`: delete the `hashPassword`/`verifyPassword` import and all password-related code in `createRoom`/`joinRoom` handlers (lines 108-115, 117-138) and the `MAX_PASSWORD` constant. Keep the `fails`/`MAX_FAILS`/`FAIL_WINDOW_MS` throttle but key it off bad room IDs instead of bad passwords (a join attempt with a `roomId` that doesn't match `this.room?.roomId` still counts as a "fail" towards the same limiter, now guarding against join-link brute-forcing rather than password brute-forcing). `joinRoom` handler: if `this.room === null || msg.roomId.trim().toUpperCase() !== this.room.roomId` → count a fail and `sendError(ws, "roomNotFound")`; else if `this.room.status !== "LOBBY"` → `sendError(ws, "gameStarted")` (no fail counted — right room, just not joinable); else dispatch `{ type: "join", token, playerName: msg.playerName }`. `createRoom` handler: dispatch `{ type: "create", token, roomName: msg.roomName, playerName: msg.playerName, moneyRule: msg.moneyRule, decisionSeconds: msg.decisionSeconds }`, no hashing.

- [ ] **Step 4: Delete password.ts and its test**

```bash
rm src/password.ts test/server/password.test.ts
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:server`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A src/protocol.ts src/room.ts test/protocol.test.ts test/server/room.test.ts
git commit -m "feat: remove password from create/join protocol and server handling"
```

---

### Task 3: Client — creation form with settings, join-link name-only form, URL routing

**Files:**
- Modify: `web/src/model/lobby.ts` (`RoomFormValues` line 4, `formProblems` line 14-23, `shareText` line 25-27, delete `savePassword`/`savedPassword` lines 29-35)
- Modify: `web/src/ui/RoomForm.tsx`
- Modify: `web/src/ui/Lobby.tsx` (remove `.settings` block lines 67-81, remove password display line 62, update `share()`)
- Create: `web/src/ui/JoinLink.tsx`
- Modify: `web/src/app.tsx` (`Screen`/`App`), `web/src/state.ts` (`homeScreen` signal line 13)
- Test: `web/src/model/lobby.test.ts`

**Interfaces:**
- Consumes: `ClientMessage` "createRoom"/"joinRoom" shapes from Task 2; `DECISION_SECONDS` from `src/rules/types.ts`.
- Produces: `RoomFormValues` is now `{ roomName: string; playerName: string; moneyRule: "swap" | "loserTakesBoth"; decisionSeconds: number }` for create mode, used only by `RoomForm`; a new `JoinLinkValues` shape `{ playerName: string }` used by `JoinLink.tsx`. `shareText(roomId: string, url: string): string` (drops the `password` param). `homeScreen` signal gains a third state carrying the room id to join: change its type to `"home" | "create" | { join: string }` (a plain union keeps the existing `signal<...>` pattern without adding a router dependency).

- [ ] **Step 1: Write failing tests for the model changes**

In `web/src/model/lobby.test.ts`: `formProblems` for create mode with a valid `roomName`/`playerName` and no `moneyRule`/`decisionSeconds` errors (settings always have a value from the select defaults, so no new validation branch is needed — confirm existing roomName/playerName checks still pass with the trimmed-down `RoomFormValues`); `shareText("ABC123", "https://x.test/join/ABC123")` returns a string containing that exact URL and the room id, and does NOT contain the word "Password". Remove any test exercising `savePassword`/`savedPassword`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run web/src/model/lobby.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `web/src/model/lobby.ts` changes**

`RoomFormValues` becomes `{ roomName: string; playerName: string; moneyRule: "swap" | "loserTakesBoth"; decisionSeconds: number }`. `formProblems(f, mode)` for `mode === "create"` keeps the `roomName`/`playerName` checks, drops the password check, drops the join-mode `roomId` branch entirely (join mode no longer uses this function — see Step 4 below, `JoinLink.tsx` validates just the name inline or via a small sibling helper `nameProblem(name: string): string | null` returning `ERROR_TEXT.badName` or `null`). `shareText(roomId: string, url: string): string` returns `` `Join my Kuhhandel game: ${url}` `` (room id is already embedded in `url`, so it doesn't need to be printed separately — drop the standalone "Room ID: ..." line). Delete `savePassword`/`savedPassword`/`PASSWORD_KEY`.

- [ ] **Step 4: Implement `RoomForm.tsx` (create-only now), `JoinLink.tsx` (new), routing**

`RoomForm.tsx`: drop the `mode` prop (it's create-only now, or keep `mode: "create"` if you prefer not to touch call sites — builder's call); drop the Room ID / Password / Seat inputs; add two `<select>`s for `moneyRule` and `decisionSeconds` (same markup `Lobby.tsx` had at lines 67-81, `DECISION_SECONDS.map(...)`, moved here); `submit` sends `{ type: "createRoom", roomName, playerName, moneyRule: f.moneyRule, decisionSeconds: f.decisionSeconds }` with no `savePassword` call.

`JoinLink.tsx` (new component, takes `props: { roomId: string }`): single "Your name" input + submit button; on submit sends `{ type: "joinRoom", roomId: props.roomId, playerName }` via `sendOrToast`; renders any `toast.value` error the same way `RoomForm` does (a `roomNotFound`/`gameStarted` error from Task 2 surfaces here).

Routing: in `web/src/state.ts`, change `homeScreen` to `signal<"home" | "create" | { join: string }>("home")`. In `web/src/main.tsx` (or `app.tsx`'s module scope, run once before render), parse `location.pathname`: if it matches `/^\/join\/([A-Z0-9]{6})$/i`, set `homeScreen.value = { join: match[1].toUpperCase() }` before the first render. In `app.tsx`'s `Screen()`, change the `v.room === null` branch: `homeScreen.value === "home" ? <Home/> : homeScreen.value === "create" ? <RoomForm/> : <JoinLink roomId={homeScreen.value.join} />`. `Home.tsx`'s "Join room" button is removed (no more manual room-ID entry per the spec) — only "Create room" remains, plus the implicit join-via-link path.

- [ ] **Step 5: Implement `Lobby.tsx` changes**

Remove the `.settings` block (lines 67-81) and the `Password` line (62) entirely. Update `share()`: build `url = `${location.origin}/join/${room.roomId}`` and call `shareText(room.roomId, url)` (no `password()` call); drop the now-unused `password()` helper (lines 9-11) and the `savedPassword` import.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run web/src/model/lobby.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/model/lobby.ts web/src/model/lobby.test.ts web/src/ui/RoomForm.tsx web/src/ui/Lobby.tsx web/src/ui/JoinLink.tsx web/src/ui/Home.tsx web/src/app.tsx web/src/main.tsx web/src/state.ts
git commit -m "feat: name-only join-link screen and creation-time settings form"
```

---

### Task 4: QR code on the Share button

**Files:**
- Modify: `web/src/ui/Lobby.tsx` (render QR next to Share button)
- Modify: `package.json` (new dependency)
- Test: none required (purely visual; covered by existing build/typecheck)

**Interfaces:**
- Consumes: the `url` built in Task 3's `share()`/`Lobby.tsx`.
- Produces: a `<QrCode url={string} />`-shaped bit of markup rendered in `.idbox` next to the Share button (exact component boundary left to the builder — inline in `Lobby.tsx` or a tiny new `web/src/ui/QrCode.tsx` wrapper, whichever keeps `Lobby.tsx` readable).

- [ ] **Step 1: Add a QR code rendering dependency**

Builder's choice (lightweight, no network call needed — renders client-side from the URL string, e.g. an SVG/canvas QR generator package). Add it to `package.json` dependencies and install.

- [ ] **Step 2: Render the QR code in `Lobby.tsx`**

In the `.idbox` block, next to the Share button, render a QR code encoding the same `url` the Share button uses (`${location.origin}/join/${room.roomId}`). Visible to the host only (same `isHost` guard already wrapping `.idbox`).

- [ ] **Step 3: Verify visually**

Run the dev server (`npm run dev:web` + `npm run dev:server`), create a room, confirm the QR code renders and scanning it (or pasting the decoded URL) with another device/tab lands on the name-only join screen for that room.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json web/src/ui/Lobby.tsx
git commit -m "feat: show a QR code for the room invite link"
```

---

### Task 5: Typecheck and full test suite

**Files:** none (verification-only task)

- [ ] **Step 1: Run the full test suite**

Run: `npm test && npm run test:server`
Expected: PASS, including every test touched in Tasks 1-3 and any existing test incidentally referencing removed symbols (`DEFAULT_SETTINGS`, `savePassword`, `updateSettings`, `badPassword`) — fix any stragglers found.

- [ ] **Step 2: Run the typechecker**

Run: `npm run typecheck`
Expected: PASS (catches any remaining reference to removed types/fields across `src/`, the worker, and `web/`).

- [ ] **Step 3: Commit if any straggler fixes were needed**

```bash
git add -A
git commit -m "fix: clean up remaining references after password removal"
```
