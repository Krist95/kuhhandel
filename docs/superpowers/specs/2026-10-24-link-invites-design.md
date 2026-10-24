# Link-based room invites

## Intent

Joining a room today requires the host to read out a 6-character room ID
and a password the host made up, and every joiner retypes both plus their
name and a seat number. This is the single biggest friction point in
getting a game started. The fix: replace typed room ID + password with a
shareable link and a QR code, and remove everything a joiner no longer
needs to enter.

## Goals

- A host can create a room, then share one link (and/or a QR code) that
  gets a friend straight into the lobby.
- A joiner who opens the link or scans the QR code only ever types their
  own name. No room ID, no password, no seat number.
- The link itself is the access control. Anyone who shouldn't join simply
  never gets the link.
- The host sets money rule and time-per-decision once, at creation time.

## Non-goals

- No support for revoking/rotating a link once shared (out of scope for
  this change).
- No change to in-game rules, scoring, or the websocket protocol beyond
  what's needed for room creation/join.
- No account system or persistent player identity across rooms.

## Anti-goals

- Don't leave a vestigial password field "just in case" — it was already
  friction left over from before links existed, and must be removed
  end-to-end (client UI, protocol messages, server hashing, localStorage
  caching), not just hidden.
- Don't make the host's creation form more complex than today's two
  settings dropdowns plus a name field.

## Current state (for reference)

- Room creation: `src/rules/lobby.ts` `createRoom`, server generates a
  6-char `roomId`; client (`web/src/ui/RoomForm.tsx`) sends a
  client-chosen password, hashed server-side (`src/password.ts`,
  `src/room.ts`).
- Join: same `RoomForm.tsx`, `mode="join"` — fields are room ID,
  password, name, and a manual 1-5 seat picker. Server validates in
  `src/rules/lobby.ts` `joinRoom`.
- Settings (`moneyRule`, `decisionSeconds`) live in `src/rules/types.ts`
  (`Settings`, `DEFAULT_SETTINGS`), currently set only after creation,
  host-only, via `updateSettings` from inside `Lobby.tsx` — not part of
  room creation at all today.
- Sharing: `Lobby.tsx` already has a Share button using `shareText()`
  (`web/src/model/lobby.ts`) and `navigator.share`/clipboard fallback,
  but the shared URL is just `location.origin` — not a deep link, since
  there's no routing today (no router library; navigation is done via a
  Preact signal, `homeScreen` in `web/src/state.ts`).

## What's decided

**Room creation form** (host): name, money rule (swap /
loserTakesBoth), time-per-decision (10/20/30/60/120s). No seat picker —
host still appears in the lobby once created; whether the host
auto-takes a seat or picks one is left to the builder (minor — current
behavior can likely stay, see below). Settings are locked in at creation
and are no longer editable from the lobby afterward — the `updateSettings`
message/UI should be removed, not just hidden.

**Invite surface**: the lobby's Share button is extended so the link it
shares is a real deep link of the form `<origin>/join/<roomId>`, and a
QR code encoding that same URL is rendered next to the Share button for
in-person play. This requires minimal URL handling on load (parsing
`location.pathname` for a `/join/<roomId>` prefix) — a full router
library is not required given the existing signal-based navigation.

**Join flow**: opening the link (or scanning the code) pre-fills the
room ID internally (never shown as a field to type) and presents a
single field: the joiner's name. No password field, no seat picker.
First open seat is assigned automatically server-side. Submitting sends
a join message with just `roomId` (from the URL) and `playerName`.

**Password removal**: remove the password field from both create and
join forms, the `password`/`passwordHash`/`passwordSalt` fields from the
create/join protocol messages, the server-side hashing/verification
(`src/password.ts` call sites in `src/room.ts`), and the
`savePassword`/`savedPassword` localStorage helpers.

**Manual room-ID entry**: removed entirely. There is no longer a way to
join by typing a room ID — link or QR only. (User explicitly chose
simplification over keeping a manual fallback.)

**Seat auto-assignment**: on join via link, the server picks the first
open seat (1-5) rather than accepting a requested seat number. The
existing seat-uniqueness/range checks in `src/rules/lobby.ts` stay; only
the "who picks the seat number" responsibility moves from client to
server.

**Room code strength**: the room ID stays the current 6-character
format. It's now the sole access gate, but the link isn't posted
publicly — a short, readable code is an acceptable tradeoff for a casual
home game and keeping it short preserves "say it out loud" as a fallback
if someone ever needs to.

**Reconnect**: already solved, unaffected by this change. Reconnection
works today via a persistent per-browser token stored in localStorage
(`web/src/net/socket.ts` `getToken()`/`loadToken`), sent on every socket
open as `{ type: "hello", clientToken }` and matched against
`player.token` in the engine (`connect`/`disconnect` actions) — this has
nothing to do with the password, which only ever gated the one-time
`joinRoom` message. Removing the password does not change reconnect
behavior at all. `savedPassword`/`savePassword` (which cache the
password string itself, not an identity) are removed as part of the
password cleanup, with no replacement needed.

**Mid-game joins**: a link only works while the room is still in the
lobby (pre-game). If the game has already started, opening the link
should show a clear "this game has already started" state rather than
attempting to seat a new player — late joiners aren't supported by this
change.

## Left to the builder

- Exact QR code library choice (none is currently in `package.json`;
  a lightweight client-side QR renderer is expected).
- Whether the host, when creating a room, auto-takes seat 1 or the
  flow still shows a lightweight seat indicator for the host only —
  current `createRoom` behavior can likely be kept as-is since the host
  isn't the one this change targets.
- Exact visual layout/styling of the new one-field join screen and where
  the QR code sits relative to the Share button in the lobby — should
  look clean and not feel like an afterthought bolted onto the existing
  `.idbox`, but specific layout is implementation's call.
- Minimal path-parsing approach in `main.tsx`/`app.tsx` for
  `/join/<roomId>` (no router library needed per exploration above).
- Server-side handling for an invalid/expired/full room reached via a
  stale link (clear error state, not a crash) — not discussed with the
  user but required for correctness.
