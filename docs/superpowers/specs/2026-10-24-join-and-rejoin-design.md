# Join by code/QR, lobby settings, and rejoin-on-refresh

## Intent

Today the only way into a room is the invite link — if someone installs
the app, quits it, and comes back later (no link in hand, e.g. opening
the installed app icon directly), they have no way back in. This change
adds a real "Join Room" path (type a room ID, or scan a QR code), moves
room settings off the create form and into the lobby, and makes a reload
or app relaunch drop a returning player straight back into their room
instead of the home screen.

## Goals

- From the home screen, a player can choose "Create Room" or "Join
  Room" without needing a link.
- "Join Room" lets them either type a room ID or scan a QR code with
  the device camera.
- Creating a room only asks for room name + player name. Money rule and
  decision timer are set afterward, in the lobby, by the host.
- Room name and player name both allow up to 24 characters, trimmed.
- Reloading the page, or relaunching the installed app, reconnects the
  player to the room and seat they were last in, with no re-entry of
  room ID or name.

## Non-goals

- No change to the existing link/QR-on-the-host-side invite flow
  (`Lobby.tsx` Share button + QR code) — that stays as-is, as another
  way to get a room ID.
- No account system; identity is still the existing per-browser token,
  not tied to a login.
- No change to in-game rules, scoring, or seat-assignment logic once a
  player is in a room.

## Anti-goals

- Don't bring back a password or any other join gate — room ID is
  still the only thing needed to join, per the existing invite-link
  design.
- Don't let non-host players see or edit lobby settings — they should
  not appear for them at all until the game starts.
- Don't block the UI on camera permission before the player has chosen
  to scan — only request camera access when "Scan QR" is tapped.

## Current state (for reference)

- Home screen (`web/src/ui/Home.tsx`) has one button, "Create room" —
  no "Join room" entry point exists today.
- Join only happens via `/join/<roomId>` (`web/src/ui/JoinLink.tsx`),
  reached by opening the host's shared link/QR. There is no screen to
  type a room ID, and no in-app camera QR scanner (`qrcode` package is
  generate-only).
- `RoomForm.tsx` + `web/src/model/lobby.ts` `formProblems()` collects
  room name (1–24 chars, already correct), player name (1–16 chars —
  needs to become 1–24), money rule, and decision seconds, all at
  create time. `nameProblem()` (used by the join flow) enforces the
  same 1–16 limit on name.
- Settings (`moneyRule`, `decisionSeconds`) are chosen on the create
  form and sent in the `createRoom` message (`src/protocol.ts`). There
  is no `updateSettings` message type and no settings UI in
  `Lobby.tsx` — settings are create-time-only and immutable thereafter.
- Reconnect-by-token already works end-to-end: `web/src/net/token.ts`
  persists a UUID in `localStorage["kuhhandel.token"]`; every socket
  open sends `{type: "hello", clientToken}` (`src/room.ts` `hello()`),
  and the server rebinds the existing seat to the new socket. What's
  missing is the *room ID* — nothing in `localStorage` records which
  room a player was last in, so on a fresh load there's no room to
  reconnect to; `socket.ts` falls back to a hardcoded default (`"main"`).

## What's decided

**Home screen**: two buttons, "Create Room" and "Join Room", replacing
today's single "Create room" button.

**Create screen**: room name + player name only, both trimmed, both
1–24 characters (raise `nameProblem()`/`formProblems()`'s player-name
limit from 16 to 24, add `maxLength={24}` to the player-name input to
match the existing room-name input). No money rule or decision-seconds
picker here anymore — `createRoom` is sent with just the two names, and
the server applies `DEFAULT_SETTINGS` until the host changes them.

**Join screen** (new): a room-ID text input with a "Join" button next
to it, and below that row, a "Scan QR" button. Tapping "Scan QR" opens
the device camera (requesting permission at that point, not before)
and, on a successful scan of a URL matching `/join/<roomId>`, extracts
the room ID and proceeds exactly as if it had been typed — sharing one
join code path rather than two. Manual entry runs through the existing
`normalizeRoomId()` (strip spaces/dashes, uppercase) before submit.

**Lobby settings** (new): the host sees money-rule and decision-seconds
controls in the lobby (pre-game only), editable until the game starts.
Changing one sends a new `updateSettings` message
(`{type: "updateSettings", moneyRule?, decisionSeconds?}`); the server
validates and applies it to room state (mirroring the existing
`createRoom` validation for these two fields) and broadcasts the
updated room view. Non-host players never see these controls — not
grayed out, not read-only, simply absent from their view.

**Rejoin-on-refresh**: alongside the existing token, persist the
current room ID in `localStorage` whenever a player is in a room
(set on entering a room via create/join, cleared on leaving/room
closing). On app load, if both a token and a stored room ID are
present, connect directly to that room (skip Home/Create/Join
entirely) and let the existing token-based `hello` reconnect flow seat
them. Today, `connect`/`hello` silently no-op when the room doesn't
exist or the token isn't a seated player (`src/rules/engine.ts`
`apply()`, `src/rules/lobby.ts` `setConnected()`) — there's no error
path to hang "room no longer exists" off of. This needs a real
`roomNotFound`-style error added to that path (mirroring the existing
check already used by `joinRoom`), so the client can tell "still
connecting" apart from "stored room is gone" and fall back to Home
with a notice, clearing the stale stored room ID, instead of hanging.

Relatedly, `socket.ts`'s hardcoded `roomId = "main"` default (used
today when no room is specified) no longer makes sense once Home
offers Create/Join instead of implying one shared room — a fresh
browser with no stored room ID should not open any socket until the
player picks Create or Join. That default is removed as part of this
change.

The new Join screen (room-ID input + Join button + Scan QR) only
collects the room ID; it hands off into the existing `JoinLink.tsx`
screen (already wired to a `{join: roomId}` state) to collect the
player's name and send `joinRoom`, the same way opening an invite link
does today. `JoinLink.tsx` itself doesn't need to change — the new
screen is just a second way to reach it.

## Left to the builder

- Exact camera-scanning library (none installed today); a lightweight
  browser-camera QR reader (e.g. `jsqr` + `getUserMedia`, or
  `@zxing/library`) — implementation's call based on bundle size/API
  fit.
- Layout of the Join screen (input + button row, "Scan QR" row below)
  and of the new Lobby settings controls — should read as intentional,
  not bolted on; specific styling is implementation's call.
- Exact `updateSettings` validation/error surfacing (e.g. rejecting a
  change once the game has started, if that's even reachable given the
  host-only + pre-game-only UI gating).
- Camera-permission-denied handling on the Join screen (e.g. falling
  back to showing just the manual input) — not discussed with the user
  but required for correctness.
- Whether the stored room ID should also be cleared client-side on an
  explicit "leave room" action, if/when one exists — current scope only
  requires clearing it when the server says the room is gone.
