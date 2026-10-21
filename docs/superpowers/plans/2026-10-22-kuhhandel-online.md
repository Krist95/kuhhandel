# Kuhhandel Online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private, phone-landscape Kuhhandel PWA for 3–5 friends: a pure rules engine, one Cloudflare Durable Object room server, and a Preact client with original art.

**Architecture:** A pure, deterministic TypeScript engine (`src/rules/`) reduces `(room, action, { now, rng })` to `{ state, events }` or an error, and builds each player's filtered view. One SQLite-backed Durable Object (`GameRoom`, `idFromName("main")`) owns hibernatable sockets, persistence, a single alarm and broadcasting; the Worker only routes `/ws` and serves static assets. The client renders the server's personalized `view` and sends intents.

**Tech Stack:** TypeScript 5.9 · Cloudflare Workers + Durable Objects via Wrangler 4.151 · Vitest 4.1 (Node for engine and client models; `@cloudflare/vitest-plugin` 1.4 for workerd integration tests) · Vite 8 + Preact 10.29 + `@preact/signals` 2.11 · sharp (icon rasterising only).

**Spec:** `kuhhandel-spec.md` at the repo root. "§5.4" etc. refer to its sections. Read it alongside this plan.

## Global Constraints

- 3–5 players. English UI only. Phones in landscape; design for heights 360–430 px; no page scrolling during play; relative units.
- Cloudflare Free plan only: one Worker with static assets plus one SQLite-backed Durable Object class `GameRoom`, bound as `GAME_ROOM`, always addressed as `env.GAME_ROOM.idFromName("main")`. No other services, database or accounts.
- The server enforces every rule. The client only renders `view` and sends intents.
- Hidden values (other players' money cards, offers, payment cards, Buy availability) never reach a client that may not see them, including through the log. Tokens never appear in any message sent to any client.
- Password: PBKDF2-SHA-256 via Web Crypto, 16-byte random salt, 100,000 iterations (the workerd maximum). Plaintext is never stored and never sent to a client.
- Room ID: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- Exact copy: "A room is already in use. Ask the host for the room ID and password." · "Room not found or wrong password." · "This game has already started" · "Please rotate your phone" · "Game paused by {host}".
- Names: trimmed, 1–16 characters counted as code points, unique case-insensitively.
- Times: decision 10/20/30/60 s (default 20) · host transfer 2 min · nobody connected 10 min · finished room 5 min · bluff reveal 5 s · Away after 3 consecutive timeouts · at most 3 ties.
- The engine does no I/O and never calls `Date.now()` or `Math.random()`; time and randomness come only from `ctx`.
- All artwork is original flat SVG. Never use or imitate Ravensburger artwork.
- The client renders server strings (names, log) as text only, never through `innerHTML` or `dangerouslySetInnerHTML`.
- The dev machine runs Windows, so npm scripts must be cross-platform (no `rm`, `cp` or `export`).
- Versions are pinned in Task 1. Do not move to Vitest 5, Preact 11 or TypeScript 7 during this plan.

## Review Focus

1. **Same token connected twice** (installed PWA plus a browser tab, or a reconnect before the old socket closes): the newest connection wins, the old socket is closed with code 4001, and the player never shows as disconnected. Test: Task 11.
2. **Double taps and late intents** (two "Bid" taps, or a "Pay" that arrives after auto-pay): the second intent gets an error and changes nothing. Tests: Tasks 6 and 9.
3. **Every in-game player Away**: instant default resolution must not loop forever; the game falls back to normal deadlines. Test: Task 9.
4. **Deck empty and trades exist, but no player who could challenge holds a money card**: turns would be skipped forever, so the game must end. Test: Task 5.
5. **Phone clock skew** (phones seconds or minutes off): countdowns use the offset from `serverTime`, never raw `Date.now()`. Test: Task 13.

## Decisions This Plan Makes Where the Spec Is Silent or Conflicting

Confirm or change these before executing. Spec §12 assumptions 1–4 are adopted as written.

| # | Topic | Decision |
|---|---|---|
| D1 | §8.3 puts the password in the host's view, but §3.1 says never send it | The server never sends it. Each client keeps the password it typed in `localStorage`, and the host's lobby shows it from there. |
| D2 | §6.2 says an Away player's decisions resolve instantly, so they never get a chance to act | New client message `imBack`, plus an "I'm back" banner. |
| D3 | Every in-game player is Away, or an Away player's turn comes up with the deck empty | No instant resolution; normal deadlines apply. Instant resolution would loop forever (everyone Away) or cycle endlessly skipping turns (empty deck). |
| D4 | Deck empty, legal trades exist, but nobody with a legal trade has a money card | The game ends (otherwise turns skip forever). |
| D5 | The host leaves their seat in the lobby | Host passes to the next seated player clockwise; the room closes if nobody is left. |
| D6 | Timing of the bluff reveal | A 5 s `bluff` phase during which the game waits; bidding then restarts with a fresh bid timer. Pausing during it restarts the 5 s on resume. |
| D7 | Setup timeout in a repeat (tie) round | Same as round 1: the trade is cancelled and the turn passes. |
| D8 | Backing out after choosing Cow trade | Not possible, since the protocol has no cancel. Only the timeout cancels. |
| D9 | When host transfer fires | Whenever the host has been disconnected for at least 2 min and another seated player is connected, so it can also fire when someone reconnects later. |
| D10 | A second connection with the same token | Replaces the first: close code 4001, reason "Replaced by a newer connection". |
| D11 | Limits the spec doesn't set | Room name 1–24 chars · password 1–64 chars · max bid 100,000 · the log keeps the last 100 entries · the rate limit counts only bad-credential failures. |
| D12 | What unseated visitors receive | A `view` with `room: null`. |
| D13 | A removed player tries to rejoin | Error "You were removed from this room." |
| D14 | Money summary format | Includes zeros, e.g. "0×2 · 10×4 · 50×1 · Total 90" (the 0 card matters for bluffing). |

## File Structure

```
wrangler.toml · package.json · tsconfig.json (engine) · tsconfig.worker.json · vitest.config.ts (Node) · vitest.server.config.ts (workerd) · vite.config.ts
src/worker.ts          /ws → GameRoom stub; everything else → env.ASSETS
src/room.ts            GameRoom DO: sockets, hello/binding, password check, rate limit, dispatch, persist, broadcast, alarm
src/password.ts        hashPassword / verifyPassword (PBKDF2)
src/protocol.ts        ClientMessage, ServerMessage and View types; parseClientMessage
src/rules/types.ts     constants and all state/action types        src/rules/errors.ts   ErrorCode, ERROR_TEXT, RuleError
src/rules/rng.ts       mulberry32, randomId, shuffle, pickOne      src/rules/engine.ts   reduce dispatcher, Tx, lookups, log
src/rules/text.ts      animalsText, cardsText (shared with the client)
src/rules/lobby.ts     create/join/leave/remove/settings/connect/disconnect/close
src/rules/herd.ts      herd counts, tradeable animals, complete sets src/rules/scoring.ts scores and ranking
src/rules/payment.ts   card picking, autoPay, pay intent, settlement
src/rules/setup.ts     deck, starting money, startGame, playAgain
src/rules/turn.ts      phases + deadlines, turn order, chooseAction, out/skip, game end
src/rules/auction.ts   reveal, donkey payout, bidding, decision, bluff
src/rules/cowTrade.ts  offer, response, forfeit, settlement, ties, cancel
src/rules/timers.ts    tick, timeout defaults, Away, pause/resume, host transfer, closing, nextDeadline
src/rules/view.ts      buildView (per-player filtering)
test/rules/            Node unit tests + helpers.ts        test/protocol.test.ts
test/server/           workerd integration tests + client.ts
web/                   index.html, tsconfig.json, public/ (manifest, sw.js, icons)
web/src/               main.tsx, app.tsx, styles.css, state.ts, net/, model/ (pure + tested), ui/, device/, art/
scripts/icons.mjs      renders the PNG icons with sharp
```

## Conventions

- Run commands from the repo root. Node tests: `npx vitest run <path>`. Server tests: `npm run test:server -- <path>`. Typecheck: `npm run typecheck`.
- Engine style: `reduce` clones the room (`JSON.parse(JSON.stringify(room))`). Internal functions mutate that draft and throw `RuleError` on invalid input. `reduce` turns a throw into `{ ok: false, error }`, so a rejected intent never changes state.
- Every phase change goes through `setPhase` (Task 5), so a deadline is always set.
- Log copy is given per task. `{Animal}` is the singular display name ("Horse"). `{animals}` is the count plus the correctly pluralized name ("1 Cow", "2 Cows", "2 Geese", "2 Sheep"). `{n cards}` is "1 card" or "3 cards".
- An intent that doesn't match the current phase, or comes from someone the game isn't waiting on, fails with `notYourTurn`.
- Test snippets omit `import` lines. Import `describe`/`it`/`expect`/`vi`/`afterEach` from `vitest`; test helpers from `test/rules/helpers.ts` (or `test/server/client.ts`); `env`/`exports` from `cloudflare:workers`; the other `cloudflare:test` helpers; and the named functions and types from the files the task lists.
- Commit at the end of each task with the message given. Never commit `node_modules/`, `web/dist/`, `.wrangler/` or `worker-configuration.d.ts`.

---

# Part A — Rules engine (pure TypeScript, Node tests)

### Task 1: Scaffold, core types and seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `vitest.server.config.ts`, `wrangler.toml`, `.gitignore`, `src/rules/types.ts`, `src/rules/errors.ts`, `src/rules/rng.ts`
- Test: `test/rules/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every name in `types.ts`, `errors.ts` and `rng.ts` below. All later tasks import them, so keep the names exact.

```ts
// src/rules/types.ts
export const ANIMALS = ["rooster", "goose", "cat", "dog", "sheep", "goat", "donkey", "pig", "cow", "horse"] as const;
export type Animal = (typeof ANIMALS)[number];
export const ANIMAL_VALUE: Record<Animal, number> = { rooster: 10, goose: 40, cat: 90, dog: 160, sheep: 250, goat: 350, donkey: 500, pig: 650, cow: 800, horse: 1000 };
export const ANIMAL_NAME: Record<Animal, readonly [singular: string, plural: string]> = {
  rooster: ["Rooster", "Roosters"], goose: ["Goose", "Geese"], cat: ["Cat", "Cats"], dog: ["Dog", "Dogs"], sheep: ["Sheep", "Sheep"],
  goat: ["Goat", "Goats"], donkey: ["Donkey", "Donkeys"], pig: ["Pig", "Pigs"], cow: ["Cow", "Cows"], horse: ["Horse", "Horses"] };
export type MoneyValue = 0 | 10 | 50 | 100 | 200 | 500;
export const STARTING_MONEY: readonly MoneyValue[] = [0, 0, 10, 10, 10, 10, 50];
export const DONKEY_PAYOUTS: readonly MoneyValue[] = [50, 100, 200, 500];
export const ROOM_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const DECISION_SECONDS = [10, 20, 30, 60] as const;
export const HOST_TRANSFER_MS = 120_000, NOBODY_CONNECTED_MS = 600_000, FINISHED_CLOSE_MS = 300_000, BLUFF_REVEAL_MS = 5_000;
export const AWAY_AFTER = 3, MAX_TIES = 3, LOG_LIMIT = 100, MAX_BID = 100_000;

export type Seat = 1 | 2 | 3 | 4 | 5;
export type Herd = Record<Animal, number>;
export interface MoneyCard { id: string; value: MoneyValue }
export interface Settings { moneyRule: "swap" | "loserTakesBoth"; decisionSeconds: (typeof DECISION_SECONDS)[number] }
export const DEFAULT_SETTINGS: Settings = { moneyRule: "swap", decisionSeconds: 20 };
export interface Player {
  id: string; token: string; name: string; seat: Seat; connected: boolean; disconnectedAt: number | null;
  money: MoneyCard[]; herd: Herd; out: boolean; away: boolean; timeouts: number; // consecutive timeouts
}
export interface Auction {
  card: Animal; auctioneerId: string; bidders: string[]; // eligible ids, clockwise from the auctioneer's left
  excluded: string[]; passed: string[]; topBid: number; topBidderId: string | null; turnId: string | null;
}
export interface TradeTerms { defenderId: string; animal: Animal; count: 1 | 2 }
export type Phase =
  | { kind: "action"; playerId: string }
  | { kind: "bidding"; auction: Auction }
  | { kind: "decision"; auction: Auction }
  | { kind: "bluff"; auction: Auction; blufferId: string; bid: number; cards: MoneyValue[] }
  | { kind: "payment"; card: Animal; payerId: string; receiverId: string; amount: number }
  | { kind: "tradeSetup"; challengerId: string; terms: TradeTerms | null; ties: number }
  | { kind: "tradeResponse"; challengerId: string; terms: TradeTerms; ties: number; offer: MoneyCard[] };
export interface PaymentRecord { id: number; payerId: string; receiverId: string; amount: number; cards: MoneyValue[] }
export interface TradeRecord {
  id: number; challengerId: string; defenderId: string; animal: Animal; count: 1 | 2; ties: number;
  challengerCards: MoneyValue[]; defenderCards: MoneyValue[] | null; // null = defender put nothing
  winnerId: string | null;                                          // null = tie, trade repeats
}
export interface Game {
  deck: Animal[]; donkeysRevealed: number; activePlayerId: string; phase: Phase; // deck[0] is the top card
  deadline: number | null; // null while paused or finished
  lastPayment: PaymentRecord | null; lastTrade: TradeRecord | null; recordSeq: number;
}
export interface ScoreRow { playerId: string; sets: Animal[]; setValue: number; multiplier: number; score: number; rank: number; winner: boolean }
export interface LogEntry { seq: number; text: string }
export type RoomStatus = "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED";
export interface Room { // the EMPTY state is `null`
  status: RoomStatus; roomId: string; roomName: string; passwordHash: string; passwordSalt: string;
  hostId: string; players: Player[]; blockedTokens: string[]; settings: Settings;
  game: Game | null; scores: ScoreRow[] | null; log: LogEntry[]; logSeq: number;
  finishedAt: number | null; nobodySince: number | null;
}
export type Intent =
  | { type: "leaveSeat" } | { type: "removePlayer"; playerId: string }
  | { type: "updateSettings"; moneyRule?: Settings["moneyRule"]; decisionSeconds?: number }
  | { type: "startGame" } | { type: "chooseAction"; action: "auction" | "cowTrade" }
  | { type: "bid"; amount: number } | { type: "pass" }
  | { type: "auctioneerDecision"; decision: "sell" | "buy" } | { type: "pay"; cardIds: string[] }
  | { type: "cowTradeOffer"; targetId: string; animal: Animal; count: number; cardIds: string[] }
  | { type: "cowTradeResponse"; cardIds: string[] }
  | { type: "pause" } | { type: "resume" } | { type: "closeRoom" } | { type: "playAgain" } | { type: "imBack" };
export type Action =
  | { type: "create"; token: string; roomName: string; playerName: string; seat: number; passwordHash: string; passwordSalt: string }
  | { type: "join"; token: string; playerName: string; seat: number }
  | { type: "connect"; token: string } | { type: "disconnect"; token: string }
  | { type: "intent"; token: string; intent: Intent } | { type: "tick" };
export type CloseReason = "hostClosed" | "finished" | "inactive";
export type RoomEvent = { kind: "closed"; reason: CloseReason } | { kind: "removed"; token: string };
export interface Ctx { now: number; rng: () => number }
export type Outcome = { ok: true; state: Room | null; events: RoomEvent[] } | { ok: false; error: { code: ErrorCode; message: string } };
```

`src/rules/errors.ts` exports `ERROR_TEXT` (this exact copy), `type ErrorCode = keyof typeof ERROR_TEXT`, and `class RuleError extends Error { constructor(readonly code: ErrorCode) }`, with the message set to `ERROR_TEXT[code]`:

| code | text | code | text |
|---|---|---|---|
| roomInUse | A room is already in use. Ask the host for the room ID and password. | notHost | Only the host can do that. |
| badCredentials | Room not found or wrong password. | notEnoughPlayers | You need 3–5 players to start. |
| gameStarted | This game has already started | paused | The game is paused. |
| tooManyAttempts | Too many failed attempts. Wait a minute and try again. | notYourTurn | It's not your turn. |
| blocked | You were removed from this room. | deckEmpty | The deck is empty. |
| badName | Names must be 1–16 characters. | cantTrade | No cow trade is possible. |
| nameTaken | That name is already taken. | badBid | Bid a multiple of 10 above the top bid. |
| badRoomName | Room name must be 1–24 characters. | buyDisabled | You can't afford to buy it. |
| badPassword | Password must be 1–64 characters. | badCards | Pick cards from your own hand. |
| badSeat | Pick a seat from 1 to 5. | underpaid | Those cards don't cover the amount. |
| seatTaken | That seat is taken. | badTrade | That cow trade isn't allowed. |
| alreadySeated | You already have a seat. | badMessage | Invalid message. |
| notSeated | You are not in this room. | invalid | That isn't possible right now. |

`src/rules/rng.ts`: `mulberry32(seed: number): () => number` (standard Mulberry32, values in [0, 1)) · `randomId(rng, length = 8, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"): string` · `shuffle<T>(rng, items: readonly T[]): T[]` (Fisher–Yates on a copy) · `pickOne<T>(rng, items: readonly T[]): T`.

- [ ] **Step 1: Create the config files with exactly this content**

```jsonc
// package.json
{
  "name": "kuhhandel", "private": true, "type": "module",
  "scripts": { "test": "vitest run", "typecheck": "tsc -p tsconfig.json" },
  "dependencies": { "@preact/signals": "^2.11.3", "preact": "^10.29.8" },
  "devDependencies": { "@cloudflare/vitest-plugin": "^1.4.6", "@preact/preset-vite": "^2.10.6", "sharp": "^0.35.5",
    "typescript": "~5.9.3", "vite": "^8.3.5", "vitest": "~4.1.12", "wrangler": "^4.151.3" }
}
// tsconfig.json: the engine is typechecked with no platform types, which keeps it free of I/O
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "lib": ["ES2023"], "types": [],
    "strict": true, "noEmit": true, "skipLibCheck": true, "isolatedModules": true },
  "include": ["src/rules", "src/protocol.ts", "test/rules", "test/protocol.test.ts"] }
```

```ts
// vitest.config.ts (Node: engine, protocol and client models)
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts", "web/src/**/*.test.ts"], exclude: ["test/server/**", "**/node_modules/**"] } });
// vitest.server.config.ts (workerd)
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
export default defineConfig({ plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.toml" } })], test: { include: ["test/server/**/*.test.ts"] } });
```

```toml
# wrangler.toml
name = "kuhhandel"
main = "src/worker.ts"
compatibility_date = "2026-10-01"

[assets]
directory = "./web/dist"
binding = "ASSETS"

[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoom"]
```

`.gitignore`: `node_modules/`, `web/dist/`, `.wrangler/`, `worker-configuration.d.ts`, `.dev.vars`.

- [ ] **Step 2: Initialise the repo and install.** Run `git init` and then `npm install`. Expected: the install finishes with no `ERESOLVE` or peer-dependency errors.

- [ ] **Step 3: Write the failing test** `test/rules/rng.test.ts`

```ts
describe("rng", () => {
  it("mulberry32 is deterministic and in [0, 1)", () => {
    const xs = Array.from({ length: 100 }, mulberry32(42));
    expect(xs).toEqual(Array.from({ length: 100 }, mulberry32(42)));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
  it("randomId only uses the given alphabet", () => {
    expect(randomId(mulberry32(7), 6, ROOM_ID_ALPHABET)).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(randomId(mulberry32(7))).toMatch(/^[a-z0-9]{8}$/);
  });
  it("shuffle returns a seeded permutation and leaves its input alone", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(mulberry32(1), input);
    expect([...out].sort()).toEqual(input);
    expect(out).toEqual(shuffle(mulberry32(1), input));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("pickOne returns an element", () => expect([1, 2, 3]).toContain(pickOne(mulberry32(3), [1, 2, 3])));
  it("pins the spec constants", () => {
    expect(STARTING_MONEY.reduce((s, v) => s + v, 0)).toBe(90);
    expect(Object.values(ANIMAL_VALUE)).toEqual([10, 40, 90, 160, 250, 350, 500, 650, 800, 1000]);
  });
});
```

- [ ] **Step 4: Run** `npx vitest run test/rules/rng.test.ts`. Expected: FAIL, cannot resolve `../../src/rules/rng`.
- [ ] **Step 5: Implement** `types.ts`, `errors.ts` and `rng.ts` as specified above.
- [ ] **Step 6: Run** `npx vitest run test/rules/rng.test.ts` and `npm run typecheck`. Expected: 5 passed; tsc exits 0.
- [ ] **Step 7: Commit:** `git add -A`, then `git commit -m "chore: scaffold project with rules types and seeded rng"`.

### Task 2: Engine kernel and lobby

**Files:**
- Create: `src/rules/engine.ts`, `src/rules/lobby.ts`, `src/rules/text.ts`, `test/rules/helpers.ts`
- Test: `test/rules/lobby.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `RuleError`, `ERROR_TEXT`, `randomId`.
- Produces:

```ts
// engine.ts
export interface Tx extends Ctx { events: RoomEvent[] }
export function reduce(room: Room | null, action: Action, ctx: Ctx): Outcome
export function addLog(room: Room, text: string): void            // push { seq: ++room.logSeq, text }; keep the last LOG_LIMIT
export function playerByToken(room: Room, token: string): Player  // throws notSeated
export function playerById(room: Room, id: string): Player        // throws invalid
export function nextClockwise(room: Room, fromSeat: Seat, ok: (p: Player) => boolean): Player | null
  // first seated player after fromSeat in increasing seat order, wrapping, never fromSeat itself
// text.ts — copy helpers, imported by the engine and the client (so the browser bundle never pulls in engine.ts)
export function animalsText(count: number, animal: Animal): string // "1 Cow", "2 Geese"
export function cardsText(n: number): string                      // "1 card", "3 cards"
// lobby.ts
export function normalizeName(raw: string, max: number): string | null // trimmed; 1..max code points, else null
export function createRoom(a: Extract<Action, { type: "create" }>, tx: Tx): Room
export function joinRoom(room: Room, a: Extract<Action, { type: "join" }>, tx: Tx): void
export function leaveSeat(room: Room, p: Player, tx: Tx): Room | null
export function removePlayer(room: Room, host: Player, playerId: string, tx: Tx): void
export function updateSettings(room: Room, host: Player, i: Extract<Intent, { type: "updateSettings" }>): void
export function setConnected(room: Room, token: string, connected: boolean, tx: Tx): void
export function closeRoom(tx: Tx): null   // pushes { kind: "closed", reason: "hostClosed" }
export function requireHost(room: Room, p: Player): void          // throws notHost
```

`reduce` dispatches with one `switch`, which later tasks extend:
- `create`: the room must be null, else `roomInUse`.
- `join`: a null room gives `badCredentials`; a status other than LOBBY gives `gameStarted`.
- `connect`/`disconnect`: succeed as a no-op for a null room or an unknown token.
- `tick`: no-op until Task 9.
- `intent`: a null room gives `notSeated`; the sender comes from `playerByToken`. `leaveSeat`, `removePlayer`, `updateSettings` and `startGame` need LOBBY, else `invalid`. `closeRoom` is host-only and works in any status. Intents not implemented yet throw `invalid`.

Lobby rules:
- **createRoom:** room name `normalizeName(…, 24)`, else `badRoomName`. Player name `normalizeName(…, 16)`, else `badName`. Seat must be an integer 1–5, else `badSeat`. Room ID is `randomId(rng, 6, ROOM_ID_ALPHABET)`; player ID is `randomId(rng)`; settings are `DEFAULT_SETTINGS`. The creator is connected and is host. Log "{name} created the room."
- **joinRoom:** check in this order: blocked token → `blocked`; already seated → `alreadySeated`; name (`badName`); seat (`badSeat`); case-insensitive name clash → `nameTaken`; seat in use → `seatTaken`. Log "{name} joined."
- **leaveSeat:** remove the player and log "{name} left.". If they were host, the next player clockwise becomes host (log "{name} is now the host."). If nobody is left, call `closeRoom`.
- **removePlayer:** host only. The target must exist and must not be the host, else `invalid`. Add the target's token to `blockedTokens`, push `{ kind: "removed", token }`, and log "{name} was removed."
- **updateSettings:** `moneyRule` must be in `{swap, loserTakesBoth}` and `decisionSeconds` in `DECISION_SECONDS`, else `invalid`.
- **setConnected:** applies to seated tokens only. Disconnect sets `connected = false` and `disconnectedAt = now`, and sets `nobodySince = now` when no seated player is connected any more. Connect sets `connected = true`, `disconnectedAt = null` and `nobodySince = null`.

Test helpers (`test/rules/helpers.ts`), which every later engine test uses:

```ts
export const T0 = 1_000_000;
export const NAMES = ["Anna", "Ben", "Clara"];
export const tok = (name: string) => `tok-${name.toLowerCase()}`;
export function outcome(room: Room | null, action: Action, now = T0, seed = 1): Outcome // reduce with mulberry32(seed)
export function run(room: Room | null, action: Action, now = T0, seed = 1): Room | null  // throws Error(code) unless ok
export function fail(room: Room | null, action: Action, now = T0): ErrorCode            // throws if ok
export const by = (name: string, intent: Intent): Action => ({ type: "intent", token: tok(name), intent });
export const createAction = (name = "Anna", seat = 1): Action =>
  ({ type: "create", token: tok(name), roomName: "Barn", playerName: name, seat, passwordHash: "h", passwordSalt: "s" });
export const joinAction = (name: string, seat: number): Action => ({ type: "join", token: tok(name), playerName: name, seat });
export function lobby(names = NAMES): Room  // names[0] creates at seat 1 (host); names[i] joins at seat i + 1
export function pl(room: Room, name: string): Player
```

- [ ] **Step 1: Write the failing tests** `test/rules/lobby.test.ts`

```ts
describe("lobby", () => {
  it("creates a room with a 6-char ID, a connected host and default settings", () => {
    const r = run(null, createAction())!;
    expect(r.status).toBe("LOBBY");
    expect(r.roomId).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(r.hostId).toBe(pl(r, "Anna").id);
    expect(pl(r, "Anna")).toMatchObject({ seat: 1, connected: true });
    expect(r.settings).toEqual({ moneyRule: "swap", decisionSeconds: 20 });
  });
  it("refuses a second room and joining a missing room", () => {
    expect(fail(lobby(), createAction("Zed", 4))).toBe("roomInUse");
    expect(fail(null, joinAction("Ben", 2))).toBe("badCredentials");
  });
  it("rejects duplicate names after trimming, case-insensitively", () => {
    expect(fail(lobby(["Anna", "Ben"]), joinAction("  anna ", 3))).toBe("nameTaken");
    expect(fail(lobby(["Anna", "Ben"]), joinAction("BEN", 3))).toBe("nameTaken");
  });
  it("enforces 1–16 character names counted in code points", () => {
    for (const bad of ["", "   ", "x".repeat(17)]) expect(fail(lobby(["Anna"]), joinAction(bad, 2))).toBe("badName");
    expect(run(lobby(["Anna"]), joinAction("🐄".repeat(16), 2))).not.toBeNull();
  });
  it("rejects taken and invalid seats", () => {
    expect(fail(lobby(["Anna", "Ben"]), joinAction("Clara", 2))).toBe("seatTaken");
    for (const s of [0, 6, 2.5]) expect(fail(lobby(["Anna"]), joinAction("Clara", s))).toBe("badSeat");
  });
  it("lets a player leave and join again", () => {
    const r = run(lobby(), by("Ben", { type: "leaveSeat" }))!;
    expect(r.players.map((p) => p.name)).toEqual(["Anna", "Clara"]);
    expect(run(r, joinAction("Ben", 2))!.players).toHaveLength(3);
  });
  it("passes host clockwise when the host leaves and closes when the last player leaves", () => {
    let r = run(run(run(null, createAction("Anna", 3)), joinAction("Ben", 1)), joinAction("Clara", 5))!;
    r = run(r, by("Anna", { type: "leaveSeat" }))!;
    expect(r.hostId).toBe(pl(r, "Clara").id); // seat 5 comes after seat 3
    r = run(r, by("Clara", { type: "leaveSeat" }))!;
    expect(r.hostId).toBe(pl(r, "Ben").id);
    expect(outcome(r, by("Ben", { type: "leaveSeat" }))).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "hostClosed" }] });
  });
  it("lets only the host remove others and blocks the removed token", () => {
    const r = lobby();
    expect(fail(r, by("Ben", { type: "removePlayer", playerId: pl(r, "Clara").id }))).toBe("notHost");
    expect(fail(r, by("Anna", { type: "removePlayer", playerId: pl(r, "Anna").id }))).toBe("invalid");
    const o = outcome(r, by("Anna", { type: "removePlayer", playerId: pl(r, "Ben").id }));
    expect(o.ok && o.events).toEqual([{ kind: "removed", token: tok("Ben") }]);
    expect(fail(o.ok ? o.state : null, joinAction("Ben", 2))).toBe("blocked");
  });
  it("lets only the host change settings, and only to allowed values", () => {
    expect(run(lobby(), by("Anna", { type: "updateSettings", moneyRule: "loserTakesBoth", decisionSeconds: 60 }))!.settings)
      .toEqual({ moneyRule: "loserTakesBoth", decisionSeconds: 60 });
    expect(fail(lobby(), by("Anna", { type: "updateSettings", decisionSeconds: 15 }))).toBe("invalid");
    expect(fail(lobby(), by("Ben", { type: "updateSettings", decisionSeconds: 30 }))).toBe("notHost");
  });
  it("tracks connections and when nobody is connected", () => {
    let r = run(lobby(["Anna"]), { type: "disconnect", token: tok("Anna") }, T0 + 5)!;
    expect(pl(r, "Anna")).toMatchObject({ connected: false, disconnectedAt: T0 + 5 });
    expect(r.nobodySince).toBe(T0 + 5);
    r = run(r, { type: "connect", token: tok("Anna") }, T0 + 9)!;
    expect([pl(r, "Anna").connected, r.nobodySince]).toEqual([true, null]);
  });
  it("lets only the host close the room", () => {
    expect(outcome(lobby(), by("Anna", { type: "closeRoom" }))).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "hostClosed" }] });
    expect(fail(lobby(), by("Ben", { type: "closeRoom" }))).toBe("notHost");
  });
  it("rejects unseated senders and never mutates its input", () => {
    const r = lobby(), before = JSON.stringify(r);
    expect(fail(r, by("Zed", { type: "leaveSeat" }))).toBe("notSeated");
    fail(r, by("Ben", { type: "removePlayer", playerId: "x" }));
    expect(JSON.stringify(r)).toBe(before);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/lobby.test.ts`. Expected: FAIL, missing modules.
- [ ] **Step 3: Implement** `engine.ts`, `lobby.ts` and `helpers.ts` with the signatures and rules above.
- [ ] **Step 4: Run** `npx vitest run test/rules` and `npm run typecheck`. Expected: all pass; tsc exits 0.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): engine dispatcher and lobby"`.

### Task 3: Herds and scoring

**Files:**
- Create: `src/rules/herd.ts`, `src/rules/scoring.ts`
- Test: `test/rules/herd.test.ts`

**Interfaces:**
- Consumes: `Herd`, `ANIMALS`, `ANIMAL_VALUE`, `ScoreRow` (Task 1).
- Produces:

```ts
// herd.ts
export function emptyHerd(): Herd
export function herdOf(partial: Partial<Herd>): Herd
export function totalAnimals(h: Herd): number
export function tradeableAnimals(a: Herd, b: Herd): Animal[]            // ANIMALS order: both hold ≥ 1 and neither holds 4
export function maxTradeCount(a: Herd, b: Herd, animal: Animal): 1 | 2  // 2 iff both hold ≥ 2
export function completeSets(h: Herd): Animal[]                         // count === 4, ANIMALS order
// scoring.ts
export function scoreHerd(h: Herd): { sets: Animal[]; setValue: number; multiplier: number; score: number }
export function rankPlayers(rows: readonly { playerId: string; herd: Herd }[]): ScoreRow[]
  // sort by score desc, then set count desc. Equal score AND equal set count share a rank (competition ranking 1, 1, 3). winner = rank 1.
```

- [ ] **Step 1: Write the failing tests** `test/rules/herd.test.ts`

```ts
const h = herdOf;
describe("herd", () => {
  it("finds animals both players hold that neither has completed", () => {
    expect(tradeableAnimals(h({ cow: 2, horse: 1 }), h({ cow: 1, horse: 3, cat: 2 }))).toEqual(["cow", "horse"]);
    expect(tradeableAnimals(h({ cow: 3 }), h({ cow: 1 }))).toEqual(["cow"]);
    expect(tradeableAnimals(h({ cow: 4 }), h({ cat: 1 }))).toEqual([]);
  });
  it("allows trading 2 only when both hold at least 2", () => {
    expect(maxTradeCount(h({ cow: 2 }), h({ cow: 2 }), "cow")).toBe(2);
    expect(maxTradeCount(h({ cow: 3 }), h({ cow: 1 }), "cow")).toBe(1);
  });
});
describe("scoring", () => {
  it("multiplies the sum of complete sets by the number of sets", () => {
    expect(scoreHerd(h({ horse: 4, cow: 4, cat: 2 }))).toEqual({ sets: ["cow", "horse"], setValue: 1800, multiplier: 2, score: 3600 });
    expect(scoreHerd(h({ cat: 3 }))).toEqual({ sets: [], setValue: 0, multiplier: 0, score: 0 });
  });
  it("breaks equal scores with more complete sets", () => {
    const rows = rankPlayers([
      { playerId: "a", herd: h({ horse: 4 }) },                             // 1000
      { playerId: "b", herd: h({ rooster: 4, goose: 4, cat: 4, dog: 4 }) }, // 300 × 4 = 1200
      { playerId: "c", herd: h({ sheep: 4, goat: 4 }) },                    // 600 × 2 = 1200
    ]);
    expect(rows.map((r) => [r.playerId, r.score, r.rank, r.winner])).toEqual([["b", 1200, 1, true], ["c", 1200, 2, false], ["a", 1000, 3, false]]);
  });
  it("shares the win only when score and set count are both equal", () => {
    const rows = rankPlayers([
      { playerId: "a", herd: h({ rooster: 4, pig: 4 }) }, // 660 × 2 = 1320
      { playerId: "b", herd: h({ dog: 4, donkey: 4 }) },  // 660 × 2 = 1320
      { playerId: "c", herd: h({ horse: 4 }) },
    ]);
    expect(rows.filter((r) => r.winner).map((r) => r.playerId).sort()).toEqual(["a", "b"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/herd.test.ts`. Expected: FAIL, missing modules.
- [ ] **Step 3: Implement** `herd.ts` and `scoring.ts`.
- [ ] **Step 4: Run** the same command. Expected: 5 passed.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): herd helpers and scoring with tiebreak"`.

### Task 4: Payment helpers

**Files:**
- Create: `src/rules/payment.ts`
- Test: `test/rules/payment.test.ts`

**Interfaces:**
- Consumes: `MoneyCard`, `Player`, `RuleError`.
- Produces (Task 7 adds `pay` and `settlePayment` to this file):

```ts
export function cashOf(cards: readonly MoneyCard[]): number
export function pickCards(hand: readonly MoneyCard[], ids: readonly string[]): MoneyCard[] // in ids order; throws badCards on an unknown or repeated id
export function removeCards(p: Player, cards: readonly MoneyCard[]): void
export function autoPay(hand: readonly MoneyCard[], amount: number): MoneyCard[]
  // smallest total ≥ amount, then fewest cards; never includes 0 cards; throws underpaid if cashOf(hand) < amount
```

Approach for `autoPay`: enumerate how many cards of each non-zero denomination to use (the product of `count + 1` over the five denominations, which stays small for any real hand), and keep the best by (total, card count). Any remaining tie may be broken in any deterministic way.

- [ ] **Step 1: Write the failing tests** `test/rules/payment.test.ts`

```ts
const hand = (...vs: MoneyValue[]) => vs.map((value, i) => ({ id: `c${i + 1}`, value }));
const summary = (cards: MoneyCard[]) => [cashOf(cards), cards.length];
describe("payment helpers", () => {
  it("sums card values", () => expect(cashOf(hand(0, 10, 50))).toBe(60));
  it("picks owned cards and rejects unknown or repeated ids", () => {
    expect(pickCards(hand(10, 50), ["c2"])).toEqual([{ id: "c2", value: 50 }]);
    expect(() => pickCards(hand(10, 50), ["c1", "c1"])).toThrow(ERROR_TEXT.badCards);
    expect(() => pickCards(hand(10, 50), ["zz"])).toThrow(ERROR_TEXT.badCards);
  });
  it("auto-pays the smallest covering total, then the fewest cards", () => {
    const start = hand(0, 0, 10, 10, 10, 10, 50);
    expect(summary(autoPay(start, 30))).toEqual([30, 3]);
    expect(summary(autoPay(start, 40))).toEqual([40, 4]);
    expect(summary(autoPay(start, 60))).toEqual([60, 2]);
    expect(summary(autoPay(hand(100, 50, 50, 10), 100))).toEqual([100, 1]);
    expect(summary(autoPay(hand(200, 100, 100, 10), 150))).toEqual([200, 1]);
  });
  it("never hands over zero cards", () => expect(autoPay(hand(0, 0, 10), 10).map((c) => c.value)).toEqual([10]));
  it("handles a large hand", () => {
    const big = hand(...([10, 50, 100, 200, 500] as const).flatMap((v) => Array<MoneyValue>(8).fill(v)));
    expect(summary(autoPay(big, 1230))).toEqual([1230, 6]);
  });
  it("throws when the hand cannot cover the amount", () => expect(() => autoPay(hand(10), 20)).toThrow(ERROR_TEXT.underpaid));
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/payment.test.ts`. Expected: FAIL, missing module.
- [ ] **Step 3: Implement** `payment.ts`.
- [ ] **Step 4: Run** the same command. Expected: 6 passed.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): payment helpers and auto-pay search"`.

### Task 5: Game setup, turn flow and auction reveal

**Files:**
- Create: `src/rules/setup.ts`, `src/rules/turn.ts`, `src/rules/auction.ts`
- Modify: `src/rules/engine.ts` (dispatch `startGame`, `playAgain`, `chooseAction`), `test/rules/helpers.ts`
- Test: `test/rules/setup.test.ts`, `test/rules/turn.test.ts`

**Interfaces:**
- Consumes: Task 2 engine helpers, Task 3 `tradeableAnimals`, `totalAnimals`, `rankPlayers`, and Task 1 `shuffle`, `pickOne`, `randomId`.
- Produces:

```ts
// setup.ts
export function buildDeck(): Animal[]                        // 40 cards, 4 of each, ANIMALS order
export function startGame(room: Room, tx: Tx): void          // also used by playAgain
// turn.ts
export function phaseDurationMs(phase: Phase, s: Settings): number // bluff → BLUFF_REVEAL_MS, else decisionSeconds × 1000
export function setPhase(room: Room, phase: Phase, tx: Tx): void   // game.phase = phase; game.deadline = tx.now + duration
export function waitingOn(phase: Phase): string | null
  // action → playerId · bidding → auction.turnId · decision → auctioneerId · payment → payerId
  // tradeSetup → challengerId · tradeResponse → terms.defenderId · bluff → null
export function inGame(room: Room): Player[]                       // not out, in seat order
export function nextInGame(room: Room, fromId: string): Player
export function canChallenge(room: Room, p: Player): boolean      // ≥ 1 money card and an in-game target with a tradeable animal
export function beginTurn(room: Room, playerId: string, tx: Tx): void
export function endTurn(room: Room, tx: Tx): void                 // beginTurn(room, nextInGame(room, activePlayerId).id, tx)
export function chooseAction(room: Room, p: Player, action: "auction" | "cowTrade", tx: Tx): void
export function finishGame(room: Room, tx: Tx): void
// auction.ts
export function eligibleBidders(room: Room, auctioneerId: string, excluded: readonly string[]): string[] // in game, clockwise from the auctioneer's left
export function startAuction(room: Room, tx: Tx): void
export function giveFree(room: Room, auction: Auction, tx: Tx): void // auctioneer takes the card, log, endTurn
// test/rules/helpers.ts additions
export interface GameOpts { deck?: Animal[]; first?: string; money?: Record<string, MoneyValue[]>; herds?: Record<string, Partial<Herd>>; settings?: Partial<Settings> }
export function game(names = NAMES, o: GameOpts = {}): Room
  // lobby → updateSettings (if given) → startGame (seed 1) → override deck, money (card ids `${name}-${i + 1}`) and herds
  // → beginTurn(first ?? names[0]) at T0, so the first player is deterministic
export function withTx(room: Room, fn: (draft: Room, tx: Tx) => void, now = T0): Room // clone, run internal code, return the draft
export function act(room: Room, name: string, intent: Intent, now = T0): Room
export function reject(room: Room, name: string, intent: Intent, now = T0): ErrorCode
export const idOf = (r: Room, name: string) => pl(r, name).id;
export function nameOf(room: Room, id: string): string
export function ids(room: Room, name: string, ...values: MoneyValue[]): string[] // one card id per value, first match, no reuse
export function cash(room: Room, name: string): number
export function count(room: Room, name: string, animal: Animal): number
```

Rules:
- **Dispatcher:** `startGame` is host-only (`notHost`) and needs 3–5 players (`notEnoughPlayers`). `playAgain` needs FINISHED (`invalid`) and the host. Game intents (`chooseAction`, `bid`, `pass`, `auctioneerDecision`, `pay`, `cowTradeOffer`, `cowTradeResponse`) need PLAYING: PAUSED gives `paused`, any other status gives `invalid`.
- **startGame:** each player gets `STARTING_MONEY` as new cards with `randomId(rng)` IDs, an empty herd, `out = away = false` and `timeouts = 0`. The deck is `shuffle(rng, buildDeck())`; `donkeysRevealed = 0`; records are null. Status PLAYING; `scores = finishedAt = null`; clear `log` (`logSeq` keeps counting). The first player is `pickOne(rng, players)`. Log "Game started. {name} goes first." Then `beginTurn(first)`.
- **chooseAction:** the phase must be `action` for this player (`notYourTurn`). `auction` with an empty deck gives `deckEmpty`, otherwise `startAuction`. `cowTrade` without `canChallenge` gives `cantTrade`, otherwise `setPhase({ kind: "tradeSetup", challengerId, terms: null, ties: 0 })`.
- **startAuction:** `card = deck.shift()`; log "{auctioneer} auctions the {Animal}.". For a donkey, take `payout = DONKEY_PAYOUTS[donkeysRevealed++]`, give every in-game player a new card of that value, and log "Donkey! Everyone receives {payout}.". With no eligible bidders call `giveFree`; otherwise `setPhase` bidding with `turnId = bidders[0]`. `giveFree` logs "No bids. {auctioneer} takes the {Animal} for free."
- **finishGame:** status FINISHED, `scores = rankPlayers(all players)`, `finishedAt = now`, `game.deadline = null`. Log "Game over. {name} wins with {score}." or "Game over. {A} and {B} share the win with {score}."
- **beginTurn**: the order of checks matters (it covers the Review Focus 4 deadlock):

```
loop:
  if deck empty and no in-game player passes canChallenge → finishGame; return
  p = playerById(id)
  if deck empty and totalAnimals(p.herd) == 0 → p.out = true; log "{name} has no animals and is out."; id = nextInGame(p).id; continue
  if deck empty and !canChallenge(p)       → log "{name} has no possible cow trade. Turn skipped."; id = nextInGame(p).id; continue
  game.activePlayerId = id; setPhase({ kind: "action", playerId: id }); return
```

- [ ] **Step 1: Write the failing tests** `test/rules/setup.test.ts` and `test/rules/turn.test.ts`

```ts
describe("startGame", () => {
  it("deals starting money, empty herds and a shuffled 40-card deck", () => {
    const r = run(lobby(), by("Anna", { type: "startGame" }))!;
    expect(r.status).toBe("PLAYING");
    for (const p of r.players) expect(p.money.map((c) => c.value).sort((a, b) => a - b)).toEqual([0, 0, 10, 10, 10, 10, 50]);
    expect(new Set(r.players.flatMap((p) => p.money.map((c) => c.id))).size).toBe(21);
    for (const a of ANIMALS) expect(r.game!.deck.filter((x) => x === a)).toHaveLength(4);
    expect(r.game!.deck).toHaveLength(40);
    expect(r.game!.deck).not.toEqual(buildDeck());
    expect(r.game!.phase).toEqual({ kind: "action", playerId: r.game!.activePlayerId });
    expect(r.game!.deadline).toBe(T0 + 20_000);
  });
  it("picks the first player at random from the seed", () => {
    const firsts = new Set(Array.from({ length: 20 }, (_, s) => run(lobby(), by("Anna", { type: "startGame" }), T0, s + 1)!.game!.activePlayerId));
    expect(firsts.size).toBeGreaterThan(1);
  });
  it("needs the host and 3–5 players, and locks the room once started", () => {
    expect(fail(lobby(["Anna", "Ben"]), by("Anna", { type: "startGame" }))).toBe("notEnoughPlayers");
    expect(fail(lobby(), by("Ben", { type: "startGame" }))).toBe("notHost");
    expect(fail(game(), joinAction("Dan", 4))).toBe("gameStarted");
  });
  it("Play again restarts a finished game with the same players and settings", () => {
    const done = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4 }, Clara: { cat: 4 } }, settings: { decisionSeconds: 30 } });
    expect(done.status).toBe("FINISHED");
    expect(fail(done, by("Ben", { type: "playAgain" }))).toBe("notHost");
    const r = act(done, "Anna", { type: "playAgain" }, T0 + 1000);
    expect(r).toMatchObject({ status: "PLAYING", finishedAt: null, scores: null, settings: { decisionSeconds: 30 } });
    expect(r.players.map((p) => p.name)).toEqual(NAMES);
    expect([r.game!.deck.length, cash(r, "Anna")]).toEqual([40, 90]);
  });
});

describe("turns", () => {
  const choose = (action: "auction" | "cowTrade") => ({ type: "chooseAction", action }) as const;
  it("auctions the top card", () => {
    const r = act(game(NAMES, { deck: ["horse", "cow"] }), "Anna", choose("auction"));
    expect([r.game!.phase.kind, r.game!.deck]).toEqual(["bidding", ["cow"]]);
    expect(r.log.at(-1)!.text).toBe("Anna auctions the Horse.");
  });
  it("only lets the active player choose, and only while playing", () => {
    expect(reject(game(), "Ben", choose("auction"))).toBe("notYourTurn");
    expect(fail(lobby(), by("Anna", choose("auction")))).toBe("invalid");
  });
  it("allows a cow trade only with a legal trade and a money card", () => {
    const base = { herds: { Anna: { cow: 1 }, Ben: { cow: 1 } } };
    expect(act(game(NAMES, base), "Anna", choose("cowTrade")).game!.phase.kind).toBe("tradeSetup");
    expect(reject(game(NAMES, { ...base, money: { Anna: [] } }), "Anna", choose("cowTrade"))).toBe("cantTrade");
    expect(reject(game(NAMES, { herds: { Anna: { cow: 4 } } }), "Anna", choose("cowTrade"))).toBe("cantTrade");
    expect(reject(game(NAMES, { ...base, deck: [] }), "Anna", choose("auction"))).toBe("deckEmpty");
  });
  it("pays the donkey bonus to everyone before the donkey is auctioned", () => {
    const r = act(game(NAMES, { deck: ["donkey", "horse"] }), "Anna", choose("auction"));
    expect(NAMES.map((n) => cash(r, n))).toEqual([140, 140, 140]);
    expect(r.log.map((e) => e.text).slice(-2)).toEqual(["Anna auctions the Donkey.", "Donkey! Everyone receives 50."]);
    expect([r.game!.donkeysRevealed, r.game!.phase.kind]).toEqual([1, "bidding"]);
  });
  it("marks a player with no animals out once the deck is empty, and skips them", () => {
    const r = game(NAMES, { deck: [], herds: { Ben: { cow: 2 }, Clara: { cow: 2 } } });
    expect(pl(r, "Anna").out).toBe(true);
    expect(r.game!.activePlayerId).toBe(idOf(r, "Ben"));
    expect(nextInGame(r, idOf(r, "Clara")).name).toBe("Ben");
  });
  it("skips a player who has animals but no possible cow trade", () => {
    const r = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 2 }, Clara: { cow: 2 } } });
    expect(pl(r, "Anna").out).toBe(false);
    expect(r.log.map((e) => e.text)).toContain("Anna has no possible cow trade. Turn skipped.");
    expect(r.game!.activePlayerId).toBe(idOf(r, "Ben"));
  });
  it("ends the game when no legal trade exists", () => {
    const r = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4, cat: 4 }, Clara: { pig: 4 } } });
    expect([r.status, r.finishedAt]).toEqual(["FINISHED", T0]);
    expect(r.scores!.map((s) => [nameOf(r, s.playerId), s.score])).toEqual([["Ben", 1780], ["Anna", 1000], ["Clara", 650]]);
  });
  it("ends the game when nobody who could trade holds a money card", () => {
    const r = game(NAMES, { deck: [], herds: { Anna: { cow: 2 }, Ben: { cow: 2 }, Clara: { horse: 4 } }, money: { Anna: [], Ben: [] } });
    expect(r.status).toBe("FINISHED");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/setup.test.ts test/rules/turn.test.ts`. Expected: FAIL, missing modules.
- [ ] **Step 3: Implement** `setup.ts`, `turn.ts`, `startAuction`/`eligibleBidders`/`giveFree` in `auction.ts`, the dispatcher cases and the helper additions.
- [ ] **Step 4: Run** `npx vitest run test/rules` and `npm run typecheck`. Expected: all pass; tsc exits 0.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): game setup, turn order, out and skip rules, auction reveal"`.

### Task 6: Bidding

**Files:**
- Modify: `src/rules/auction.ts`, `src/rules/engine.ts` (dispatch `bid`, `pass`), `test/rules/helpers.ts`
- Test: `test/rules/auction.test.ts`

**Interfaces:**
- Consumes: Task 5 `setPhase`, `endTurn`, `giveFree`, `eligibleBidders`.
- Produces:

```ts
export function bid(room: Room, p: Player, amount: number, tx: Tx): void
export function pass(room: Room, p: Player, tx: Tx): void
// helpers
export function auc(room: Room): Auction             // the auction of a bidding, decision or bluff phase; throws otherwise
export function passAll(room: Room, now = T0): Room   // passes for whoever holds the bid turn until bidding ends
```

Rules:
- Both need phase `bidding` with `turnId === p.id`, else `notYourTurn`.
- **bid:** the amount must be an integer multiple of 10, at least 10, above `topBid` and at most `MAX_BID`, else `badBid`. Set `topBid` and `topBidderId`. Log "{name} bids {amount}."
- **pass:** add the player to `passed`. Log "{name} passes."
- **After either**, let `live = bidders − passed`. If `live` is empty → `giveFree`. If `live` is exactly `[topBidderId]` → `setPhase` decision with `turnId: null`. Otherwise `turnId` becomes the next id in `bidders` order after the current one (wrapping) that is in `live`, and `setPhase` bidding, which gives each bid turn a fresh timer.

- [ ] **Step 1: Write the failing tests** `test/rules/auction.test.ts`

```ts
const FOUR = ["Anna", "Ben", "Clara", "Dan"];
const choose = { type: "chooseAction", action: "auction" } as const;
const bid = (amount: number) => ({ type: "bid", amount }) as const;
const pass = { type: "pass" } as const;
const start = () => act(game(FOUR, { deck: ["horse", "cow", "cat"] }), "Anna", choose);

describe("bidding", () => {
  it("starts with the player after the auctioneer", () => {
    const r = start();
    expect(auc(r)).toMatchObject({ card: "horse", topBid: 0, topBidderId: null, turnId: idOf(r, "Ben") });
  });
  it("accepts any multiple of 10 above the top bid, including jumps and bluffs", () => {
    let r = start();
    for (const bad of [0, 5, 15, -10, 10.5, MAX_BID + 10]) expect(reject(r, "Ben", bid(bad))).toBe("badBid");
    r = act(r, "Ben", bid(10));
    expect(reject(r, "Clara", bid(10))).toBe("badBid");
    r = act(r, "Clara", bid(500)); // more than Clara's 90
    expect(auc(r)).toMatchObject({ topBid: 500, topBidderId: idOf(r, "Clara"), turnId: idOf(r, "Dan") });
  });
  it("makes passing final", () => {
    const r = act(act(act(start(), "Ben", pass), "Clara", bid(10)), "Dan", bid(20));
    expect(auc(r).turnId).toBe(idOf(r, "Clara"));
    expect(reject(r, "Ben", bid(30))).toBe("notYourTurn");
  });
  it("ends when the only remaining bidder holds the top bid", () => {
    const r = act(act(act(start(), "Ben", bid(10)), "Clara", pass), "Dan", pass);
    expect(r.game!.phase.kind).toBe("decision");
    expect(auc(r)).toMatchObject({ topBid: 10, topBidderId: idOf(r, "Ben") });
  });
  it("still gives the last bidder a turn when nobody has bid", () => {
    const r = act(act(start(), "Ben", pass), "Clara", pass);
    expect(auc(r).turnId).toBe(idOf(r, "Dan"));
    expect(act(r, "Dan", bid(10)).game!.phase.kind).toBe("decision");
  });
  it("gives the animal to the auctioneer for free when everyone passes", () => {
    const r = passAll(start());
    expect([count(r, "Anna", "horse"), cash(r, "Anna")]).toEqual([1, 90]);
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
    expect(r.log.at(-1)!.text).toBe("No bids. Anna takes the Horse for free.");
  });
  it("rejects a repeated bid from a double tap", () => {
    expect(reject(act(start(), "Ben", bid(10)), "Ben", bid(10))).toBe("notYourTurn");
  });
  it("gives every bid turn a fresh timer", () => {
    expect(act(start(), "Ben", bid(10), T0 + 7_000).game!.deadline).toBe(T0 + 27_000);
  });
  it("pays donkey bonuses of 50, 100, 200 and 500 in order", () => {
    let r = game(NAMES, { deck: ["donkey", "donkey", "donkey", "donkey", "horse"] });
    for (const [i, n] of ["Anna", "Ben", "Clara", "Anna"].entries()) {
      const before = cash(r, "Clara");
      r = act(r, n, choose);
      expect(cash(r, "Clara") - before).toBe(DONKEY_PAYOUTS[i]);
      r = passAll(r);
    }
    expect(r.game!.donkeysRevealed).toBe(4);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/auction.test.ts`. Expected: FAIL (`bid`/`pass` are rejected as `invalid`).
- [ ] **Step 3: Implement** `bid`, `pass`, the dispatcher cases and the two helpers.
- [ ] **Step 4: Run** `npx vitest run test/rules`. Expected: all pass.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): turn-based bidding"`.

### Task 7: Auctioneer decision, bluff and payment

**Files:**
- Modify: `src/rules/auction.ts`, `src/rules/payment.ts`, `src/rules/engine.ts` (dispatch `auctioneerDecision`, `pay`)
- Test: `test/rules/decision.test.ts`

**Interfaces:**
- Consumes: Task 4 `cashOf`, `pickCards`, `removeCards`; Task 5 `setPhase`, `endTurn`, `giveFree`, `eligibleBidders`; Task 6 helpers `auc`, `passAll`.
- Produces:

```ts
// auction.ts
export function decide(room: Room, p: Player, decision: "sell" | "buy", tx: Tx): void
export function endBluffReveal(room: Room, tx: Tx): void          // run by the bluff timer in Task 9
// payment.ts
export function pay(room: Room, p: Player, cardIds: readonly string[], tx: Tx): void
export function settlePayment(room: Room, cards: readonly MoneyCard[], tx: Tx): void // used by pay and by auto-pay in Task 9
```

Rules (the animal always goes to the payer: on Sell the bidder pays and takes it, on Buy the auctioneer pays and keeps it):
- **decide:** needs phase `decision` and the auctioneer (`notYourTurn`).
  - **buy:** needs `cashOf(auctioneer) >= topBid`, else `buyDisabled`. Then `setPhase` payment with payer = auctioneer and receiver = top bidder.
  - **sell:** if the top bidder's cash is below the bid, it's a bluff: `setPhase({ kind: "bluff", auction (with the bidder appended to excluded), blufferId, bid, cards: the bidder's values sorted ascending })` and log "Bluff! {name} bid {bid} but only has {total} ({values joined with ", "})." Otherwise `setPhase` payment with payer = top bidder and receiver = auctioneer.
- **endBluffReveal:** `bidders = eligibleBidders(room, auctioneerId, excluded)` and log "Bidding on the {Animal} restarts.". With no bidders call `giveFree`; otherwise `setPhase` bidding with `passed: []`, `topBid: 0`, `topBidderId: null` and `turnId: bidders[0]`.
- **pay:** needs phase `payment` and the payer (`notYourTurn`). `pickCards` (`badCards`), then the total must be ≥ the amount (`underpaid`), then `settlePayment`.
- **settlePayment:** move the cards from payer to receiver (no change is given) and add the card to the payer's herd. Set `lastPayment = { id: ++recordSeq, payerId, receiverId, amount, cards: values }`. Log "{payer} bought the {Animal} for {amount} ({n cards})." Then `endTurn`.

- [ ] **Step 1: Write the failing tests** `test/rules/decision.test.ts`

```ts
const FOUR = ["Anna", "Ben", "Clara", "Dan"];
const choose = { type: "chooseAction", action: "auction" } as const;
const decide = (decision: "sell" | "buy") => ({ type: "auctioneerDecision", decision }) as const;
const pay = (cardIds: string[]) => ({ type: "pay", cardIds }) as const;
const bid = (amount: number) => ({ type: "bid", amount }) as const;
const pass = { type: "pass" } as const;
/** Anna auctions a Horse; Ben bids `amount`; Clara and Dan pass. */
const toDecision = (amount: number) =>
  act(act(act(act(game(FOUR, { deck: ["horse", "cow", "cat"] }), "Anna", choose), "Ben", bid(amount)), "Clara", pass), "Dan", pass);

describe("auctioneer decision and payment", () => {
  it("Sell: the top bidder pays the auctioneer and takes the animal", () => {
    let r = act(toDecision(30), "Anna", decide("sell"));
    expect(r.game!.phase).toMatchObject({ kind: "payment", payerId: idOf(r, "Ben"), receiverId: idOf(r, "Anna"), amount: 30, card: "horse" });
    r = act(r, "Ben", pay(ids(r, "Ben", 10, 10, 10)));
    expect([count(r, "Ben", "horse"), cash(r, "Ben"), cash(r, "Anna")]).toEqual([1, 60, 120]);
    expect(r.log.at(-1)!.text).toBe("Ben bought the Horse for 30 (3 cards).");
    expect(r.game!.lastPayment).toMatchObject({ payerId: idOf(r, "Ben"), receiverId: idOf(r, "Anna"), amount: 30, cards: [10, 10, 10] });
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
  it("gives no change: overpayment goes to the receiver", () => {
    let r = act(toDecision(30), "Anna", decide("sell"));
    r = act(r, "Ben", pay(ids(r, "Ben", 50)));
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([140, 40]);
  });
  it("rejects underpayment, foreign or repeated cards and the wrong payer", () => {
    const r = act(toDecision(30), "Anna", decide("sell"));
    const [ten] = ids(r, "Ben", 10);
    expect(reject(r, "Ben", pay(ids(r, "Ben", 10, 10)))).toBe("underpaid");
    expect(reject(r, "Ben", pay(ids(r, "Anna", 50)))).toBe("badCards");
    expect(reject(r, "Ben", pay([ten, ten, ten]))).toBe("badCards");
    expect(reject(r, "Clara", pay(ids(r, "Clara", 50)))).toBe("notYourTurn");
  });
  it("Buy: the auctioneer pays the top bidder and keeps the animal", () => {
    let r = act(toDecision(50), "Anna", decide("buy"));
    expect(r.game!.phase).toMatchObject({ kind: "payment", payerId: idOf(r, "Anna"), receiverId: idOf(r, "Ben"), amount: 50 });
    r = act(r, "Anna", pay(ids(r, "Anna", 50)));
    expect([count(r, "Anna", "horse"), cash(r, "Anna"), cash(r, "Ben")]).toEqual([1, 40, 140]);
    expect(r.log.at(-1)!.text).toBe("Anna bought the Horse for 50 (1 card).");
  });
  it("enables Buy only when the auctioneer's cash covers the bid", () => {
    expect(reject(toDecision(100), "Anna", decide("buy"))).toBe("buyDisabled");
    expect(act(toDecision(90), "Anna", decide("buy")).game!.phase.kind).toBe("payment");
  });
  it("calls a bluff on Sell: reveals the cash, excludes the bidder and restarts bidding", () => {
    let r = act(toDecision(100), "Anna", decide("sell"));
    expect(r.game!.phase).toMatchObject({ kind: "bluff", blufferId: idOf(r, "Ben"), bid: 100, cards: [0, 0, 10, 10, 10, 10, 50] });
    expect(r.game!.deadline).toBe(T0 + 5_000);
    expect(r.log.at(-1)!.text).toBe("Bluff! Ben bid 100 but only has 90 (0, 0, 10, 10, 10, 10, 50).");
    expect(cash(r, "Ben")).toBe(90);
    r = withTx(r, endBluffReveal, T0 + 5_000);
    expect(auc(r)).toMatchObject({ topBid: 0, topBidderId: null, excluded: [idOf(r, "Ben")], passed: [], turnId: idOf(r, "Clara") });
    expect([r.game!.phase.kind, r.game!.deadline]).toEqual(["bidding", T0 + 25_000]);
  });
  it("accumulates exclusions, gives the animal away free when nobody bids, then clears them", () => {
    let r = withTx(act(toDecision(100), "Anna", decide("sell")), endBluffReveal);
    r = act(act(r, "Clara", bid(100)), "Dan", pass);
    r = withTx(act(r, "Anna", decide("sell")), endBluffReveal);
    expect(auc(r).excluded).toEqual([idOf(r, "Ben"), idOf(r, "Clara")]);
    r = act(r, "Dan", pass);
    expect(count(r, "Anna", "horse")).toBe(1);
    expect(auc(act(r, "Ben", choose)).excluded).toEqual([]);
  });
  it("gives the animal away free when a restart has no eligible bidders", () => {
    let r = act(act(act(game(NAMES, { deck: ["horse", "cow"] }), "Anna", choose), "Ben", bid(100)), "Clara", pass);
    r = withTx(act(r, "Anna", decide("sell")), endBluffReveal); // Ben excluded
    r = withTx(act(act(r, "Clara", bid(100)), "Anna", decide("sell")), endBluffReveal); // Clara excluded
    expect(count(r, "Anna", "horse")).toBe(1);
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/decision.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `decide`, `endBluffReveal`, `pay`, `settlePayment` and the dispatcher cases.
- [ ] **Step 4: Run** `npx vitest run test/rules`. Expected: all pass.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): sell/buy decision, bluff reveal and payments"`.

### Task 8: Cow trade

**Files:**
- Create: `src/rules/cowTrade.ts`
- Modify: `src/rules/engine.ts` (dispatch `cowTradeOffer`, `cowTradeResponse`)
- Test: `test/rules/cowTrade.test.ts`

**Interfaces:**
- Consumes: Task 3 `tradeableAnimals`, `maxTradeCount`; Task 4 `pickCards`, `removeCards`, `cashOf`; Task 5 `setPhase`, `endTurn`, `inGame`.
- Produces:

```ts
export function offer(room: Room, p: Player, i: Extract<Intent, { type: "cowTradeOffer" }>, tx: Tx): void
export function respond(room: Room, p: Player, cardIds: readonly string[], tx: Tx): void
export function cancelTrade(room: Room, tx: Tx): void // setup timeout, used in Task 9
```

Rules:
- **offer:** needs phase `tradeSetup` and the challenger (`notYourTurn`).
  - Round 1 (`terms === null`): the target must be in the game and not the challenger, the animal must be in `tradeableAnimals(challenger, target)`, and the count must be 1, or 2 when `maxTradeCount` is 2. Anything else is `badTrade`.
  - A repeat round must use exactly the stored `terms`, else `badTrade`.
  - `cardIds` must not be empty (`badTrade`), and `pickCards` validates them (`badCards`). The offered cards leave the hand into `phase.offer`, then `setPhase` tradeResponse.
  - Log "{C} challenges {D} for {animals} with {n cards}."
- **respond:** needs phase `tradeResponse` and the defender (`notYourTurn`); validate with `pickCards`. `lastTrade` gets a new `++recordSeq` id on every resolution.
  - **Nothing put down (forfeit):** move `count` animals from D to C, and give C's offered cards to D. `lastTrade` gets `defenderCards: null` and `winnerId: C`. Log "{D} forfeited the Cow trade to {C}." Then `endTurn`.
  - **Tie, with `ties + 1 < MAX_TIES`:** return both offers to their owners and set `lastTrade` with `winnerId: null`. Log "Tie! The Cow trade repeats ({ties + 1} of 3)." Then `setPhase` tradeSetup with the same terms and `ties + 1`.
  - **Otherwise:** the higher total wins; on the third tie the challenger wins (§12.1). Move `count` animals from loser to winner. With `swap`, the winner gets the loser's offer and the loser gets the winner's. With `loserTakesBoth`, the loser gets both offers. Log "{D} counters with {m cards}. {W} wins {animals}." (on the third tie: "Third tie: {C} wins {animals}."). Then `endTurn`.
- **cancelTrade:** log "{C}'s Cow trade was cancelled." Then `endTurn`. No offer is outstanding during setup.

- [ ] **Step 1: Write the failing tests** `test/rules/cowTrade.test.ts`

```ts
const g = (settings?: Partial<Settings>) => game(NAMES, { settings,
  herds: { Anna: { cow: 2, horse: 1 }, Ben: { cow: 2 }, Clara: { horse: 3 } },
  money: { Anna: [0, 10, 50, 100], Ben: [10, 10, 200], Clara: [50] } });
const setup = (r: Room) => act(r, "Anna", { type: "chooseAction", action: "cowTrade" });
const offer = (r: Room, cardIds: string[], target = "Ben", animal: Animal = "cow", count = 2): Intent =>
  ({ type: "cowTradeOffer", targetId: idOf(r, target), animal, count, cardIds });
const respond = (cardIds: string[]): Intent => ({ type: "cowTradeResponse", cardIds });
/** From tradeSetup: Anna offers values `a` for Ben's 2 cows, Ben answers with values `b`. */
const round = (r: Room, a: MoneyValue[], b: MoneyValue[]) => {
  const o = act(r, "Anna", offer(r, ids(r, "Anna", ...a)));
  return act(o, "Ben", respond(ids(o, "Ben", ...b)));
};

describe("cow trade", () => {
  it("validates the challenge", () => {
    const r = setup(g()), ten = ids(r, "Anna", 10);
    expect(reject(r, "Anna", offer(r, ten, "Ben", "horse", 1))).toBe("badTrade"); // Ben has no horse
    expect(reject(r, "Anna", offer(r, ten, "Anna", "cow", 1))).toBe("badTrade");
    expect(reject(r, "Anna", offer(r, ten, "Ben", "cow", 3))).toBe("badTrade");
    expect(reject(r, "Anna", offer(r, []))).toBe("badTrade");
    expect(reject(r, "Anna", offer(r, ids(r, "Ben", 10)))).toBe("badCards");
  });
  it("offers 2 animals only when both hold at least 2", () => {
    const r = setup(g());
    expect(reject(r, "Anna", offer(r, ids(r, "Anna", 10), "Clara", "horse", 2))).toBe("badTrade");
    const s = act(r, "Anna", offer(r, ids(r, "Anna", 0, 10)));
    expect(s.game!.phase).toMatchObject({ kind: "tradeResponse", terms: { defenderId: idOf(s, "Ben"), animal: "cow", count: 2 }, ties: 0 });
    expect(cash(s, "Anna")).toBe(150);
  });
  it("forfeit: challenger wins, defender takes the challenger's cards, nothing is revealed", () => {
    const r = round(setup(g()), [0], []);
    expect([count(r, "Anna", "cow"), count(r, "Ben", "cow")]).toEqual([4, 0]);
    expect(pl(r, "Ben").money.map((c) => c.id)).toContain("Anna-1");
    expect(r.game!.lastTrade).toMatchObject({ winnerId: idOf(r, "Anna"), defenderCards: null });
    expect(r.log.at(-1)!.text).toBe("Ben forfeited the Cow trade to Anna.");
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
  it("the higher total wins; swap gives each side the other's offer", () => {
    const r = round(setup(g()), [50, 10], [200]);
    expect([count(r, "Ben", "cow"), count(r, "Anna", "cow")]).toEqual([4, 0]);
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([300, 80]);
    expect(r.game!.lastTrade).toMatchObject({ winnerId: idOf(r, "Ben"), challengerCards: [50, 10], defenderCards: [200] });
    expect(r.log.at(-1)!.text).toBe("Ben counters with 1 card. Ben wins 2 Cows.");
  });
  it("loserTakesBoth gives both offers to the loser", () => {
    const r = round(setup(g({ moneyRule: "loserTakesBoth" })), [50, 10], [200]);
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([360, 20]);
  });
  it("repeats a tie with the same terms, and a repeat round may be forfeited", () => {
    const r = round(setup(g()), [10], [10]);
    expect(r.game!.phase).toMatchObject({ kind: "tradeSetup", terms: { defenderId: idOf(r, "Ben"), animal: "cow", count: 2 }, ties: 1 });
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([160, 220]);
    expect(r.log.at(-1)!.text).toBe("Tie! The Cow trade repeats (1 of 3).");
    expect(reject(r, "Anna", offer(r, ids(r, "Anna", 10), "Clara", "horse", 1))).toBe("badTrade");
    expect(round(r, [0], []).game!.lastTrade!.defenderCards).toBeNull();
  });
  it("after the third tie the challenger wins and the money rule settles the offers", () => {
    let r = setup(g());
    for (let i = 0; i < 3; i++) r = round(r, [10], [10]);
    expect([count(r, "Anna", "cow"), count(r, "Ben", "cow")]).toEqual([4, 0]);
    expect(pl(r, "Anna").money.some((c) => c.id.startsWith("Ben-"))).toBe(true);
    expect(r.log.at(-1)!.text).toBe("Third tie: Anna wins 2 Cows.");
    let lb = setup(g({ moneyRule: "loserTakesBoth" }));
    for (let i = 0; i < 3; i++) lb = round(lb, [10], [10]);
    expect([cash(lb, "Anna"), cash(lb, "Ben")]).toEqual([150, 230]);
  });
  it("only the defender responds, and only with their own cards", () => {
    const s = setup(g());
    const r = act(s, "Anna", offer(s, ids(s, "Anna", 10)));
    expect(reject(r, "Clara", respond([]))).toBe("notYourTurn");
    expect(reject(r, "Ben", respond(["Anna-4"]))).toBe("badCards");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/cowTrade.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `cowTrade.ts` and the dispatcher cases.
- [ ] **Step 4: Run** `npx vitest run test/rules`. Expected: all pass.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): cow trades with forfeit, reveal, money rules and ties"`.

### Task 9: Timers, Away, pause, host transfer and closing

**Files:**
- Create: `src/rules/timers.ts`
- Modify: `src/rules/engine.ts` (dispatch `tick`, `pause`, `resume`, `imBack`; after-action hooks; host check on `connect`), `test/rules/helpers.ts`
- Test: `test/rules/timers.test.ts`

**Interfaces:**
- Consumes: `waitingOn`, `phaseDurationMs`, `setPhase`, `startAuction`, `endTurn`, `inGame` (Task 5); `pass` (Task 6); `decide`, `endBluffReveal`, `settlePayment` (Task 7); `autoPay` (Task 4); `cancelTrade`, `respond` (Task 8); `nextClockwise`, `addLog` (Task 2).
- Produces:

```ts
export function tick(room: Room, tx: Tx): Room | null     // everything due at tx.now; null = closed (event pushed)
export function applyTimeout(room: Room, tx: Tx): void    // counts the timeout, then applyDefault
export function applyDefault(room: Room, tx: Tx): void    // the current phase's default, no counting
export function settleAway(room: Room, tx: Tx): void      // instant defaults while the waited-on player is Away
export function checkHostTransfer(room: Room, now: number): void
export function nextDeadline(room: Room | null): number | null
export function pause(room: Room, host: Player, tx: Tx): void
export function resume(room: Room, host: Player, tx: Tx): void
export function markActive(room: Room, p: Player): void   // timeouts = 0; if away: away = false, log "{name} is back."
// helpers
export function tickAt(room: Room | null, now: number): Room | null // run(room, { type: "tick" }, now)
```

Rules:
- **applyDefault** by phase:

  | Phase | Default |
  |---|---|
  | action | deck not empty → `startAuction`; otherwise log "{name}'s turn was skipped." and `endTurn` |
  | bidding | `pass` |
  | decision | `decide(…, "sell")` |
  | payment | `settlePayment(autoPay(payer.money, amount))` |
  | tradeSetup | `cancelTrade` |
  | tradeResponse | `respond(defender, [])` |
  | bluff | `endBluffReveal` |

- **applyTimeout:** if `waitingOn(phase)` is a player: log "Time's up for {name}.", increment `timeouts`, and when it reaches `AWAY_AFTER` set `away = true` and log "{name} is away.". Then `applyDefault`.
- **settleAway:** loop while all of these hold, calling `applyDefault` each time:
  1. status is PLAYING;
  2. the waited-on player is Away;
  3. at least one in-game player is not Away (D3);
  4. it is not an `action` phase with an empty deck. Skipping instantly there can cycle forever between Away players, so that turn waits for its normal deadline.

  Every other default consumes a card or ends a turn, so the loop terminates.
- **tick:**
  1. If PLAYING and `deadline <= now`: `applyTimeout`, then `settleAway`. This handles one timeout per tick, since each default sets a future deadline.
  2. `checkHostTransfer`.
  3. If `nobodySince + NOBODY_CONNECTED_MS <= now`: close with `inactive`.
  4. If FINISHED and `finishedAt + FINISHED_CLOSE_MS <= now`: close with `finished`.
- **checkHostTransfer:** if the host has been disconnected for at least `HOST_TRANSFER_MS` and another seated player is connected, the new host is `nextClockwise(room, host.seat, p => p.connected)`. Log "{name} is now the host." This also runs after every `connect`.
- **nextDeadline:** the minimum of:
  - the game deadline (PLAYING only);
  - `host.disconnectedAt + HOST_TRANSFER_MS`, when another seated player is connected;
  - `nobodySince + NOBODY_CONNECTED_MS`;
  - `finishedAt + FINISHED_CLOSE_MS` (FINISHED only).

  `null` when none apply.
- **pause:** host-only (`notHost`) and needs PLAYING (`invalid`). Sets PAUSED and `deadline = null`. Log "Game paused by {name}."
- **resume:** host-only and needs PAUSED. Sets PLAYING and `deadline = now + phaseDurationMs(phase)` (a full-length restart, which also restarts the 5 s bluff reveal). Log "Game resumed."
- **imBack:** needs PLAYING or PAUSED. It only calls `markActive`.
- **Dispatcher hooks:** after any accepted intent while PLAYING or PAUSED, call `markActive(sender)`. Then, if PLAYING, call `settleAway`. A `tick` calls `timers.tick`.

- [ ] **Step 1: Write the failing tests** `test/rules/timers.test.ts`

```ts
const D = 20_000;
const choose = { type: "chooseAction", action: "auction" } as const;
const g = () => game(NAMES, { deck: ["horse", "cow", "cat"] });

describe("timeouts", () => {
  it("auto-auctions when a turn times out with cards in the deck", () => {
    expect(tickAt(g(), T0 + D - 1)!.game!.phase.kind).toBe("action");
    const r = tickAt(g(), T0 + D)!;
    expect([r.game!.phase.kind, pl(r, "Anna").timeouts]).toEqual(["bidding", 1]);
    expect(r.log.map((e) => e.text)).toContain("Time's up for Anna.");
  });
  it("skips the turn when it times out with an empty deck", () => {
    const r = tickAt(game(NAMES, { deck: [], herds: { Anna: { cow: 1 }, Ben: { cow: 1 }, Clara: { cow: 2 } } }), T0 + D)!;
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
  it("passes on a bid timeout", () => {
    const r = tickAt(act(g(), "Anna", choose), T0 + D)!;
    expect(auc(r)).toMatchObject({ passed: [idOf(r, "Ben")], turnId: idOf(r, "Clara") });
  });
  it("sells on a decision timeout, auto-pays on a payment timeout, and rejects a late Pay", () => {
    let r = act(act(act(g(), "Anna", choose), "Ben", { type: "bid", amount: 30 }), "Clara", { type: "pass" });
    r = tickAt(r, T0 + D)!;
    expect(r.game!.phase).toMatchObject({ kind: "payment", payerId: idOf(r, "Ben"), amount: 30 });
    r = tickAt(r, T0 + 2 * D)!;
    expect([cash(r, "Ben"), cash(r, "Anna"), count(r, "Ben", "horse")]).toEqual([60, 120, 1]);
    expect(reject(r, "Ben", { type: "pay", cardIds: ids(r, "Ben", 10, 10, 10) })).toBe("notYourTurn");
  });
  it("cancels a trade on a setup timeout and forfeits on a response timeout", () => {
    const s = act(game(NAMES, { herds: { Anna: { cow: 2 }, Ben: { cow: 2 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
    const cancelled = tickAt(s, T0 + D)!;
    expect(cancelled.log.map((e) => e.text)).toContain("Anna's Cow trade was cancelled.");
    expect(cancelled.game!.phase).toEqual({ kind: "action", playerId: idOf(cancelled, "Ben") });
    const o = act(s, "Anna", { type: "cowTradeOffer", targetId: idOf(s, "Ben"), animal: "cow", count: 2, cardIds: ids(s, "Anna", 10) });
    expect(count(tickAt(o, T0 + D)!, "Anna", "cow")).toBe(4);
  });
  it("restarts bidding when the 5-second bluff reveal ends", () => {
    let r = act(act(act(g(), "Anna", choose), "Ben", { type: "bid", amount: 100 }), "Clara", { type: "pass" });
    r = act(r, "Anna", { type: "auctioneerDecision", decision: "sell" });
    expect(tickAt(r, T0 + 4_999)!.game!.phase.kind).toBe("bluff");
    expect(tickAt(r, T0 + 5_000)!.game!.phase.kind).toBe("bidding");
  });
  it("keeps running timers for disconnected players", () => {
    expect(tickAt(run(g(), { type: "disconnect", token: tok("Anna") }), T0 + D)!.game!.phase.kind).toBe("bidding");
  });
});

describe("away", () => {
  it("marks a player Away on the 3rd consecutive timeout; any action resets the count", () => {
    const two = withTx(g(), (d) => { pl(d, "Anna").timeouts = 2; });
    const r = tickAt(two, T0 + D)!;
    expect(pl(r, "Anna").away).toBe(true);
    expect(r.log.map((e) => e.text)).toContain("Anna is away.");
    expect(pl(act(two, "Anna", choose), "Anna").timeouts).toBe(0);
  });
  it("resolves an Away player's decisions instantly", () => {
    let r = withTx(game(NAMES, { first: "Ben" }), (d) => { pl(d, "Anna").away = true; });
    r = act(act(r, "Ben", choose), "Clara", { type: "pass" }); // Anna's bid turn passes at once; Ben takes it free
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Clara") });
  });
  it("clears Away with imBack", () => {
    const r = act(withTx(g(), (d) => { Object.assign(pl(d, "Ben"), { away: true, timeouts: 3 }); }), "Ben", { type: "imBack" });
    expect(pl(r, "Ben")).toMatchObject({ away: false, timeouts: 0 });
    expect(r.log.at(-1)!.text).toBe("Ben is back.");
  });
  it("falls back to normal deadlines when every in-game player is Away", () => {
    const all = withTx(g(), (d) => d.players.forEach((p) => { p.away = true; }));
    expect(tickAt(all, T0 + 1)!.game!.phase.kind).toBe("action");
    const r = tickAt(all, T0 + D)!;
    expect([r.game!.phase.kind, auc(r).turnId, r.game!.deadline]).toEqual(["bidding", idOf(r, "Ben"), T0 + 2 * D]);
  });
  it("waits out an Away player's empty-deck turn instead of skipping it instantly", () => {
    let r = game(NAMES, { deck: [], first: "Ben", herds: { Anna: { horse: 4 }, Ben: { cow: 2 }, Clara: { cow: 2 } } });
    r = withTx(r, (d) => { pl(d, "Ben").away = true; pl(d, "Clara").away = true; });
    expect(tickAt(r, T0 + 1)!.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
    const next = tickAt(r, T0 + D)!;
    expect([next.game!.phase, next.game!.deadline]).toEqual([{ kind: "action", playerId: idOf(r, "Clara") }, T0 + 2 * D]);
  });
});

describe("pause", () => {
  it("freezes timers and restarts the current decision at full length on resume", () => {
    let r = act(g(), "Anna", { type: "pause" }, T0 + 5_000);
    expect([r.status, r.game!.deadline, r.log.at(-1)!.text]).toEqual(["PAUSED", null, "Game paused by Anna."]);
    expect(reject(r, "Anna", choose)).toBe("paused");
    r = tickAt(r, T0 + 500_000)!;
    expect(r.game!.phase.kind).toBe("action");
    r = act(r, "Anna", { type: "resume" }, T0 + 500_000);
    expect([r.status, r.game!.deadline]).toEqual(["PLAYING", T0 + 500_000 + D]);
  });
  it("is host-only", () => expect(reject(g(), "Ben", { type: "pause" })).toBe("notHost"));
});

describe("host transfer and closing", () => {
  it("passes host after 2 minutes of host disconnection, also while paused", () => {
    let r = run(act(g(), "Anna", { type: "pause" }), { type: "disconnect", token: tok("Anna") })!;
    expect(tickAt(r, T0 + 119_999)!.hostId).toBe(idOf(r, "Anna"));
    r = tickAt(r, T0 + 120_000)!;
    expect([r.hostId, r.log.at(-1)!.text]).toEqual([idOf(r, "Ben"), "Ben is now the host."]);
  });
  it("skips disconnected players when choosing the new host", () => {
    const r = run(run(lobby(), { type: "disconnect", token: tok("Anna") }), { type: "disconnect", token: tok("Ben") })!;
    expect(tickAt(r, T0 + 120_000)!.hostId).toBe(idOf(r, "Clara"));
  });
  it("passes host on a later reconnect when nobody else was connected", () => {
    let r = lobby();
    for (const n of NAMES) r = run(r, { type: "disconnect", token: tok(n) })!;
    expect(run(r, { type: "connect", token: tok("Clara") }, T0 + 180_000)!.hostId).toBe(idOf(r, "Clara"));
  });
  it("closes after 10 minutes with nobody connected, unless someone reconnects", () => {
    let r = lobby();
    for (const n of NAMES) r = run(r, { type: "disconnect", token: tok(n) })!;
    expect(outcome(r, { type: "tick" }, T0 + 600_000)).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "inactive" }] });
    expect(tickAt(run(r, { type: "connect", token: tok("Ben") }, T0 + 300_000), T0 + 600_000)).not.toBeNull();
  });
  it("closes a finished room after 5 minutes unless the host plays again", () => {
    const done = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4 }, Clara: { cat: 4 } } });
    expect(outcome(done, { type: "tick" }, T0 + 300_000)).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "finished" }] });
    expect(tickAt(act(done, "Anna", { type: "playAgain" }, T0 + 60_000), T0 + 300_000)!.status).toBe("PLAYING");
  });
  it("reports the earliest pending deadline", () => {
    expect(nextDeadline(g())).toBe(T0 + D);
    expect(nextDeadline(run(lobby(), { type: "disconnect", token: tok("Anna") }, T0 + 1_000))).toBe(T0 + 121_000);
    expect(nextDeadline(act(g(), "Anna", { type: "pause" }))).toBeNull();
    expect(nextDeadline(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/rules/timers.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `timers.ts`, the dispatcher cases and hooks, and `tickAt`.
- [ ] **Step 4: Run** `npx vitest run test/rules` and `npm run typecheck`. Expected: all pass; tsc exits 0.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(rules): timeouts, away, pause, host transfer and room closing"`.

### Task 10: Protocol and per-player views

**Files:**
- Create: `src/protocol.ts`, `src/rules/view.ts`
- Test: `test/protocol.test.ts`, `test/rules/view.test.ts`

**Interfaces:**
- Consumes: all state types (Task 1), `FINISHED_CLOSE_MS`, `DONKEY_PAYOUTS`, `cashOf`.
- Produces (the server and the client both depend on these exact shapes):

```ts
// src/protocol.ts — imports only from ./rules/types and ./rules/errors, so it is safe in the browser and in workerd
export type ClientMessage =
  | { type: "hello"; clientToken: string }
  | { type: "createRoom"; roomName: string; password: string; playerName: string; seat: number }
  | { type: "joinRoom"; roomId: string; password: string; playerName: string; seat: number }
  | Intent;
export type ServerMessage =
  | { type: "view"; view: View } | { type: "error"; code: ErrorCode; message: string }
  | { type: "roomClosed"; reason: CloseReason } | { type: "removed" };
export interface PublicPlayer { id: string; name: string; seat: Seat; connected: boolean; away: boolean; out: boolean; moneyCount: number; herd: Herd }
export type PublicPhase =
  | { kind: "action"; playerId: string }
  | { kind: "bidding" | "decision"; card: Animal; auctioneerId: string; topBid: number; topBidderId: string | null; turnId: string | null; passed: string[]; excluded: string[] }
  | { kind: "bluff"; card: Animal; auctioneerId: string; blufferId: string; bid: number; cards: MoneyValue[]; excluded: string[] }
  | { kind: "payment"; card: Animal; payerId: string; receiverId: string; amount: number }
  | { kind: "tradeSetup"; challengerId: string; terms: TradeTerms | null; ties: number }
  | { kind: "tradeResponse"; challengerId: string; terms: TradeTerms; ties: number; offerCount: number };
export interface PublicTrade { id: number; challengerId: string; defenderId: string; animal: Animal; count: 1 | 2; ties: number;
  challengerCards: number; defenderCards: number | null; winnerId: string | null }
export interface TradeReveal { id: number; challengerId: string; defenderId: string; animal: Animal; count: 1 | 2; ties: number;
  challengerValues: MoneyValue[]; defenderValues: MoneyValue[]; challengerTotal: number; defenderTotal: number; winnerId: string | null }
export interface GameView { deckCount: number; donkeysRevealed: number; nextDonkeyPayout: MoneyValue | null; activePlayerId: string;
  phase: PublicPhase; deadline: number | null; lastTrade: PublicTrade | null }
export interface RoomView { status: RoomStatus; roomId: string; roomName: string; hostId: string; settings: Settings; players: PublicPlayer[];
  game: GameView | null; log: LogEntry[]; scores: ScoreRow[] | null; closeAt: number | null }
export interface MeView { id: string; money: MoneyCard[]; offer: MoneyCard[] | null; buyEnabled: boolean | null;
  tradeReveal: TradeReveal | null; payment: PaymentRecord | null }
export interface View { serverTime: number; me: MeView | null; room: RoomView | null }
export function parseClientMessage(raw: string): ClientMessage | null
// src/rules/view.ts
export function buildView(room: Room | null, token: string | null, now: number): View
```

Rules:
- **buildView** returns `{ serverTime: now, me: null, room: null }` for a null room or an unseated token. Otherwise:
  - Players: public fields only (`moneyCount = money.length`).
  - tradeResponse: `offer` becomes `offerCount`.
  - `me.offer`: the challenger's own `phase.offer` during tradeResponse.
  - `me.buyEnabled`: auctioneer during `decision` only, as `cash >= topBid`; otherwise `null`.
  - `me.tradeReveal`: built from `lastTrade` only when `defenderCards !== null` and I am the challenger or defender.
  - `me.payment`: `lastPayment` only when I am the payer or receiver.
  - `lastTrade` publicly: counts only.
  - `nextDonkeyPayout = DONKEY_PAYOUTS[donkeysRevealed] ?? null`.
  - `closeAt = finishedAt + FINISHED_CLOSE_MS` when FINISHED, otherwise `null`.
- **parseClientMessage** returns `null` when:
  - the input is over 4096 characters, isn't valid JSON, isn't an object, or has an unknown `type`;
  - a field has the wrong type: numbers must be finite; strings have limits (token 1–64, names ≤ 100, password ≤ 200, roomId ≤ 20, ids ≤ 64); `cardIds` must be an array of at most 60 strings;
  - an enum is out of range (`action`, `decision`, `moneyRule`, `animal` ∈ `ANIMALS`).

  Otherwise it returns a fresh object with only the known fields.

- [ ] **Step 1: Write the failing tests** `test/protocol.test.ts` and `test/rules/view.test.ts`

```ts
// test/protocol.test.ts
describe("parseClientMessage", () => {
  it("accepts well-formed messages and drops unknown fields", () => {
    expect(parseClientMessage('{"type":"bid","amount":20,"x":1}')).toEqual({ type: "bid", amount: 20 });
    expect(parseClientMessage('{"type":"pass"}')).toEqual({ type: "pass" });
    const offer = { type: "cowTradeOffer", targetId: "p1", animal: "cow", count: 2, cardIds: ["a"] };
    expect(parseClientMessage(JSON.stringify(offer))).toEqual(offer);
  });
  it.each([
    "not json", "[]", "null", '{"type":"nope"}', '{"type":"bid","amount":"20"}', '{"type":"bid","amount":1e999}',
    '{"type":"pay","cardIds":"a"}', '{"type":"pay","cardIds":[1]}', '{"type":"chooseAction","action":"steal"}',
    '{"type":"cowTradeOffer","targetId":"p","animal":"unicorn","count":1,"cardIds":[]}',
    JSON.stringify({ type: "hello", clientToken: "x".repeat(65) }), JSON.stringify({ type: "pay", cardIds: Array(61).fill("a") }), "x".repeat(5000),
  ])("rejects malformed input %#", (raw) => expect(parseClientMessage(raw)).toBeNull());
});

// test/rules/view.test.ts
const view = (r: Room, name: string) => buildView(r, tok(name), T0);
const json = (v: View) => JSON.stringify(v);
const cardIdsOf = (r: Room, name: string) => pl(r, name).money.map((c) => c.id);
const auctionTo = (r: Room, amount: number) =>
  act(act(act(r, "Anna", { type: "chooseAction", action: "auction" }), "Ben", { type: "bid", amount }), "Clara", { type: "pass" });
const challenge = (r: Room, cardIds: (s: Room) => string[]) => {
  const s = act(r, "Anna", { type: "chooseAction", action: "cowTrade" });
  return act(s, "Anna", { type: "cowTradeOffer", targetId: idOf(s, "Ben"), animal: "cow", count: 2, cardIds: cardIds(s) });
};
const cows = { Anna: { cow: 2 }, Ben: { cow: 2 } };

describe("views", () => {
  it("tells visitors nothing about the room", () => {
    expect(buildView(lobby(), "tok-zed", T0)).toEqual({ serverTime: T0, me: null, room: null });
    expect(buildView(null, tok("Anna"), T0)).toEqual({ serverTime: T0, me: null, room: null });
  });
  it("shows public player fields, only your own cards, and never a token", () => {
    const r = game();
    for (const n of NAMES) {
      const v = view(r, n), s = json(v);
      expect(v.me!.money.map((c) => c.id).sort()).toEqual(cardIdsOf(r, n).sort());
      for (const o of NAMES.filter((x) => x !== n)) for (const id of cardIdsOf(r, o)) expect(s).not.toContain(id);
      for (const t of NAMES.map(tok)) expect(s).not.toContain(t);
      expect(Object.keys(v.room!.players[0]!).sort()).toEqual(["away", "connected", "herd", "id", "moneyCount", "name", "out", "seat"]);
    }
  });
  it("shows Buy availability only to the auctioneer, and others cannot tell the difference", () => {
    const poor = auctionTo(game(NAMES, { money: { Anna: [10, 10, 10, 10, 10, 10, 10] } }), 100);
    const rich = auctionTo(game(NAMES, { money: { Anna: [50, 50, 50, 10, 10, 10, 10] } }), 100);
    expect([view(poor, "Anna").me!.buyEnabled, view(rich, "Anna").me!.buyEnabled]).toEqual([false, true]);
    for (const n of ["Ben", "Clara"]) {
      expect(view(poor, n).me!.buyEnabled).toBeNull();
      expect(view(poor, n)).toEqual(view(rich, n));
    }
  });
  it("hides a cow trade offer from everyone but the challenger", () => {
    let offered: string[] = [];
    const r = challenge(game(NAMES, { herds: cows }), (s) => (offered = ids(s, "Anna", 50, 10)));
    expect(view(r, "Anna").me!.offer!.map((c) => c.id)).toEqual(offered);
    for (const n of ["Ben", "Clara"]) {
      expect(view(r, n).room!.game!.phase).toMatchObject({ kind: "tradeResponse", offerCount: 2 });
      expect(view(r, n).me!.offer).toBeNull();
      for (const id of offered) expect(json(view(r, n))).not.toContain(id);
    }
  });
  it("reveals counter-offer values only to the two participants, in both money modes", () => {
    for (const moneyRule of ["swap", "loserTakesBoth"] as const) {
      const o = challenge(game(NAMES, { settings: { moneyRule }, herds: cows, money: { Anna: [10, 10, 50, 0], Ben: [100, 100, 10, 10] } }),
        (s) => ids(s, "Anna", 10, 10, 50));
      const r = act(o, "Ben", { type: "cowTradeResponse", cardIds: ids(o, "Ben", 100, 100, 10) });
      expect(view(r, "Anna").me!.tradeReveal).toMatchObject({ challengerTotal: 70, defenderTotal: 210, winnerId: idOf(r, "Ben") });
      expect(view(r, "Ben").me!.tradeReveal).toMatchObject({ challengerValues: [10, 10, 50], defenderValues: [100, 100, 10] });
      const clara = view(r, "Clara");
      expect(clara.me!.tradeReveal).toBeNull();
      expect(clara.room!.game!.lastTrade).toMatchObject({ challengerCards: 3, defenderCards: 3, winnerId: idOf(r, "Ben") });
      for (const id of ["Anna-1", "Anna-2", "Anna-3", "Ben-1", "Ben-2", "Ben-3"]) expect(json(clara)).not.toContain(id);
      for (const e of r.log) expect(e.text).not.toMatch(/\b(70|210)\b/);
    }
  });
  it("reveals nothing on a forfeit", () => {
    const o = challenge(game(NAMES, { herds: cows }), (s) => ids(s, "Anna", 0));
    const r = act(o, "Ben", { type: "cowTradeResponse", cardIds: [] });
    for (const n of NAMES) expect(view(r, n).me!.tradeReveal).toBeNull();
    expect(view(r, "Clara").room!.game!.lastTrade).toMatchObject({ challengerCards: 1, defenderCards: null });
  });
  it("shows payment cards to the payer and receiver only", () => {
    let r = act(auctionTo(game(), 20), "Anna", { type: "auctioneerDecision", decision: "sell" });
    r = act(r, "Ben", { type: "pay", cardIds: ids(r, "Ben", 10, 10) });
    for (const n of ["Anna", "Ben"]) expect(view(r, n).me!.payment).toMatchObject({ amount: 20, cards: [10, 10] });
    expect(view(r, "Clara").me!.payment).toBeNull();
  });
  it("shows a called bluff to everyone", () => {
    const r = act(auctionTo(game(), 100), "Anna", { type: "auctioneerDecision", decision: "sell" });
    for (const n of NAMES) expect(view(r, n).room!.game!.phase).toMatchObject({ kind: "bluff", cards: [0, 0, 10, 10, 10, 10, 50] });
  });
  it("includes public game details and the finished-room countdown", () => {
    expect(view(game(), "Ben").room!.game).toMatchObject({ deckCount: 40, donkeysRevealed: 0, nextDonkeyPayout: 50, deadline: T0 + 20_000 });
    const done = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4 }, Clara: { cat: 4 } } });
    expect(view(done, "Ben").room!.closeAt).toBe(T0 + 300_000);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/protocol.test.ts test/rules/view.test.ts`. Expected: FAIL, missing modules.
- [ ] **Step 3: Implement** `protocol.ts` and `view.ts`.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: the whole Node suite passes; tsc exits 0.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat: client protocol and per-player views with no-leak tests"`.

# Part B — Server (Worker + Durable Object, workerd tests)

### Task 11: Worker, password hashing and the GameRoom Durable Object

**Files:**
- Create: `src/password.ts`, `src/worker.ts`, `src/room.ts`, `tsconfig.worker.json`, `test/server/client.ts`
- Modify: `package.json` (scripts)
- Test: `test/server/password.test.ts`, `test/server/room.test.ts`

**Interfaces:**
- Consumes: `reduce` (Task 2), `buildView` (Task 10), `parseClientMessage`, `ClientMessage`, `ServerMessage`, `View` (Task 10), `ERROR_TEXT` (Task 1).
- Produces:

```ts
// src/password.ts — PBKDF2-SHA-256, 100_000 iterations, 16-byte random salt, 256-bit key, base64 strings
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }>
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> // constant-time compare
// src/worker.ts
export default { fetch(request: Request, env: Env): Promise<Response> } satisfies ExportedHandler<Env>
export { GameRoom } from "./room";
// src/room.ts
interface Attachment { token: string | null; fails: number[] }  // fails = timestamps of bad-credential joins
export function cryptoRng(): () => number                       // crypto.getRandomValues → [0, 1)
export class GameRoom extends DurableObject<Env> {
  fetch(request: Request): Promise<Response>
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void>
  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void>
}
// test/server/client.ts
export interface TestClient {
  token: string; raw: string[]; view: View;          // raw = every message received; view = latest view
  send(msg: ClientMessage | string): void;
  request(msg: ClientMessage | string): Promise<ServerMessage>; // drop queued messages, send, resolve with the next "view" or "error"
  waitView(pred: (v: View) => boolean): Promise<View>;        // latest view if it matches, else the next matching one; rejects after 2 s
  next<T extends ServerMessage["type"]>(type: T): Promise<Extract<ServerMessage, { type: T }>>; // next queued message of that type
  closed: Promise<number>; close(): void;            // closed resolves with the close code
}
export async function connect(token = crypto.randomUUID()): Promise<TestClient>
  // exports.default.fetch("https://kuhhandel.test/ws", { headers: { Upgrade: "websocket" } }) from "cloudflare:workers",
  // accept the socket, send hello, await the first view. (If `exports` is untyped, cast it to { default: Fetcher }.)
export const roomStub = () => env.GAME_ROOM.get(env.GAME_ROOM.idFromName("main"));
export async function setupGame(names: string[]): Promise<TestClient[]> // names[0] creates "Barn"/password "pw" at seat 1; others join at seats 2..n
```

Config: create `tsconfig.worker.json` as `{ "extends": "./tsconfig.json", "compilerOptions": { "types": ["./worker-configuration.d.ts", "@cloudflare/vitest-plugin/types"] }, "include": ["src", "test/server"] }`. Then add or replace these scripts:

```jsonc
"dev:server": "node -e \"require('fs').mkdirSync('web/dist',{recursive:true})\" && wrangler dev",
"test:server": "node -e \"require('fs').mkdirSync('web/dist',{recursive:true})\" && vitest run --config vitest.server.config.ts",
"typecheck": "wrangler types && tsc -p tsconfig.json && tsc -p tsconfig.worker.json"
```

Behaviour:
- **Worker:** `GET /ws` with `Upgrade: websocket` goes to `env.GAME_ROOM.get(env.GAME_ROOM.idFromName("main")).fetch(request)`; `/ws` without the upgrade gets 426; every other path goes to `env.ASSETS.fetch(request)`.
- **Constructor:** load the room inside `ctx.blockConcurrencyWhile` as `(await storage.get<Room>("room")) ?? null`, and call `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"))`. Client keepalives then never wake the object.
- **fetch:** create a `WebSocketPair`, call `ctx.acceptWebSocket(server)` and `server.serializeAttachment({ token: null, fails: [] })`, and return a 101 response with `webSocket: client`.
- **webSocketMessage:** if the message isn't a string or `parseClientMessage` returns null → error `badMessage`.
  - `hello`: the token must match `/^[0-9a-f-]{36}$/i`. Every other socket bound to that token gets its attachment token set to null and is closed with `4001, "Replaced by a newer connection"`. Then bind this socket and dispatch `connect`.
  - Anything else sent before `hello` → `badMessage`.
  - `createRoom`: the password must be 1–64 characters (`badPassword`). If a room already exists → `roomInUse`, without hashing. Otherwise `hashPassword`, then dispatch `create`.
  - `joinRoom`: drop `fails` entries older than 60 s; 5 or more remaining → `tooManyAttempts`. A missing room, a mismatched `roomId.trim().toUpperCase()` or a failed `verifyPassword` records a failure and returns `badCredentials`. If `room.passwordHash` changed during the await, also `badCredentials`. Otherwise dispatch `join`.
  - Any other message is dispatched as `{ type: "intent", token, intent }`.
- **dispatch(action, now, origin):**
  1. Call `reduce(room, action, { now, rng: cryptoRng() })`.
  2. On an error, send `{ type: "error", code, message }` to the origin only and stop.
  3. Otherwise store the new state: `storage.put("room", state)`, or `storage.deleteAll()` when it is null.
  4. Handle events: `removed` sends `{ type: "removed" }` to that token's sockets; `closed` sends `{ type: "roomClosed", reason }` to every socket.
  5. Send each socket `{ type: "view", view: buildView(room, attachment.token, now) }`.

  Wrap every `ws.send` in try/catch.
- **webSocketClose:** if the socket was bound and no other socket is bound to the same token, dispatch `disconnect`. Don't call `ws.close()`: at this compatibility date the runtime replies to close frames itself.

- [ ] **Step 1: Write the failing tests**

```ts
// test/server/password.test.ts
it("verifies only the right password, with a fresh salt each time", async () => {
  const a = await hashPassword("moo"), b = await hashPassword("moo");
  expect([a.salt === b.salt, a.hash === b.hash]).toEqual([false, false]);
  expect(await verifyPassword("moo", a.hash, a.salt)).toBe(true);
  expect(await verifyPassword("Moo", a.hash, a.salt)).toBe(false);
  expect(JSON.stringify(a)).not.toContain("moo");
});

// test/server/room.test.ts
afterEach(async () => { await abortAllDurableObjects(); await reset(); });
const create = { type: "createRoom", roomName: "B", password: "x", playerName: "Zed", seat: 2 } as const;
const ben = (v: View) => v.room!.players.find((p) => p.name === "Ben")!;

describe("GameRoom", () => {
  it("answers plain HTTP on /ws with 426", async () => {
    expect((await exports.default.fetch("https://kuhhandel.test/ws")).status).toBe(426);
  });
  it("gives a visitor an empty view after hello", async () => {
    expect((await connect()).view).toEqual({ serverTime: expect.any(Number), me: null, room: null });
  });
  it("makes the creator host and refuses a second room", async () => {
    const [anna] = await setupGame(["Anna"]);
    expect(anna!.view.room).toMatchObject({ status: "LOBBY", hostId: anna!.view.me!.id });
    expect(await (await connect()).request(create))
      .toEqual({ type: "error", code: "roomInUse", message: "A room is already in use. Ask the host for the room ID and password." });
  });
  it("gives one error for a wrong ID or password, and rate-limits a connection after 5 failures", async () => {
    const [anna] = await setupGame(["Anna"]);
    const roomId = anna!.view.room!.roomId, zed = await connect();
    const join = (id: string, password: string) => zed.request({ type: "joinRoom", roomId: id, password, playerName: "Zed", seat: 2 });
    const badId = await join("ZZZZZZ", "pw"), badPw = await join(roomId, "nope");
    expect(badId).toEqual(badPw);
    expect(badId).toMatchObject({ code: "badCredentials", message: "Room not found or wrong password." });
    for (let i = 0; i < 3; i++) await join(roomId, "nope");
    expect(await join(roomId, "pw")).toMatchObject({ code: "tooManyAttempts" });
    const fresh = await connect();
    expect(await fresh.request({ type: "joinRoom", roomId: roomId.toLowerCase(), password: "pw", playerName: "Zed", seat: 2 }))
      .toMatchObject({ type: "view" });
  });
  it("restores seat and view on reconnect with the same token", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    b!.close();
    await anna!.waitView((v) => !ben(v).connected);
    expect((await connect(b!.token)).view.me!.id).toBe(b!.view.me!.id);
    await anna!.waitView((v) => ben(v).connected);
  });
  it("replaces an older socket for the same token without showing a disconnect", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    const second = await connect(b!.token);
    expect(await b!.closed).toBe(4001);
    expect(second.view.me!.id).toBe(b!.view.me!.id);
    await anna!.request({ type: "imBack" }); // round trip so pending events are processed
    expect(ben(anna!.view).connected).toBe(true);
  });
  it("keeps the room across an eviction", async () => {
    const [anna] = await setupGame(["Anna"]);
    await evictDurableObject(roomStub());
    expect((await connect(anna!.token)).view.room!.roomId).toBe(anna!.view.room!.roomId);
  });
  it("never sends any token to any client", async () => {
    const clients = await setupGame(["Anna", "Ben", "Clara"]);
    await clients[0]!.request({ type: "startGame" });
    for (const c of clients) for (const o of clients) for (const msg of c.raw) expect(msg).not.toContain(o.token);
  });
  it("closes the room for everyone and deletes storage", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    anna!.send({ type: "closeRoom" });
    expect(await b!.next("roomClosed")).toEqual({ type: "roomClosed", reason: "hostClosed" });
    expect(await runInDurableObject(roomStub(), (_i, state) => state.storage.get("room"))).toBeUndefined();
  });
  it("tells a removed player and blocks their token", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    anna!.send({ type: "removePlayer", playerId: b!.view.me!.id });
    expect(await b!.next("removed")).toEqual({ type: "removed" });
    expect(await b!.request({ type: "joinRoom", roomId: anna!.view.room!.roomId, password: "pw", playerName: "Ben", seat: 2 }))
      .toMatchObject({ code: "blocked" });
  });
  it("answers malformed messages with badMessage", async () => {
    expect(await (await connect()).request("not json")).toMatchObject({ type: "error", code: "badMessage" });
  });
});
```

- [ ] **Step 2: Run** `npm run test:server`. Expected: FAIL (`src/worker.ts` is missing).
- [ ] **Step 3: Implement** `password.ts`, `worker.ts`, `room.ts`, `client.ts`, `tsconfig.worker.json` and the scripts.
- [ ] **Step 4: Run** `npm run test:server`, `npm test` and `npm run typecheck`. Expected: all pass; tsc exits 0. A PBKDF2 error mentioning iterations means the workerd limit changed; lower the count to the reported maximum.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(server): worker, password hashing and GameRoom durable object"`.

### Task 12: One alarm for all timers

**Files:**
- Modify: `src/room.ts`
- Test: `test/server/alarm.test.ts`

**Interfaces:**
- Consumes: `nextDeadline` (Task 9), the `test/server/client.ts` helpers (Task 11).
- Produces: `GameRoom.alarm(): Promise<void>` (calls `runTimers(Date.now())`) and `GameRoom.runTimers(now: number): Promise<void>` (dispatches `{ type: "tick" }` at `now`; this is also the test seam). After every accepted dispatch, set `at = nextDeadline(room)`, then call `storage.setAlarm(at)`, or `storage.deleteAlarm()` when `at` is null.

- [ ] **Step 1: Write the failing tests** `test/server/alarm.test.ts`

```ts
afterEach(async () => { await abortAllDurableObjects(); await reset(); });
const alarmAt = () => runInDurableObject(roomStub(), (_i, s) => s.storage.getAlarm());
const timersAt = (now: number) => runInDurableObject(roomStub(), (room: GameRoom) => room.runTimers(now));

describe("GameRoom alarm", () => {
  it("is set to the decision deadline and applies the timeout when it fires", async () => {
    const clients = await setupGame(["Anna", "Ben", "Clara"]);
    const started = (await clients[0]!.request({ type: "startGame" })) as Extract<ServerMessage, { type: "view" }>;
    const deadline = started.view.room!.game!.deadline!;
    expect(await alarmAt()).toBe(deadline);
    await timersAt(deadline);
    await clients[1]!.waitView((v) => v.room!.game!.phase.kind === "bidding");
  });
  it("is cleared when nothing is pending", async () => {
    await setupGame(["Anna"]);
    expect(await alarmAt()).toBeNull();
  });
  it("closes the room 10 minutes after the last player disconnects", async () => {
    const [anna] = await setupGame(["Anna"]);
    anna!.close();
    await vi.waitUntil(async () => (await alarmAt()) !== null);
    await timersAt((await alarmAt())!);
    expect(await runInDurableObject(roomStub(), (_i, s) => s.storage.get("room"))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `npm run test:server -- test/server/alarm.test.ts`. Expected: FAIL (no alarm is set; `runTimers` is not a function).
- [ ] **Step 3: Implement** the scheduling, `alarm()` and `runTimers()`.
- [ ] **Step 4: Run** `npm run test:server` and `npm run typecheck`. Expected: all pass.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(server): single alarm drives decisions, host transfer and closing"`.

# Part C — Client (Vite + Preact)

UI tasks test their pure `web/src/model/` helpers with Vitest and verify components by typecheck, build and a manual check. For manual checks, run `npm run dev:server` and `npm run dev:web` in two terminals. Open http://localhost:5173 in three separate browser profiles (each profile has its own `localStorage`, so its own token). Use Chrome DevTools device mode at 844×390 and 740×360.

### Task 13: App shell — Vite, socket client, state and clock

**Files:**
- Create: `vite.config.ts`, `web/index.html`, `web/tsconfig.json`, `web/src/main.tsx`, `web/src/app.tsx`, `web/src/styles.css`, `web/src/state.ts`, `web/src/net/token.ts`, `web/src/net/socket.ts`, `web/src/model/clock.ts`, `web/src/ui/RotateOverlay.tsx`
- Modify: `package.json` (scripts)
- Test: `web/src/model/clock.test.ts`, `web/src/net/token.test.ts`, `web/src/net/socket.test.ts`, `web/src/state.test.ts`

**Interfaces:**
- Consumes: `ClientMessage`, `ServerMessage`, `View` (Task 10).
- Produces:

```ts
// web/src/net/token.ts
export function uuidV4(fill: (b: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string // no secure context needed (LAN dev)
export function loadToken(store: Pick<Storage, "getItem" | "setItem"> | null): string // key "kuhhandel.token"; a throwing store falls back to a fresh token
// web/src/model/clock.ts
export function clockOffset(serverTime: number, localNow: number): number               // serverTime − localNow
export function secondsLeft(deadline: number | null, localNow: number, offset: number): number | null // ceil, never below 0
// web/src/state.ts (@preact/signals)
export const view: Signal<View | null>; export const conn: Signal<"connecting" | "online" | "offline" | "replaced">;
export const notice: Signal<string | null>; export const toast: Signal<string | null>; export const offset: Signal<number>;
export const homeScreen: Signal<"home" | "create" | "join">;
export function onServerMessage(msg: ServerMessage, localNow: number): void
// web/src/net/socket.ts
export function backoffMs(attempt: number): number // 1000, 2000, 4000, 8000, then 10000
export function startConnection(): void            // ws(s)://host/ws; hello on open; "ping" every 25 s; reconnect with backoff, immediately on visibilitychange→visible and online; close code 4001 → conn "replaced", no reconnect
export function send(msg: ClientMessage): void
```

Rules:
- **onServerMessage:**
  - `view`: sets `view` and `offset`.
  - `error`: sets `toast` to the message.
  - `roomClosed`: sets `notice` and `homeScreen = "home"`. Copy: hostClosed → "The host closed the room." · finished → "The room closed after the game ended." · inactive → "The room closed because nobody was connected for 10 minutes."
  - `removed`: sets `notice` to "You were removed from the room." and `homeScreen = "home"`.
- **app.tsx routes:**
  - `conn === "replaced"` → "This game is open in another tab or window." with a "Use here" button, which calls `startConnection()`.
  - `view === null` → "Connecting…".
  - `view.room === null` → the home screens (Task 14).
  - LOBBY → Lobby (Task 14); PLAYING/PAUSED → Table (Task 15); FINISHED → End screen (Task 17). Placeholders are fine until then.
- **styles.css:**
  - Tokens on `:root`: `--felt: #1F5A43; --felt-dark: #16352A; --ink: #1E1E1E; --paper: #FBF7EE; --accent: #F2B33D; --danger: #D7443E; --muted: #9AA59F`.
  - `html, body, #app { height: 100%; margin: 0; overflow: hidden }`. The body uses `--felt-dark` with `--paper` text and the system UI font, with `font-size: clamp(12px, 3.6vh, 18px)`.
  - `touch-action: manipulation`, `user-select: none`, and padding from `env(safe-area-inset-*)`.
  - `@media (orientation: portrait)` shows a full-screen `RotateOverlay` reading "Please rotate your phone".

Config, exactly:

```ts
// vite.config.ts
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
export default defineConfig({
  root: "web", plugins: [preact()], build: { outDir: "dist", emptyOutDir: true },
  server: { host: true, proxy: { "/ws": { target: "ws://localhost:8787", ws: true } }, fs: { allow: [".."] } },
});
```

```jsonc
// web/tsconfig.json
{ "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client"], "jsx": "react-jsx", "jsxImportSource": "preact", "strict": true, "noEmit": true, "skipLibCheck": true, "isolatedModules": true },
  "include": ["src", "../src/protocol.ts", "../src/rules"] }
// package.json scripts
"dev:web": "vite", "build": "vite build",
"typecheck": "wrangler types && tsc -p tsconfig.json && tsc -p tsconfig.worker.json && tsc -p web/tsconfig.json"
```

`web/index.html` head: `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="theme-color" content="#16352A">`, `<title>Kuhhandel</title>`. The body is `<div id="app"></div>` plus `<script type="module" src="/src/main.tsx"></script>`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/model/clock.test.ts
it("counts down from the server deadline even when the phone clock is off", () => {
  const off = clockOffset(1_000_000, 995_000); // phone 5 s behind
  expect(off).toBe(5_000);
  expect(secondsLeft(1_020_000, 995_000, off)).toBe(20);
  expect(secondsLeft(1_020_000, 1_014_500, off)).toBe(1);
  expect(secondsLeft(1_020_000, 1_100_000, off)).toBe(0);
  expect(secondsLeft(null, 995_000, off)).toBeNull();
});
// web/src/net/token.test.ts
it("makes v4 UUIDs", () => expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
it("reuses a stored token and stores a new one", () => {
  const data = new Map<string, string>();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  const first = loadToken(store);
  expect([data.get("kuhhandel.token"), loadToken(store)]).toEqual([first, first]);
});
it("works without usable storage", () => {
  expect(loadToken(null)).toMatch(/^[0-9a-f-]{36}$/);
  expect(loadToken({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} })).toMatch(/^[0-9a-f-]{36}$/);
});
// web/src/net/socket.test.ts
it("backs off exponentially up to 10 s", () => expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]));
// web/src/state.test.ts
it("stores the view and the clock offset", () => {
  onServerMessage({ type: "view", view: { serverTime: 10_000, me: null, room: null } }, 7_000);
  expect([view.value?.serverTime, offset.value]).toEqual([10_000, 3_000]);
});
it("turns errors into a toast and closures into a homepage notice", () => {
  onServerMessage({ type: "error", code: "badBid", message: "Bid a multiple of 10 above the top bid." }, 0);
  expect(toast.value).toBe("Bid a multiple of 10 above the top bid.");
  onServerMessage({ type: "roomClosed", reason: "inactive" }, 0);
  expect([notice.value, homeScreen.value]).toEqual(["The room closed because nobody was connected for 10 minutes.", "home"]);
  onServerMessage({ type: "removed" }, 0);
  expect(notice.value).toBe("You were removed from the room.");
});
```

- [ ] **Step 2: Run** `npx vitest run web/src`. Expected: FAIL, missing modules.
- [ ] **Step 3: Implement** the files above. `socket.ts` must not touch `window` or `location` at import time.
- [ ] **Step 4: Run** `npx vitest run web/src`, `npm run typecheck` and `npm run build`. Expected: tests pass; tsc exits 0; `web/dist/index.html` exists.
- [ ] **Step 5: Manual check.** The page shows "Connecting…", then the home placeholder. Portrait shows "Please rotate your phone". Stopping `dev:server` makes the app reconnect once it is restarted.
- [ ] **Step 6: Commit:** `git add -A`, then `git commit -m "feat(web): app shell, socket client, state and server clock"`.

### Task 14: Home, Create/Join and Lobby screens

**Files:**
- Create: `web/src/model/lobby.ts`, `web/src/ui/Home.tsx`, `web/src/ui/RoomForm.tsx`, `web/src/ui/Lobby.tsx`, `web/src/ui/ConfirmDialog.tsx`
- Modify: `web/src/app.tsx`
- Test: `web/src/model/lobby.test.ts`

**Interfaces:**
- Consumes: `send`, `view`, `notice`, `toast`, `homeScreen` (Task 13); `ERROR_TEXT`; `PublicPlayer`.
- Produces:

```ts
export interface RoomFormValues { roomName: string; roomId: string; password: string; playerName: string; seat: number | null }
export function normalizeRoomId(input: string): string // uppercase, strip spaces and dashes
export function formProblems(f: RoomFormValues, mode: "create" | "join"): string[]
  // ERROR_TEXT copy, in this order: create → badRoomName, badPassword, badName, badSeat; join → badCredentials (empty ID), badPassword, badName, badSeat
export function shareText(roomId: string, password: string, url: string): string
export function savePassword(store: Pick<Storage, "setItem"> | null, password: string): void // key "kuhhandel.password" (D1)
export function savedPassword(store: Pick<Storage, "getItem"> | null): string | null
export function lobbySeats(players: readonly PublicPlayer[]): (PublicPlayer | null)[] // index 0 = seat 1 … index 4 = seat 5
```

UI (§7.2):
- **Home:** title "Kuhhandel" with "Create room" and "Join room" buttons. Show `notice` above them, dismissible.
- **RoomForm:** the create/join fields; seat as five buttons "1"–"5"; submit "Create room" or "Join room"; a "Back" link. On submit, call `savePassword`, then send `createRoom` or `joinRoom` (the room ID through `normalizeRoomId`). Show `formProblems` and `toast` inline.
- **Lobby:**
  - A table with 5 seats (seat 1 bottom, 2 left, 3 top-left, 4 top-right, 5 right) showing name, a host marker and an offline dot. Room name.
  - Host only: Room ID and password (from `savedPassword`) with "Share", which uses `navigator.share` when available, otherwise copies `shareText` to the clipboard and toasts "Copied".
  - Settings: "Cow trade money" [Swap | Loser takes both] and "Time per decision" [10 | 20 | 30 | 60 s]. The host's controls send `updateSettings`; others see them read-only.
  - The player list has host-only "Remove". "Leave seat" for everyone.
  - Host only: "Start game", enabled for 3–5 players, otherwise with the hint "Waiting for 3–5 players". "Close room" opens `ConfirmDialog` ("Close the room for everyone?", buttons "Cancel" and "Close room").

- [ ] **Step 1: Write the failing tests** `web/src/model/lobby.test.ts`

```ts
it("normalizes room IDs", () => expect(normalizeRoomId(" abc-23x ")).toBe("ABC23X"));
it("checks forms against the server limits", () => {
  expect(formProblems({ roomName: "", roomId: "", password: "", playerName: " ", seat: null }, "create"))
    .toEqual([ERROR_TEXT.badRoomName, ERROR_TEXT.badPassword, ERROR_TEXT.badName, ERROR_TEXT.badSeat]);
  expect(formProblems({ roomName: "", roomId: "ABC234", password: "pw", playerName: "Ben", seat: 2 }, "join")).toEqual([]);
  expect(formProblems({ roomName: "", roomId: " ", password: "pw", playerName: "Ben", seat: 2 }, "join")).toEqual([ERROR_TEXT.badCredentials]);
});
it("builds the share text", () =>
  expect(shareText("ABC234", "moo", "https://k.example")).toBe("Join my Kuhhandel game: https://k.example\nRoom ID: ABC234\nPassword: moo"));
it("places players by seat", () =>
  expect(lobbySeats([{ seat: 3 }, { seat: 1 }] as PublicPlayer[]).map((p) => p?.seat ?? null)).toEqual([1, null, 3, null, null]));
it("remembers the password locally", () => {
  const data = new Map<string, string>();
  savePassword({ setItem: (k, v) => void data.set(k, v) }, "moo");
  expect(savedPassword({ getItem: (k) => data.get(k) ?? null })).toBe("moo");
});
```

- [ ] **Step 2: Run** `npx vitest run web/src/model/lobby.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the model and screens.
- [ ] **Step 4: Run** `npx vitest run web/src`, `npm run typecheck` and `npm run build`. Expected: pass.
- [ ] **Step 5: Manual check.** Profile A creates a room and sees the ID, password and Share. B and C join; a wrong password shows "Room not found or wrong password."; a duplicate name shows "That name is already taken." The host changes settings and the others see them update. Remove C, then C rejoining shows "You were removed from this room." Start is disabled with 2 players and enabled with 3. Close room asks for confirmation and sends everyone home with "The host closed the room."
- [ ] **Step 6: Commit:** `git add -A`, then `git commit -m "feat(web): home, create/join forms and lobby"`.

### Task 15: Game table — layout, panels, center and your area

**Files:**
- Create: `web/src/art/index.ts`, `web/src/model/layout.ts`, `web/src/model/money.ts`, `web/src/ui/Table.tsx`, `web/src/ui/OpponentPanel.tsx`, `web/src/ui/CollectionModal.tsx`, `web/src/ui/Center.tsx`, `web/src/ui/MyArea.tsx`, `web/src/ui/AnimalCard.tsx`, `web/src/ui/Countdown.tsx`
- Modify: `web/src/app.tsx`
- Test: `web/src/model/layout.test.ts`, `web/src/model/money.test.ts`

**Interfaces:**
- Consumes: `view`, `offset` (Task 13); `secondsLeft`; `ANIMALS`, `ANIMAL_NAME`, `ANIMAL_VALUE`; `herdOf` (Task 3).
- Produces:

```ts
// web/src/art/index.ts (Task 18 adds the SVG imports here)
export const ANIMAL_COLOR: Record<Animal, string> = { rooster: "#D7443E", goose: "#4A9BE0", cat: "#8A56B8", dog: "#9C6B3F", sheep: "#E6DFCB",
  goat: "#7A9A2E", donkey: "#6E7B8B", pig: "#EC8DB4", cow: "#1F9E8F", horse: "#E8B230" };
// web/src/model/layout.ts
export type Pos = "bottom" | "left" | "topLeft" | "top" | "topRight" | "right";
export function seatPositions(players: readonly { id: string; seat: number }[], meId: string): { id: string; pos: Pos }[]
  // you first, then clockwise (increasing seat, wrapping); 3: bottom, topLeft, topRight · 4: bottom, left, top, right · 5: bottom, left, topLeft, topRight, right
// web/src/model/money.ts
export function moneySummary(values: readonly number[]): string // "0×2 · 10×4 · 50×1 · Total 90"; [] → "No money"
export function herdChips(herd: Herd): { animal: Animal; count: number; complete: boolean }[] // owned animals, ANIMALS order
// components
AnimalCard({ animal, count?, size: "chip" | "card" }) // ANIMAL_COLOR frame, name, large value; complete set → gold outline
Countdown({ deadline, label })                        // re-renders every 250 ms via secondsLeft(deadline, Date.now(), offset.value)
```

UI (§7.3):
- **Table:** a grid with columns `1fr 2fr 1fr` and rows `auto 1fr auto`. Top row: topLeft/top/topRight. Middle: left · center · right. Bottom: your area across columns 1–2 and the action bar (Task 16) in column 3. Info, log and host-menu icon buttons sit in the top-right corner. No element may scroll the page.
- **OpponentPanel:**
  - Name (ellipsis) and badges "Host", "Turn", "Away", "Out", "Offline".
  - Money card count next to a banknote icon, never values.
  - Animal chips with counts; complete sets highlighted.
  - Tapping opens `CollectionModal`: larger cards grouped by type with complete sets marked; tapping outside closes it.
- **Center:**
  - "Deck {n}", and "Donkeys {k}/4 · next +{payout}".
  - The current card with "Auctioneer: {name}".
  - Bidding: "Top bid {n} · {name}", "Bidding: {name}", passed names struck through, "Excluded: {names}". Decision: "{name} decides". Payment: "{name} pays {amount}".
  - Trade setup: "{name} is setting up a Cow trade", plus "Repeat {ties} of 3" when tied.
  - Trade response: "{C} vs {D} · {animals} · {C} put down {n cards}".
  - A `Countdown` labelled with the waited-on player's name.
- **MyArea:** your animal chips, plus the `moneySummary` button (it opens the MoneyPicker in view mode from Task 16).

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/model/layout.test.ts
const ps = (...seats: number[]) => seats.map((seat) => ({ id: `p${seat}`, seat }));
const show = (xs: { id: string; pos: string }[]) => xs.map((x) => `${x.pos}:${x.id}`);
it("3 players", () => expect(show(seatPositions(ps(1, 2, 4), "p2"))).toEqual(["bottom:p2", "topLeft:p4", "topRight:p1"]));
it("4 players", () => expect(show(seatPositions(ps(1, 2, 3, 5), "p5"))).toEqual(["bottom:p5", "left:p1", "top:p2", "right:p3"]));
it("5 players", () =>
  expect(show(seatPositions(ps(1, 2, 3, 4, 5), "p3"))).toEqual(["bottom:p3", "left:p4", "topLeft:p5", "topRight:p1", "right:p2"]));
// web/src/model/money.test.ts
it("summarizes a hand, zeros included", () => expect(moneySummary([10, 0, 50, 10, 10, 0, 10])).toBe("0×2 · 10×4 · 50×1 · Total 90"));
it("handles an empty hand", () => expect(moneySummary([])).toBe("No money"));
it("lists owned animals and marks complete sets", () =>
  expect(herdChips(herdOf({ horse: 4, cat: 1 }))).toEqual([{ animal: "cat", count: 1, complete: false }, { animal: "horse", count: 4, complete: true }]));
```

- [ ] **Step 2: Run** `npx vitest run web/src/model`. Expected: FAIL.
- [ ] **Step 3: Implement** the models and components.
- [ ] **Step 4: Run** `npx vitest run web/src`, `npm run typecheck` and `npm run build`. Expected: pass.
- [ ] **Step 5: Manual check.** Start a 3-player and a 4-player game. Each profile sees itself at the bottom, with the others placed as in §7.3. Nothing scrolls at 740×360. The center updates live during an auction. Tapping an opponent opens their collection.
- [ ] **Step 6: Commit:** `git add -A`, then `git commit -m "feat(web): game table layout, panels and center"`.

### Task 16: Action controls, money picker and cow-trade wizard

**Files:**
- Create: `web/src/model/controls.ts`, `web/src/ui/ActionBar.tsx`, `web/src/ui/MoneyPicker.tsx`, `web/src/ui/BidControls.tsx`, `web/src/ui/TradeWizard.tsx`, `web/src/ui/AwayBanner.tsx`
- Modify: `web/src/ui/Table.tsx`, `web/src/ui/MyArea.tsx`
- Test: `web/src/model/controls.test.ts`

**Interfaces:**
- Consumes: `View`, `PublicPhase`, `TradeTerms`; `tradeableAnimals`, `maxTradeCount` (Task 3); `MAX_BID`; `send` (Task 13). The tests also use the Task 2–9 test helpers and `buildView` (Task 10).
- Produces:

```ts
export type Enabled = { ok: true } | { ok: false; reason: string };
export interface TradeTarget { playerId: string; animals: { animal: Animal; maxCount: 1 | 2 }[] }
export type Controls =
  | { kind: "watch"; waitingOnId: string | null } | { kind: "away" }
  | { kind: "turn"; auction: Enabled; cowTrade: Enabled }
  | { kind: "bid"; topBid: number; minBid: number }
  | { kind: "decide"; buyEnabled: boolean; topBid: number; topBidderId: string }
  | { kind: "pay"; amount: number }
  | { kind: "tradeSetup"; fixed: TradeTerms | null; targets: TradeTarget[] }
  | { kind: "respond"; challengerId: string; animal: Animal; count: 1 | 2; offerCount: number };
export function waitingOnPublic(phase: PublicPhase): string | null
export function deriveControls(view: View): Controls // Away (while PLAYING) wins over everything else
export function tradeTargets(view: View): TradeTarget[] // in-game opponents in seat order after you, only those with a tradeable animal
export function bidStep(current: number, add: 10 | 50 | 100): number
export function canSubmitBid(amount: number, minBid: number): boolean // multiple of 10, ≥ minBid, ≤ MAX_BID
```

UI (§7.3):
- **ActionBar** renders `deriveControls`:
  - turn: "Auction" and "Cow trade"; a disabled button shows its reason ("Deck is empty" · "No cow trade possible" · "You need a money card").
  - decide: "Sell" and "Buy it" (disabled when not affordable).
- **BidControls:** an amount field starting at `minBid`; "+10/+50/+100" add to the field; "Bid" is enabled only when `canSubmitBid`; plus "Pass".
- **MoneyPicker** (cards sorted by value, tap to toggle, running total):
  - view: read-only.
  - pay: "Selected {total} / Owed {amount}", with "Pay" enabled once the total covers the amount.
  - offer: at least one card; button "Offer".
  - counter: "Counter" needs at least one card; there is also a separate "Put nothing".
- **TradeWizard:** pick player → animal → count (only when `maxCount` is 2) → cards → "Offer". A repeat round shows the fixed terms and the card step only.
- **AwayBanner:** "You're marked Away." with an "I'm back" button that sends `imBack`.

- [ ] **Step 1: Write the failing tests** `web/src/model/controls.test.ts`

```ts
import { act, game, ids, idOf, NAMES, pl, tok, T0, withTx } from "../../../test/rules/helpers";
const controls = (r: Room, name: string) => deriveControls(buildView(r, tok(name), T0));
const auction = { type: "chooseAction", action: "auction" } as const;
const cows = { Anna: { cow: 1 }, Ben: { cow: 1 } };

describe("deriveControls", () => {
  it("offers Auction and Cow trade on your turn, with reasons when disabled", () => {
    expect(controls(game(NAMES, { herds: cows }), "Anna")).toEqual({ kind: "turn", auction: { ok: true }, cowTrade: { ok: true } });
    expect(controls(game(), "Anna")).toMatchObject({ cowTrade: { ok: false, reason: "No cow trade possible" } });
    expect(controls(game(NAMES, { herds: cows, money: { Anna: [] } }), "Anna")).toMatchObject({ cowTrade: { ok: false, reason: "You need a money card" } });
    expect(controls(game(NAMES, { herds: cows, deck: [] }), "Anna")).toMatchObject({ auction: { ok: false, reason: "Deck is empty" } });
    expect(controls(game(), "Ben")).toEqual({ kind: "watch", waitingOnId: idOf(game(), "Anna") });
  });
  it("shows bid controls on your bid turn", () => {
    expect(controls(act(act(game(), "Anna", auction), "Ben", { type: "bid", amount: 30 }), "Clara")).toEqual({ kind: "bid", topBid: 30, minBid: 40 });
  });
  it("shows Sell/Buy to the auctioneer, with Buy only when affordable", () => {
    const r = act(act(act(game(), "Anna", auction), "Ben", { type: "bid", amount: 100 }), "Clara", { type: "pass" });
    expect(controls(r, "Anna")).toEqual({ kind: "decide", buyEnabled: false, topBid: 100, topBidderId: idOf(r, "Ben") });
  });
  it("asks the payer to pay", () => {
    let r = act(act(act(game(), "Anna", auction), "Ben", { type: "bid", amount: 20 }), "Clara", { type: "pass" });
    r = act(r, "Anna", { type: "auctioneerDecision", decision: "sell" });
    expect(controls(r, "Ben")).toEqual({ kind: "pay", amount: 20 });
  });
  it("lists only legal trade targets, with 2 only when both hold 2", () => {
    const r = act(game(NAMES, { herds: { Anna: { cow: 2, cat: 1 }, Ben: { cow: 2 }, Clara: { cat: 1, cow: 1 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
    expect(controls(r, "Anna")).toEqual({ kind: "tradeSetup", fixed: null, targets: [
      { playerId: idOf(r, "Ben"), animals: [{ animal: "cow", maxCount: 2 }] },
      { playerId: idOf(r, "Clara"), animals: [{ animal: "cat", maxCount: 1 }, { animal: "cow", maxCount: 1 }] } ] });
  });
  it("shows the defender how many cards were offered", () => {
    const s = act(game(NAMES, { herds: { Anna: { cow: 2 }, Ben: { cow: 2 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
    const r = act(s, "Anna", { type: "cowTradeOffer", targetId: idOf(s, "Ben"), animal: "cow", count: 2, cardIds: ids(s, "Anna", 10, 0) });
    expect(controls(r, "Ben")).toEqual({ kind: "respond", challengerId: idOf(r, "Anna"), animal: "cow", count: 2, offerCount: 2 });
  });
  it("shows the Away banner to an Away player", () =>
    expect(controls(withTx(game(), (d) => { pl(d, "Ben").away = true; }), "Ben")).toEqual({ kind: "away" }));
});
it("adds quick raises to the field and validates amounts", () => {
  expect(bidStep(40, 50)).toBe(90);
  expect([canSubmitBid(40, 40), canSubmitBid(45, 40), canSubmitBid(30, 40), canSubmitBid(MAX_BID + 10, 40)]).toEqual([true, false, false, false]);
});
```

- [ ] **Step 2: Run** `npx vitest run web/src/model/controls.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the model and components.
- [ ] **Step 4: Run** `npx vitest run web/src`, `npm run typecheck` and `npm run build`. Expected: pass.
- [ ] **Step 5: Manual check.** Play a full auction (bid with jumps, pass, sell, pay). Play a bluff, a buy, and a cow trade with a forfeit, a counter and a tie. Buttons appear only for the player being waited on, and every control is reachable with a thumb at 740×360.
- [ ] **Step 6: Commit:** `git add -A`, then `git commit -m "feat(web): action bar, money picker, bidding and cow-trade wizard"`.

### Task 17: Log, overlays, rules and end screens

**Files:**
- Create: `web/src/model/reveals.ts`, `web/src/ui/GameLog.tsx`, `web/src/ui/BluffOverlay.tsx`, `web/src/ui/TradeRevealModal.tsx`, `web/src/ui/PauseOverlay.tsx`, `web/src/ui/HostMenu.tsx`, `web/src/ui/RulesScreen.tsx`, `web/src/ui/EndScreen.tsx`, `web/src/ui/Toast.tsx`
- Modify: `web/src/ui/Table.tsx`, `web/src/app.tsx`
- Test: `web/src/model/reveals.test.ts`

**Interfaces:**
- Consumes: `TradeReveal`, `ScoreRow`, `Settings`; `animalsText` (Task 2, `src/rules/text.ts`); `Countdown`, `ConfirmDialog` (Tasks 14–15); `send`, `toast` (Task 13).
- Produces:

```ts
export function revealToShow(reveal: TradeReveal | null, seen: ReadonlySet<number>): TradeReveal | null // only reveals not yet dismissed
export function revealText(r: TradeReveal, meId: string, names: Record<string, string>): string
  // "You 70 vs Ben 210. Ben wins 2 Cows." · defender side: "Anna 70 vs You 210. You win 2 Cows." · tie: "You 10 vs Ben 10. Tie (1 of 3)."
export function scoreLine(row: ScoreRow): string // "Cow + Horse = 1800 × 2 = 3600"; no sets → "No complete sets = 0"
export function moneyRuleText(rule: Settings["moneyRule"]): string
  // swap → "Swap: the winner takes the loser's offer and the loser takes the winner's." · loserTakesBoth → "Loser takes both offers."
```

UI (§7.2, §7.3):
- **GameLog:** a collapsible panel toggled by the log icon, newest entry at the bottom, rendered as text only.
- **BluffOverlay:** shown to everyone during phase `bluff`: "Bluff! {name} bid {bid}", the bluffer's notes and a countdown.
- **TradeRevealModal:** shows `revealToShow(me.tradeReveal, seen)` with both offers and `revealText`. "OK" adds the id to `seen`, which persists in `sessionStorage` key `kuhhandel.seenReveals` (wrapped in try/catch).
- **PauseOverlay:** while PAUSED, a greyed screen with a modal "Game paused by {host name}"; the host also sees "Resume".
- **HostMenu:** host only. "Pause" or "Resume", plus "Close room" through `ConfirmDialog`.
- **RulesScreen:** opened from the info button. A short summary (turn options, auction and bluffing, Buy, cow trade and ties, donkey payouts, scoring and tiebreak, Away), then the active settings: `moneyRuleText` and "Time per decision: {n} s".
- **EndScreen:** ranking rows (rank, name, `scoreLine`) with winners highlighted as "Winner" or "Shared win", and "Room closes in m:ss" counting down to `closeAt`. Host: "Play again" and "Close room".
- **Toast:** shows `toast` for 3 s.

- [ ] **Step 1: Write the failing tests** `web/src/model/reveals.test.ts`

```ts
const reveal: TradeReveal = { id: 7, challengerId: "a", defenderId: "b", animal: "cow", count: 2, ties: 0,
  challengerValues: [10, 10, 50], defenderValues: [100, 100, 10], challengerTotal: 70, defenderTotal: 210, winnerId: "b" };
const names = { a: "Anna", b: "Ben" };
it("shows each reveal once", () => {
  expect(revealToShow(reveal, new Set())).toBe(reveal);
  expect(revealToShow(reveal, new Set([7]))).toBeNull();
  expect(revealToShow(null, new Set())).toBeNull();
});
it("describes the reveal from each side", () => {
  expect(revealText(reveal, "a", names)).toBe("You 70 vs Ben 210. Ben wins 2 Cows.");
  expect(revealText(reveal, "b", names)).toBe("Anna 70 vs You 210. You win 2 Cows.");
  expect(revealText({ ...reveal, winnerId: null, ties: 1, defenderTotal: 70 }, "a", names)).toBe("You 70 vs Ben 70. Tie (1 of 3).");
});
it("explains each score", () => {
  expect(scoreLine({ playerId: "a", sets: ["cow", "horse"], setValue: 1800, multiplier: 2, score: 3600, rank: 1, winner: true }))
    .toBe("Cow + Horse = 1800 × 2 = 3600");
  expect(scoreLine({ playerId: "b", sets: [], setValue: 0, multiplier: 0, score: 0, rank: 2, winner: false })).toBe("No complete sets = 0");
});
it("describes the money rule", () => expect(moneyRuleText("loserTakesBoth")).toBe("Loser takes both offers."));
```

- [ ] **Step 2: Run** `npx vitest run web/src/model/reveals.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the model and components.
- [ ] **Step 4: Run** `npx vitest run web/src`, `npm run typecheck` and `npm run build`. Expected: pass.
- [ ] **Step 5: Manual check.**
  - Bluff: the overlay shows on all three profiles for 5 s.
  - Countered cow trade: the reveal modal shows only on the two participants, once each.
  - Pause greys every screen and only the host has Resume.
  - The log never shows offer or payment values.
  - The end screen ranks players, Play again restarts, and the countdown runs.
- [ ] **Step 6: Commit:** `git add -A`, then `git commit -m "feat(web): log, overlays, rules screen and end screen"`.

### Task 18: Original art

**Files:**
- Create: `web/src/art/animals/{rooster,goose,cat,dog,sheep,goat,donkey,pig,cow,horse}.svg`, `web/src/art/money/note-{0,10,50,100,200,500}.svg`, `web/src/art/card-back.svg`, `web/src/art/icon.svg`, `web/src/ui/MoneyNote.tsx`, `web/src/ui/ArtPreview.tsx`
- Modify: `web/src/art/index.ts`, `web/src/ui/AnimalCard.tsx`, `web/src/ui/MoneyPicker.tsx`, `web/src/ui/BluffOverlay.tsx`, `web/src/ui/TradeRevealModal.tsx`, `web/src/ui/Center.tsx` (face-down offer cards), `web/src/app.tsx` (dev-only `?art` route to `ArtPreview`)
- Test: `web/src/art/art.test.ts`

**Interfaces:**
- Consumes: `ANIMAL_COLOR` (Task 15), `ANIMALS`, `MoneyValue`.
- Produces: in `art/index.ts`, `ANIMAL_ART: Record<Animal, string>`, `NOTE_ART: Record<MoneyValue, string>` and `CARD_BACK: string` (Vite asset URLs). Component `MoneyNote({ value, size })` renders `NOTE_ART[value]` with `alt={String(value)}`. `ArtPreview` shows every card and note at chip and full size, so the art can be reviewed at 32 px.

Art brief (§10):
- **All art:** flat vector with bold `#1E1E1E` outlines (stroke width 3–4, round joins). At most 4 fills besides ink and white. No gradients, filters, raster images, scripts or external references. Must read at 32 px; at most 6 KB per file. Dry, deadpan expressions: no baby proportions, no sparkly eyes, nothing sexual or crude. Original; never imitate the Ravensburger illustrations.
- **Animals:** `viewBox="0 0 100 100"`, head and shoulders, transparent background (the card frame supplies the animal colour), no `<text>`.

  | Animal | Frame | Character |
  |---|---|---|
  | Rooster | #D7443E | unimpressed: heavy half-closed lids, flat beak line, slightly wilted comb |
  | Goose | #4A9BE0 | suspicious side-eye, neck pulled back |
  | Cat | #8A56B8 | indifferent: looking away, eyes narrowed to slits |
  | Dog | #9C6B3F | tired: droopy ears, bags under the eyes |
  | Sheep | #E6DFCB | nervous conformist: wide eyes, tight polite smile |
  | Goat | #7A9A2E | chewing the corner of a banknote, blank stare |
  | Donkey | #6E7B8B | mildly confused: one ear up, one flopped, one raised brow |
  | Pig | #EC8DB4 | overconfident: chin up, smirk, sunglasses pushed up on the forehead |
  | Cow | #1F9E8F | bored: half-lidded, chewing cud |
  | Horse | #E8B230 | smug: raised eyebrow, side smirk, swept mane |

- **Money notes:** `viewBox="0 0 160 90"`, with the header "BARNYARD RESERVE", the value as a large bold `<text>`, a one-line caption and a small emblem. Use `font-family="system-ui, sans-serif"`.
  - Fills: 0 `#CFC8B8` · 10 `#9CCB86` · 50 `#8EC0E6` · 100 `#F0B36A` · 200 `#C29BDA` · 500 `#E58C78`.
  - Captions: 0 "Backed by pure confidence." · 10 "Barely legal tender." · 50 "Accepted at most barns." · 100 "Do not feed to the goat." · 200 "Probably real." · 500 "The horse approves."
- **card-back.svg:** the note shape with a "BARNYARD RESERVE" seal pattern and no value, used for face-down offers.
- **icon.svg:** `viewBox="0 0 512 512"`, the bored cow's head on `#16352A`, with everything important inside the central 80% (the maskable safe zone).

- [ ] **Step 1: Write the failing test** `web/src/art/art.test.ts`

```ts
const animals = import.meta.glob("./animals/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const notes = import.meta.glob("./money/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const VALUES = [0, 10, 50, 100, 200, 500];
it("has one SVG per animal and per money value", () => {
  expect(Object.keys(animals).sort()).toEqual(ANIMALS.map((a) => `./animals/${a}.svg`).sort());
  expect(Object.keys(notes).sort()).toEqual(VALUES.map((v) => `./money/note-${v}.svg`).sort());
});
it("keeps every animal flat, outlined, self-contained and small", () => {
  for (const [file, svg] of Object.entries(animals)) {
    expect(svg, file).toContain('viewBox="0 0 100 100"');
    expect(svg, file).toMatch(/stroke="#1E1E1E"/i);
    expect(svg, file).not.toMatch(/<(image|script|text|linearGradient|radialGradient|filter)\b|href="http/i);
    expect(svg.length, file).toBeLessThan(6_000);
  }
});
it("gives every animal a distinct colour", () => expect(new Set(Object.values(ANIMAL_COLOR)).size).toBe(10));
it("prints each value on its note", () => { for (const v of VALUES) expect(notes[`./money/note-${v}.svg`]).toContain(`>${v}<`); });
```

- [ ] **Step 2: Run** `npx vitest run web/src/art`. Expected: FAIL, no files found.
- [ ] **Step 3: Draw** the SVGs to the brief, then wire them into `index.ts` and the components.
- [ ] **Step 4: Run** `npx vitest run web/src`, `npm run typecheck` and `npm run build`. Expected: pass.
- [ ] **Step 5: Manual check.** Open http://localhost:5173/?art. Each animal is recognisable and distinct as a chip at 32 px. Expressions read as deadpan, not cute. Values are legible on every note.
- [ ] **Step 6: Commit:** `git add -A`, then `git commit -m "feat(web): original animal, money and icon artwork"`.

### Task 19: PWA, wake lock and turn alerts

**Files:**
- Create: `web/public/manifest.webmanifest`, `web/public/sw.js`, `scripts/icons.mjs`, `web/public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png` (generated), `web/src/model/alerts.ts`, `web/src/device/alert.ts`, `web/src/device/wakeLock.ts`, `web/src/device/pwa.ts`
- Modify: `web/index.html`, `web/src/main.tsx`, `package.json` (add `"icons": "node scripts/icons.mjs"`)
- Test: `web/src/model/alerts.test.ts`

**Interfaces:**
- Consumes: `View`, `waitingOnPublic` (Task 16), `view` (Task 13), `icon.svg` (Task 18).
- Produces:

```ts
// web/src/model/alerts.ts
export function alertKey(view: View | null): string | null
  // `${phase.kind}:${deadline}` when I am waited on in action, bidding, decision, tradeResponse or payment (§7.1); otherwise null
export function shouldAlert(prev: string | null, next: string | null): boolean // next !== null && next !== prev
// web/src/device/*.ts
export function unlockAudio(): void   // create/resume one AudioContext on the first pointerdown (iOS needs a gesture)
export function playTurnAlert(): void // navigator.vibrate?.(120) plus an 880 Hz sine beep, 150 ms, gain 0.2 → 0
export function keepAwake(on: boolean): void // feature-detect navigator.wakeLock; re-acquire on visibilitychange → visible while on
export function registerServiceWorker(): void // only when import.meta.env.PROD and "serviceWorker" in navigator
export function tryLockLandscape(): void      // screen.orientation.lock("landscape") inside try/catch (Android fullscreen only)
```

Exact content:
- **Manifest:**

  ```json
  { "name": "Kuhhandel", "short_name": "Kuhhandel", "start_url": "/", "scope": "/", "display": "fullscreen", "orientation": "landscape",
    "background_color": "#16352A", "theme_color": "#16352A",
    "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
      { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }] }
  ```

- **`sw.js`:** `install` → `skipWaiting()`; `activate` → `clients.claim()`; a no-op `fetch` listener (network only, nothing cached).
- **`index.html` head additions:**
  - `<link rel="manifest" href="/manifest.webmanifest">`
  - `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`
  - `<meta name="mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- **`scripts/icons.mjs` (sharp):** renders `web/src/art/icon.svg` to `icon-192.png` (192), `icon-512.png` (512) and `apple-touch-icon.png` (180). `maskable-512.png` is the icon at 410 px, centred on a 512 px `#16352A` square.
- **`main.tsx` wiring:**
  - An `effect` compares `alertKey(view.value)` with the previous key and calls `playTurnAlert()` when `shouldAlert`.
  - An `effect` calls `keepAwake(status === "PLAYING" || status === "PAUSED")`.
  - `registerServiceWorker()`.
  - The first `pointerdown` calls `unlockAudio()` and `tryLockLandscape()`.

- [ ] **Step 1: Write the failing test** `web/src/model/alerts.test.ts`

```ts
import { act, game, NAMES, tok, T0 } from "../../../test/rules/helpers";
const keyFor = (r: Room, name: string) => alertKey(buildView(r, tok(name), T0));
it("alerts only the player being waited on, and only for the listed decisions", () => {
  const r = game();
  expect([keyFor(r, "Anna"), keyFor(r, "Ben")]).toEqual([`action:${T0 + 20_000}`, null]);
  expect(keyFor(act(r, "Anna", { type: "chooseAction", action: "auction" }), "Ben")).toBe(`bidding:${T0 + 20_000}`);
  const setup = act(game(NAMES, { herds: { Anna: { cow: 1 }, Ben: { cow: 1 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
  expect(keyFor(setup, "Anna")).toBeNull();
  expect(alertKey(null)).toBeNull();
});
it("fires once per new decision", () =>
  expect([shouldAlert(null, "a:1"), shouldAlert("a:1", "a:1"), shouldAlert("a:1", "b:2"), shouldAlert("a:1", null)]).toEqual([true, false, true, false]));
```

- [ ] **Step 2: Run** `npx vitest run web/src/model/alerts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above. Then run `npm run icons` and confirm the four PNGs exist in `web/public/icons/`.
- [ ] **Step 4: Run** `npx vitest run web/src`, `npm run typecheck` and `npm run build`. Expected: pass; `web/dist/manifest.webmanifest`, `web/dist/sw.js` and `web/dist/icons/` exist.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "feat(web): PWA manifest, service worker, wake lock and turn alerts"`.

### Task 20: Deploy and playtest

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything. Produces: the deployed site and the README.

- [ ] **Step 1: Verify everything.** Run `npm test`, `npm run test:server`, `npm run typecheck` and `npm run build`. Expected: all pass.
- [ ] **Step 2: Write `README.md`.**
  - What the project is.
  - `npm install`.
  - Dev setup (`npm run dev:server` and `npm run dev:web` in two terminals; phones on the same Wi-Fi can open `http://<pc-ip>:5173`, but wake lock and install need HTTPS).
  - Tests, and `npm run icons`.
  - Deploy: `npx wrangler login` once, then `npm run deploy`.
  - Optional auto-deploy via Cloudflare Workers Builds from GitHub: build command `npm run build`, deploy command `npx wrangler deploy`.
- [ ] **Step 3: Deploy.** The human runs `npx wrangler login` (interactive), then `npm run deploy`. Expected: the output lists the `GAME_ROOM` Durable Object binding and a `https://kuhhandel.<subdomain>.workers.dev` URL.
- [ ] **Step 4: Playtest on 3 or more real phones**, covering what automated tests can't:
  - Install as a PWA: fullscreen landscape on Android, no browser bars on iPhone. The rotate overlay shows in portrait. The screen stays awake during play. You get vibration and a beep on your turn.
  - Reload during your own decision: the seat and countdown come back. A second tab replaces the first.
  - Put the host in flight mode for 2 min, also while paused: host passes clockwise.
  - The bluff overlay lasts 5 s for everyone. The trade reveal shows only on the two phones involved.
  - A player goes Away after 3 timeouts; "I'm back" clears it.
  - The room closes 5 min after the end screen, and Play again cancels that.
- [ ] **Step 5: Commit:** `git add -A`, then `git commit -m "docs: README with dev, test and deploy instructions"`.

---

## Spec §11 checklist → tests

| §11 item | Tests |
|---|---|
| Creating while a room exists is refused | T2, T11 |
| Same error for a wrong ID or password; rate limit | T11 |
| Duplicate names (case/whitespace) rejected | T2 |
| Removed token cannot rejoin | T2, T11 |
| Join after start refused; reconnect restores seat and view | T5, T11 |
| Host transfer after 2 min, including while paused | T9 |
| Close on host close, 5 min after finish and 10 min empty; Play again cancels | T2, T9, T11, T12 |
| Donkey payouts 50/100/200/500, before the auction | T5, T6 |
| No bids → auctioneer takes it free | T6 |
| Passing final; timeouts count as passes | T6, T9 |
| Any multiple of 10 above top bid, including jumps | T6 |
| Bluff reveal, exclusion, restart, accumulation, free after restart | T7, T9, T10 |
| Buy disabled when unaffordable; others can't tell | T7, T10 |
| No change; overpay to receiver; auto-pay rule | T4, T7, T9 |
| "2 animals" only when both hold ≥ 2; complete sets untradeable | T3, T5, T8 |
| Challenger ≥ 1 card (0 allowed); defender may put nothing | T8 |
| Forfeit: challenger wins, defender gets cards, no reveal | T8, T10 |
| Reveal only to the two participants, in both money modes | T10 |
| Ties repeat; challenger wins after the 3rd | T8 |
| Deck empty + no animals → out; no legal trade → skipped | T5 |
| Game end, scoring, tiebreak, shared win | T3, T5 |
| Away after 3 timeouts, instant defaults, cleared on action | T9 |
| Timers run for disconnected players | T9 |
| Pause freezes; resume restarts the full timer | T9 |
| No hidden value in another player's view or in the log | T10, T11 |
