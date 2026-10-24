# Join by code/QR, lobby settings, and rejoin-on-refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player join a room by typing its ID or scanning a QR code (not just via invite link), move money-rule/decision-timer settings from room creation into the lobby, raise the name-length cap to 24, and make a reload or app relaunch drop a returning player straight back into their room.

**Architecture:** Server changes are small and isolated (one new `updateSettings` intent, one dropped pair of create-time fields, one widened length limit) and land first so client work has a stable protocol to build against. Client work proceeds screen-by-screen: a new Join screen first (manual entry, then QR scanning), then the connection-lifecycle rework that makes "no target yet" and "reconnecting to a saved room" distinguishable states, then the lobby settings controls.

**Tech Stack:** TypeScript, Preact + `@preact/signals`, Cloudflare Workers/Durable Objects, Vitest. New dependency: `jsqr` (pure-JS QR decoder, paired with the browser's own `getUserMedia`/`<canvas>` for camera capture — no camera library currently installed).

**Spec:** `docs/superpowers/specs/2026-10-24-join-and-rejoin-design.md`

## Global Constraints

- Room name and player name are both 1–24 Unicode code points, trimmed, client- and server-validated (spec Goals).
- Non-host players never see lobby settings controls — absent, not read-only (spec: "What's decided" / user: "dont see them at all").
- Camera permission is requested only when "Scan QR" is tapped, never eagerly (spec Anti-goals).
- No password or other join gate is reintroduced; room ID stays the sole access control (spec Anti-goals).
- `qrcode` (generate) is already a dependency; QR *scanning* needs a new library (spec "Left to the builder" → this plan picks `jsqr`).

## Review Focus

- Scanning or typing a code for a room that's mid-game: the existing `gameStarted` terminal-error handling in `JoinLink.tsx` must still fire when reached via the new screen, not just via an invite link (Task 4, Task 3).
- A garbage/mistyped room ID (wrong length, stray characters): must surface `roomNotFound` cleanly rather than hang on "Connecting…" (Task 3).
- Camera permission denied on "Scan QR": must fall back to the manual input, not a blank or stuck screen (Task 4).
- Reloading mid-game (status `PLAYING`/`PAUSED`/`FINISHED`) with a saved session: the connect-on-demand rework must not break today's working reconnect for these statuses — only the no-saved-session, no-link case changes (Task 5).
- The host closing the room, or a player being removed, while a session is saved: the stored room ID must be cleared so a later relaunch doesn't keep trying to rejoin a dead room (Task 5).

---

## Task 1: Move settings off `createRoom`; add `updateSettings` intent (server)

**Files:**
- Modify: `src/rules/types.ts`
- Modify: `src/protocol.ts`
- Modify: `src/rules/lobby.ts`
- Modify: `src/rules/engine.ts`
- Modify: `src/room.ts`
- Modify: `test/rules/helpers.ts`
- Modify: `test/rules/lobby.test.ts`
- Modify: `test/server/room.test.ts`

**Interfaces:**
- Produces: `DEFAULT_SETTINGS: Settings` (`src/rules/types.ts`), `Action` variant `{ type: "create"; token: string; roomId: string; roomName: string; playerName: string }` (moneyRule/decisionSeconds removed), `Intent` variant `{ type: "updateSettings"; moneyRule?: Settings["moneyRule"]; decisionSeconds?: Settings["decisionSeconds"] }`, exported `updateSettings(room: Room, patch: { moneyRule?: Settings["moneyRule"]; decisionSeconds?: Settings["decisionSeconds"] }, tx: Tx): void` in `src/rules/lobby.ts`.

- [ ] **Step 1: Write failing rules tests for `updateSettings` and default-settings creation**

In `test/rules/helpers.ts`, change `createAction` to drop the settings params (it no longer carries them): `export const createAction = (name = "Anna"): Action => ({ type: "create", token: tok(name), roomId: "ab12cd", roomName: "Barn", playerName: name });`. Add a helper `updateSettingsAction = (name: string, patch: { moneyRule?: unknown; decisionSeconds?: unknown }): Action => ({ type: "intent", token: tok(name), intent: { type: "updateSettings", ...patch } as never })`.

In `test/rules/lobby.test.ts`, replace the two settings-related `it`s under "stores the given room ID…" with:
```ts
it("creates a room with default settings", () => {
  const r = run(null, createAction())!;
  expect(r.settings).toEqual({ moneyRule: "swap", decisionSeconds: 20 });
});
it("lets the host update settings in the lobby, partially or fully, before the game starts", () => {
  let r = run(lobby(), updateSettingsAction("Anna", { decisionSeconds: 60 }))!;
  expect(r.settings).toEqual({ moneyRule: "swap", decisionSeconds: 60 });
  r = run(r, updateSettingsAction("Anna", { moneyRule: "loserTakesBoth", decisionSeconds: 10 }))!;
  expect(r.settings).toEqual({ moneyRule: "loserTakesBoth", decisionSeconds: 10 });
});
it("rejects invalid settings on update, and rejects non-host or mid-game updates", () => {
  expect(fail(lobby(), updateSettingsAction("Anna", { decisionSeconds: 15 }))).toBe("invalid");
  expect(fail(lobby(), updateSettingsAction("Anna", { moneyRule: "bogus" as never }))).toBe("invalid");
  expect(fail(lobby(), updateSettingsAction("Ben", { decisionSeconds: 60 }))).toBe("notHost");
});
```
(The old "refuses a second room and joining a missing room" test's `createAction("Zed")` call keeps working unchanged since it only drops unused fields.)

- [ ] **Step 2: Run `npm test -- lobby.test.ts` and confirm the new/changed tests fail** (missing `updateSettings` export, `createAction` signature mismatch, etc.)

- [ ] **Step 3: Add `DEFAULT_SETTINGS` to `src/rules/types.ts`**

Add near the `Settings` interface: `export const DEFAULT_SETTINGS: Settings = { moneyRule: "swap", decisionSeconds: 20 };`. Change the `Action` union's `"create"` member to drop `moneyRule`/`decisionSeconds`. Add to the `Intent` union: `| { type: "updateSettings"; moneyRule?: Settings["moneyRule"]; decisionSeconds?: Settings["decisionSeconds"] }`.

- [ ] **Step 4: Update `src/rules/lobby.ts`**

`createRoom()`: drop the `validateSettings(...)` call and the `moneyRule`/`decisionSeconds` destructuring; set `settings: DEFAULT_SETTINGS` directly in the returned `Room`. Keep `validateSettings` (private) as-is — it's now called only from the new function below. Add:
```ts
export function updateSettings(room: Room, patch: { moneyRule?: Settings["moneyRule"]; decisionSeconds?: Settings["decisionSeconds"] }, tx: Tx): void {
  room.settings = validateSettings(patch.moneyRule ?? room.settings.moneyRule, patch.decisionSeconds ?? room.settings.decisionSeconds);
  addLog(room, "Room settings were updated.");
}
```

- [ ] **Step 5: Wire the intent in `src/rules/engine.ts`**

Import `updateSettings` from `./lobby`. Add a case to `applyIntent`'s switch, placed with the other lobby-only intents: `case "updateSettings": needLobby(room); requireHost(room, p); updateSettings(room, i, tx); return room;`

- [ ] **Step 6: Update `src/room.ts`'s `createRoom` handler**

Drop reading `msg.moneyRule`/`msg.decisionSeconds`; the dispatch becomes `await this.dispatch({ type: "create", token, roomId: this.ctx.id.name ?? "main", roomName: msg.roomName, playerName: msg.playerName }, now, ws);`. Remove the now-unused `Settings` import if nothing else in the file uses it.

- [ ] **Step 7: Update `src/protocol.ts`**

Change the `ClientMessage` `"createRoom"` variant to `{ type: "createRoom"; roomName: string; playerName: string }`. In `parseClientMessage`, update the `"createRoom"` case to stop reading/validating `moneyRule`/`decisionSeconds`, and add a `"updateSettings"` case:
```ts
case "updateSettings":
  return (m.moneyRule === undefined || oneOf(m.moneyRule, ["swap", "loserTakesBoth"] as const))
      && (m.decisionSeconds === undefined || num(m.decisionSeconds))
    ? { type: "updateSettings", moneyRule: m.moneyRule as Settings["moneyRule"] | undefined, decisionSeconds: m.decisionSeconds as number | undefined }
    : null;
```

- [ ] **Step 8: Run `npm test -- lobby.test.ts` and confirm all pass**

- [ ] **Step 9: Update `test/server/room.test.ts`**

Change the `create` const to drop `moneyRule`/`decisionSeconds`: `{ type: "createRoom", roomName: "B", playerName: "Zed" } as const`. Replace the "rejects createRoom with an invalid decisionSeconds" test with one that creates a room then sends `{ type: "updateSettings", decisionSeconds: 15 }` and expects an `invalid` error (matching the new validation point).

- [ ] **Step 10: Run `npm run test:server` and confirm it passes**

- [ ] **Step 11: Typecheck and run the full suite**

Run: `npm run typecheck && npm test && npm run test:server`
Expected: all pass, no type errors.

- [ ] **Step 12: Commit**

```bash
git add src/rules/types.ts src/protocol.ts src/rules/lobby.ts src/rules/engine.ts src/room.ts test/rules/helpers.ts test/rules/lobby.test.ts test/server/room.test.ts
git commit -m "feat: move room settings from creation into a host-only lobby update"
```

---

## Task 2: Raise the name limit from 16 to 24 characters

**Files:**
- Modify: `src/rules/lobby.ts`
- Modify: `src/rules/errors.ts`
- Modify: `web/src/model/lobby.ts`
- Modify: `web/src/ui/RoomForm.tsx`
- Modify: `web/src/ui/JoinLink.tsx`
- Modify: `test/rules/lobby.test.ts`
- Modify: `web/src/model/lobby.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: no new exports; same function names (`normalizeName`, `formProblems`, `nameProblem`), new limit value.

- [ ] **Step 1: Update the failing server test**

In `test/rules/lobby.test.ts`, rename/replace "enforces 1–16 character names counted in code points" with:
```ts
it("enforces 1-24 character names counted in code points", () => {
  for (const bad of ["", "   ", "x".repeat(25)]) expect(fail(lobby(["Anna"]), joinAction(bad))).toBe("badName");
  expect(run(lobby(["Anna"]), joinAction("🐄".repeat(24)))).not.toBeNull();
});
```

- [ ] **Step 2: Run `npm test -- lobby.test.ts` and confirm it fails** (still enforcing 16)

- [ ] **Step 3: Bump the limit in `src/rules/lobby.ts`**

In `createRoom()` and `joinRoom()`, change `normalizeName(a.playerName, 16)` to `normalizeName(a.playerName, 24)` (both call sites).

- [ ] **Step 4: Update the error copy in `src/rules/errors.ts`**

Change `badName: "Names must be 1–16 characters."` to `badName: "Names must be 1–24 characters."`

- [ ] **Step 5: Run `npm test -- lobby.test.ts` and confirm it passes**

- [ ] **Step 6: Update the failing client test**

In `web/src/model/lobby.test.ts`, add: `it("allows names up to 24 characters and rejects 25", () => { expect(nameProblem("x".repeat(24))).toBeNull(); expect(nameProblem("x".repeat(25))).toBe(ERROR_TEXT.badName); });` (import `nameProblem` alongside the existing imports from `./lobby`).

- [ ] **Step 7: Run `npm test -- web/src/model/lobby.test.ts` and confirm it fails**

- [ ] **Step 8: Bump the limits in `web/src/model/lobby.ts`**

In `formProblems`, change `within(f.playerName.trim(), 1, 16)` to `within(f.playerName.trim(), 1, 24)`. In `nameProblem`, change `within(playerName.trim(), 1, 16)` to `within(playerName.trim(), 1, 24)`.

- [ ] **Step 9: Add `maxLength={24}` to the player-name inputs**

In `web/src/ui/RoomForm.tsx`, add `maxLength={24}` to the "Your name" `<input>` (it currently has none; the room-name input already has `maxLength={24}`). In `web/src/ui/JoinLink.tsx`, add `maxLength={24}` to its "Your name" `<input>`.

- [ ] **Step 10: Run `npm test` and confirm everything passes**

- [ ] **Step 11: Commit**

```bash
git add src/rules/lobby.ts src/rules/errors.ts web/src/model/lobby.ts web/src/ui/RoomForm.tsx web/src/ui/JoinLink.tsx test/rules/lobby.test.ts web/src/model/lobby.test.ts
git commit -m "feat: raise the name length limit from 16 to 24 characters"
```

---

## Task 3: Join screen — manual room-ID entry

**Files:**
- Modify: `web/src/state.ts`
- Modify: `web/src/ui/Home.tsx`
- Modify: `web/src/app.tsx`
- Create: `web/src/ui/JoinRoom.tsx`
- Create: `web/src/ui/JoinRoom.test.tsx` (if a `.tsx` test convention isn't already used elsewhere, use `web/src/ui/JoinRoom.test.ts` with `@testing-library/preact`-free, logic-only tests — see Step 1; check for an existing `.tsx`-rendering test before deciding, per Step 0)

**Interfaces:**
- Consumes: `normalizeRoomId(input: string): string` and `nameProblem` (unused here) from `web/src/model/lobby.ts`; `homeScreen` signal from `web/src/state.ts`; `startConnection(forRoomId: string): void` from `web/src/net/socket.ts`.
- Produces: `homeScreen` signal's type widens to `"home" | "create" | "join" | { join: string }`; `JoinRoom()` component, rendered by `app.tsx` when `homeScreen.value === "join"`.

- [ ] **Step 0: Check for an existing UI-component test convention**

Run: `grep -rl "render(" web/src/ui/*.test.* 2>/dev/null || true`
If no `.tsx`/`.ts` UI test using a render helper exists yet, this task keeps `JoinRoom.tsx` thin (just wiring) and tests only the pure logic it calls (`normalizeRoomId`, already tested in `web/src/model/lobby.test.ts`) — no new render-based test is added, matching the existing codebase's convention of not render-testing Preact components (e.g. `RoomForm.tsx`, `JoinLink.tsx` have no component tests today, only their model-layer logic does). Delete the `JoinRoom.test.tsx`/`.test.ts` entry from the Files list above; this step replaces it.

- [ ] **Step 1: Widen the `homeScreen` signal type**

In `web/src/state.ts`, change `export const homeScreen = signal<"home" | "create" | { join: string }>("home");` to `export const homeScreen = signal<"home" | "create" | "join" | { join: string }>("home");`

- [ ] **Step 2: Add the "Join Room" button to `Home.tsx`**

In `web/src/ui/Home.tsx`, add a second button in the existing `.row` div: `<button onClick={() => { toast.value = null; homeScreen.value = "join"; }}>Join room</button>`

- [ ] **Step 3: Create `web/src/ui/JoinRoom.tsx`**

A form matching the existing `RoomForm.tsx`/`JoinLink.tsx` style: one text input for the room ID, a "Join" submit button next to it, and (for now, until Task 4) no scan button — Task 4 adds a `"Scan QR"` button in a row underneath. On submit: normalize the input with `normalizeRoomId`, reject empty input with a local `problem` message (reuse the pattern from `JoinLink.tsx`'s `problem` state — "Enter a room ID."), otherwise call `startConnection(normalized)` then set `homeScreen.value = { join: normalized }` (handing off into the existing `JoinLink` screen, which collects the player's name and sends `joinRoom`). Include a "Back" button returning `homeScreen.value = "home"`, matching the other forms' convention.

```tsx
import { useState } from "preact/hooks";
import { normalizeRoomId } from "../model/lobby";
import { startConnection } from "../net/socket";
import { homeScreen, toast } from "../state";

export function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (e: Event) => {
    e.preventDefault();
    toast.value = null;
    const normalized = normalizeRoomId(roomId);
    if (normalized.length === 0) { setProblem("Enter a room ID."); return; }
    setProblem(null);
    startConnection(normalized);
    homeScreen.value = { join: normalized };
  };

  return (
    <form class="form" onSubmit={submit}>
      <h2>Join room</h2>
      <div class="row">
        <input placeholder="Room ID" value={roomId} onInput={(e) => { setProblem(null); setRoomId(e.currentTarget.value); }} />
        <button type="submit">Join</button>
      </div>
      {problem && <p class="error">{problem}</p>}
      <div class="row">
        <button type="button" class="link" onClick={() => { toast.value = null; homeScreen.value = "home"; }}>Back</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Wire it into `web/src/app.tsx`**

Import `JoinRoom`. In `Screen()`'s `v.room === null` branch, add a case: `if (screen === "join") return <JoinRoom />;` (alongside the existing `"home"`/`"create"` checks, before the final `JoinLink` fallback).

- [ ] **Step 5: Typecheck and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: all pass (no new tests were added per Step 0's finding; this step confirms nothing broke).

- [ ] **Step 6: Commit**

```bash
git add web/src/state.ts web/src/ui/Home.tsx web/src/ui/JoinRoom.tsx web/src/app.tsx
git commit -m "feat: add a Join Room screen for typing in a room ID"
```

---

## Task 4: QR camera scanning on the Join screen

**Files:**
- Modify: `package.json` (add `jsqr` dependency)
- Modify: `web/src/ui/JoinRoom.tsx`
- Create: `web/src/ui/QrScanner.tsx`
- Create: `web/src/model/qrLink.ts`
- Create: `web/src/model/qrLink.test.ts`

**Interfaces:**
- Consumes: the existing invite-link shape `${location.origin}/join/<roomId>` (from `web/src/ui/Lobby.tsx`'s `share()`) and the `/^\/join\/([A-Z0-9]{6})$/i` pattern already used in `web/src/main.tsx`.
- Produces: `extractRoomId(url: string): string | null` in `web/src/model/qrLink.ts` (parses a scanned URL string — or a bare room-ID string — into a normalized room ID, or `null` if it's neither); `QrScanner(props: { onResult: (roomId: string) => void; onCancel: () => void })` component in `web/src/ui/QrScanner.tsx`.

- [ ] **Step 1: Install `jsqr`**

Run: `npm install jsqr && npm install -D @types/jsqr` (check first whether `@types/jsqr` exists on npm; if not, add a local `declare module "jsqr"` ambient type instead — mirror how the repo already handles `qrcode`/`@types/qrcode` if a types package isn't published).

- [ ] **Step 2: Write the failing test for `extractRoomId`**

Create `web/src/model/qrLink.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { extractRoomId } from "./qrLink";

describe("extractRoomId", () => {
  it("extracts the room id from a join link, case-insensitively", () => {
    expect(extractRoomId("https://x.test/join/ab12cd")).toBe("AB12CD");
    expect(extractRoomId("https://x.test/join/AB12CD")).toBe("AB12CD");
  });
  it("accepts a bare room id with no link", () => expect(extractRoomId("AB12CD")).toBe("AB12CD"));
  it("rejects anything else", () => {
    expect(extractRoomId("https://x.test/")).toBeNull();
    expect(extractRoomId("not a url or code")).toBeNull();
    expect(extractRoomId("")).toBeNull();
  });
});
```

- [ ] **Step 3: Run `npm test -- qrLink.test.ts` and confirm it fails** (module doesn't exist)

- [ ] **Step 4: Implement `web/src/model/qrLink.ts`**

```ts
const LINK_PATTERN = /\/join\/([A-Z0-9]{6})$/i;
const BARE_PATTERN = /^[A-Z0-9]{6}$/i;

export function extractRoomId(scanned: string): string | null {
  const link = LINK_PATTERN.exec(scanned.trim());
  if (link) return link[1]!.toUpperCase();
  const bare = scanned.trim().toUpperCase();
  return BARE_PATTERN.test(bare) ? bare : null;
}
```

- [ ] **Step 5: Run `npm test -- qrLink.test.ts` and confirm it passes**

- [ ] **Step 6: Create `web/src/ui/QrScanner.tsx`**

A component that, on mount, requests the camera (`navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`), streams it into a `<video>`, and on a `requestAnimationFrame` loop draws each frame into an offscreen `<canvas>`, runs `jsQR` on the pixel data, and calls `props.onResult(roomId)` via `extractRoomId` the first time a frame decodes to a non-null result (then stops the loop and the stream's tracks). If `getUserMedia` rejects (permission denied, no camera), call `props.onCancel()` immediately so the caller falls back to manual entry instead of showing a broken view. Clean up the stream and the animation-frame loop on unmount.

```tsx
import { useEffect, useRef } from "preact/hooks";
import jsQR from "jsqr";
import { extractRoomId } from "../model/qrLink";

export function QrScanner(props: { onResult: (roomId: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const tick = () => {
      const video = videoRef.current;
      if (done || !video || !ctx || video.readyState !== video.HAVE_ENOUGH_DATA) { raf = requestAnimationFrame(tick); return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height);
      const roomId = code ? extractRoomId(code.data) : null;
      if (roomId) { done = true; props.onResult(roomId); return; }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play(); }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => props.onCancel());

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div class="qr-scanner">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live camera preview, no captions apply */}
      <video ref={videoRef} playsInline muted />
      <button type="button" class="link" onClick={props.onCancel}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 7: Wire `QrScanner` into `JoinRoom.tsx`**

Add a `scanning` boolean state (`useState(false)`). Below the existing input/Join row, add a second row: `<div class="row"><button type="button" onClick={() => setScanning(true)}>Scan QR</button></div>`. When `scanning` is true, render `<QrScanner onResult={(roomId) => { setScanning(false); startConnection(roomId); homeScreen.value = { join: roomId }; }} onCancel={() => setScanning(false)} />` instead of the form.

- [ ] **Step 8: Typecheck and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 9: Manual check in a browser**

Run the dev server (`npm run dev:web`), open the Join screen, tap "Scan QR", confirm the camera permission prompt appears and a live preview renders. (Decoding against a real QR code needs a second device/host room; confirming the permission flow and preview is sufficient here — full join-by-scan is exercised end-to-end once Task 5/6 land.)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json web/src/ui/QrScanner.tsx web/src/ui/JoinRoom.tsx web/src/model/qrLink.ts web/src/model/qrLink.test.ts
git commit -m "feat: scan a QR code to join a room"
```

---

## Task 5: Connect-on-demand and rejoin-on-refresh

**Files:**
- Create: `web/src/net/roomSession.ts`
- Create: `web/src/net/roomSession.test.ts`
- Modify: `web/src/state.ts`
- Modify: `web/src/main.tsx`
- Modify: `web/src/app.tsx`
- Modify: `web/src/ui/Home.tsx`

**Interfaces:**
- Consumes: `view` and `conn` signals (`web/src/state.ts`); `startConnection` (`web/src/net/socket.ts`); `newRoomId` (`web/src/net/roomId.ts`).
- Produces: `loadRoomId(store: Pick<Storage, "getItem"> | null): string | null`, `saveRoomId(store: Pick<Storage, "setItem"> | null, roomId: string): void`, `clearRoomId(store: Pick<Storage, "removeItem"> | null): void` in `web/src/net/roomSession.ts`; `conn` signal's type widens to include `"idle"`, defaulting to it.

- [ ] **Step 1: Write the failing tests for `roomSession.ts`**

Create `web/src/net/roomSession.test.ts`, mirroring `web/src/net/token.test.ts`'s style:
```ts
import { expect, it } from "vitest";
import { clearRoomId, loadRoomId, saveRoomId } from "./roomSession";

it("saves, reloads, and clears a room id", () => {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  expect(loadRoomId(store)).toBeNull();
  saveRoomId(store, "AB12CD");
  expect(loadRoomId(store)).toBe("AB12CD");
  clearRoomId(store);
  expect(loadRoomId(store)).toBeNull();
});
it("never throws without usable storage", () => {
  expect(loadRoomId(null)).toBeNull();
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  expect(loadRoomId(blocked)).toBeNull();
  expect(() => saveRoomId(blocked, "AB12CD")).not.toThrow();
  expect(() => clearRoomId(blocked)).not.toThrow();
});
```

- [ ] **Step 2: Run `npm test -- roomSession.test.ts` and confirm it fails**

- [ ] **Step 3: Implement `web/src/net/roomSession.ts`**

```ts
const KEY = "kuhhandel.roomId";

export function loadRoomId(store: Pick<Storage, "getItem"> | null): string | null {
  try { return store?.getItem(KEY) ?? null; } catch { return null; }
}
export function saveRoomId(store: Pick<Storage, "setItem"> | null, roomId: string): void {
  try { store?.setItem(KEY, roomId); } catch { /* ignore */ }
}
export function clearRoomId(store: Pick<Storage, "removeItem"> | null): void {
  try { store?.removeItem(KEY); } catch { /* ignore */ }
}
```

- [ ] **Step 4: Run `npm test -- roomSession.test.ts` and confirm it passes**

- [ ] **Step 5: Widen the `conn` signal and update `app.tsx`'s routing**

In `web/src/state.ts`, change `export const conn = signal<"connecting" | "online" | "offline" | "replaced">("connecting");` to `export const conn = signal<"idle" | "connecting" | "online" | "offline" | "replaced">("idle");`

In `web/src/app.tsx`, factor the four pre-room screens into a helper and use it from two call sites:
```tsx
function PreRoomScreen() {
  const screen = homeScreen.value;
  if (screen === "home") return <Home />;
  if (screen === "create") return <RoomForm />;
  if (screen === "join") return <JoinRoom />;
  return <JoinLink roomId={screen.join} />;
}

function Screen() {
  if (conn.value === "replaced") { /* unchanged */ }
  if (conn.value === "idle") return <PreRoomScreen />;
  const v = view.value;
  if (v === null) return <div class="center">Connecting…</div>;
  if (v.room === null) return <PreRoomScreen />;
  /* unchanged: badge + switch on v.room.status */
}
```
(Keep the existing `"replaced"` block's JSX body as-is; only the surrounding branching changes.)

- [ ] **Step 6: Update `web/src/main.tsx`'s startup logic**

Replace the current unconditional `newRoomId()` + `startConnection(roomId)` block with:
```ts
const joinMatch = /^\/join\/([A-Z0-9]{6})$/i.exec(location.pathname);
const storage = (): Storage | null => { try { return localStorage; } catch { return null; } };

if (joinMatch) {
  const roomId = joinMatch[1]!.toUpperCase();
  homeScreen.value = { join: roomId };
  startConnection(roomId);
} else {
  const saved = loadRoomId(storage());
  if (saved) startConnection(saved);
  // else: no target yet — conn stays "idle", Screen() shows Home until Create/Join picks a room.
}
```
Import `loadRoomId` (and, for Step 7, `saveRoomId`/`clearRoomId`) from `./net/roomSession`. Remove the now-unused `newRoomId` import from `main.tsx` (it moves to `Home.tsx` in Step 8).

- [ ] **Step 7: Persist the current room id as the view changes**

In `web/src/main.tsx`, add alongside the existing `effect(...)` calls:
```ts
let lastRoomId: string | null = null;
effect(() => {
  const roomId = view.value?.room?.roomId ?? null;
  if (roomId === lastRoomId) return;
  lastRoomId = roomId;
  if (roomId) saveRoomId(storage(), roomId); else clearRoomId(storage());
});
```
This covers every case that clears the stored room id (host closes it, this player is removed, this player leaves their seat) because each ends with a `"view"` message where `view.room` is `null` for this socket — no per-action special-casing is needed.

- [ ] **Step 8: Make "Create Room" open its own connection**

In `web/src/ui/Home.tsx`, import `newRoomId` from `../net/roomId` and `startConnection` from `../net/socket`. Change the "Create room" button's `onClick` to `() => { toast.value = null; startConnection(newRoomId()); homeScreen.value = "create"; }` (today it only sets `homeScreen.value`, relying on `main.tsx`'s now-removed eager connection).

- [ ] **Step 9: Run the full test suite, including `socket.test.ts`**

Run: `npm run typecheck && npm test`
Expected: all pass. Check in particular that `web/src/net/socket.test.ts`'s existing tests (which call `startConnection("main")` directly) still pass unchanged — they exercise `socket.ts` directly and don't depend on `main.tsx`'s startup branching.

- [ ] **Step 10: Manual check — fresh load, create, reload**

Run `npm run dev:web` and `npm run dev:server` (or the project's existing combined dev command). Load the app fresh (clear site data first): confirm Home appears immediately, with no "Connecting…" hang. Create a room, confirm the Lobby appears. Reload the tab: confirm it reconnects straight into the same Lobby/seat, without touching Home.

- [ ] **Step 11: Commit**

```bash
git add web/src/net/roomSession.ts web/src/net/roomSession.test.ts web/src/state.ts web/src/main.tsx web/src/app.tsx web/src/ui/Home.tsx
git commit -m "feat: connect on demand and rejoin the last room on reload"
```

---

## Task 6: Lobby settings UI

**Files:**
- Modify: `web/src/ui/Lobby.tsx`
- Modify: `web/src/ui/RoomForm.tsx`
- Modify: `web/src/model/lobby.ts`
- Modify: `web/src/model/lobby.test.ts`

**Interfaces:**
- Consumes: `RoomView["settings"]: Settings` (already on the wire via `src/protocol.ts`'s `RoomView`); `Settings["moneyRule"]`/`Settings["decisionSeconds"]` types and `DECISION_SECONDS` constant (`src/rules/types.ts`).
- Produces: no new exported functions; `RoomFormValues` in `web/src/model/lobby.ts` drops `moneyRule`/`decisionSeconds`, and `formProblems`'s signature/behavior for those fields goes away (name/room-name checks unchanged).

- [ ] **Step 1: Write the failing test for the trimmed `RoomFormValues`/`formProblems`**

In `web/src/model/lobby.test.ts`, change the "checks create forms against the server limits" test to drop the settings fields from the literals: `formProblems({ roomName: "", playerName: " " }, "create")` and `formProblems({ roomName: "Barn", playerName: "Ben" }, "create")`.

- [ ] **Step 2: Run `npm test -- lobby.test.ts` (web) and confirm it fails** (type error: `RoomFormValues` still requires the dropped fields)

- [ ] **Step 3: Trim `RoomFormValues` and `formProblems` in `web/src/model/lobby.ts`**

Change `export interface RoomFormValues { roomName: string; playerName: string; moneyRule: "swap" | "loserTakesBoth"; decisionSeconds: number }` to `export interface RoomFormValues { roomName: string; playerName: string }`. `formProblems`'s body is unchanged (it never read those two fields).

- [ ] **Step 4: Run `npm test -- lobby.test.ts` (web) and confirm it passes**

- [ ] **Step 5: Simplify `RoomForm.tsx`**

Remove the money-rule and decision-seconds `<select>`s and their `.row`, the `DECISION_SECONDS` import, and the two fields from the `useState` initializer (`{ roomName: "", playerName: "" }`) and from the `createRoom` message sent on submit (it already only needs `roomName`/`playerName` after Task 1).

- [ ] **Step 6: Add host-only settings controls to `web/src/ui/Lobby.tsx`**

Inside the existing `isHost && (...)` block that renders `.idbox` (room ID/Share/QR), add a second host-only block (new `.row`, placed above or below `.idbox` — implementation's call) with the two controls, same options as the old `RoomForm.tsx` had:
```tsx
{isHost && (
  <div class="row">
    <label>Cow trade money
      <select value={room.settings.moneyRule}
        onChange={(e) => sendOrToast({ type: "updateSettings", moneyRule: e.currentTarget.value as "swap" | "loserTakesBoth" })}>
        <option value="swap">Swap</option>
        <option value="loserTakesBoth">Loser takes both</option>
      </select>
    </label>
    <label>Time per decision
      <select value={room.settings.decisionSeconds}
        onChange={(e) => sendOrToast({ type: "updateSettings", decisionSeconds: Number(e.currentTarget.value) })}>
        {DECISION_SECONDS.map((s) => <option value={s}>{s} s</option>)}
      </select>
    </label>
  </div>
)}
```
Import `DECISION_SECONDS` from `../../../src/rules/types` in `Lobby.tsx`. Non-host players get neither block — confirmed by the surrounding `isHost &&` guard, matching how `.idbox` is already hidden from them.

- [ ] **Step 7: Typecheck and run the full suite**

Run: `npm run typecheck && npm test && npm run test:server`
Expected: all pass.

- [ ] **Step 8: Manual check**

`npm run dev:web` + `npm run dev:server`: create a room, confirm the Lobby (host view) shows the two settings controls and changing one updates immediately (e.g. the decision timer takes effect once the game starts). Join as a second player (second browser/profile) and confirm that view shows no settings controls at all.

- [ ] **Step 9: Commit**

```bash
git add web/src/ui/Lobby.tsx web/src/ui/RoomForm.tsx web/src/model/lobby.ts web/src/model/lobby.test.ts
git commit -m "feat: move room settings from the create form into the lobby"
```
