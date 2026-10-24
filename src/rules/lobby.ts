import { addLog, nextClockwise, playerById, type Tx } from "./engine";
import { RuleError } from "./errors";
import { randomId } from "./rng";
import {
  ANIMALS, DECISION_SECONDS, ROOM_ID_ALPHABET,
  type Action, type CloseReason, type Herd, type Player, type Room, type Seat, type Settings,
} from "./types";

export function normalizeName(raw: string, max: number): string | null {
  const s = raw.trim();
  const n = [...s].length;
  return n >= 1 && n <= max ? s : null;
}

function emptyHerd(): Herd {
  return Object.fromEntries(ANIMALS.map((a) => [a, 0])) as Herd;
}

function newPlayer(tx: Tx, taken: readonly Player[], token: string, name: string, seat: Seat): Player {
  // reduce may be seeded identically on every call, so keep the ID unique within the room
  let id = randomId(tx.rng);
  while (taken.some((p) => p.id === id)) id = randomId(tx.rng);
  return {
    id, token, name, seat, connected: true, disconnectedAt: null,
    money: [], herd: emptyHerd(), out: false, away: false, timeouts: 0,
  };
}

function validateSettings(moneyRule: unknown, decisionSeconds: unknown): Settings {
  if (moneyRule !== "swap" && moneyRule !== "loserTakesBoth") throw new RuleError("invalid");
  if (!(DECISION_SECONDS as readonly unknown[]).includes(decisionSeconds)) throw new RuleError("invalid");
  return { moneyRule, decisionSeconds: decisionSeconds as Settings["decisionSeconds"] };
}

function firstOpenSeat(players: readonly Player[]): Seat {
  const taken = new Set(players.map((p) => p.seat));
  for (let s = 1; s <= 5; s++) if (!taken.has(s as Seat)) return s as Seat;
  throw new RuleError("roomFull");
}

export function createRoom(a: Extract<Action, { type: "create" }>, tx: Tx): Room {
  const roomName = normalizeName(a.roomName, 24);
  if (roomName === null) throw new RuleError("badRoomName");
  const name = normalizeName(a.playerName, 16);
  if (name === null) throw new RuleError("badName");
  const settings = validateSettings(a.moneyRule, a.decisionSeconds);
  // The DO that owns this room already named it (a.roomId); draw the same number of rng calls as
  // the old random-roomId path did, so an unrelated draw count change doesn't ripple into card/seat dealing.
  randomId(tx.rng, 6, ROOM_ID_ALPHABET);
  const roomId = a.roomId.trim().toUpperCase();
  const host = newPlayer(tx, [], a.token, name, 1);
  const room: Room = {
    status: "LOBBY", roomId, roomName,
    hostId: host.id, players: [host], blockedTokens: [], settings,
    game: null, scores: null, log: [], logSeq: 0, finishedAt: null, nobodySince: null,
  };
  addLog(room, `${name} created the room.`);
  return room;
}

export function joinRoom(room: Room, a: Extract<Action, { type: "join" }>, tx: Tx): void {
  if (room.blockedTokens.includes(a.token)) throw new RuleError("blocked");
  if (room.players.some((p) => p.token === a.token)) throw new RuleError("alreadySeated");
  const name = normalizeName(a.playerName, 16);
  if (name === null) throw new RuleError("badName");
  const lower = name.toLowerCase();
  if (room.players.some((p) => p.name.toLowerCase() === lower)) throw new RuleError("nameTaken");
  const seat = firstOpenSeat(room.players);
  room.players.push(newPlayer(tx, room.players, a.token, name, seat));
  room.nobodySince = null;
  addLog(room, `${name} joined.`);
}

export function leaveSeat(room: Room, p: Player, tx: Tx): Room | null {
  room.players = room.players.filter((x) => x.id !== p.id);
  addLog(room, `${p.name} left.`);
  if (room.players.length === 0) return closeRoom(tx);
  if (room.nobodySince === null && room.players.every((x) => !x.connected)) room.nobodySince = tx.now;
  if (room.hostId === p.id) {
    const next = nextClockwise(room, p.seat, () => true)!;
    room.hostId = next.id;
    addLog(room, `${next.name} is now the host.`);
  }
  return room;
}

export function removePlayer(room: Room, host: Player, playerId: string, tx: Tx): void {
  requireHost(room, host);
  const target = playerById(room, playerId);
  if (target.id === room.hostId) throw new RuleError("invalid");
  room.players = room.players.filter((x) => x.id !== target.id);
  room.blockedTokens.push(target.token);
  tx.events.push({ kind: "removed", token: target.token });
  addLog(room, `${target.name} was removed.`);
}

export function setConnected(room: Room, token: string, connected: boolean, tx: Tx): void {
  const p = room.players.find((x) => x.token === token);
  if (!p) return;
  // A repeated disconnect (an error and then a close, or start-up reconciliation and then a late close)
  // must not move disconnectedAt or nobodySince later.
  if (!connected && !p.connected) return;
  p.connected = connected;
  if (connected) {
    p.disconnectedAt = null;
    room.nobodySince = null;
  } else {
    p.disconnectedAt = tx.now;
    if (room.players.every((x) => !x.connected)) room.nobodySince = tx.now;
  }
}

export function closeRoom(tx: Tx, reason: CloseReason = "hostClosed"): null {
  tx.events.push({ kind: "closed", reason });
  return null;
}

export function requireHost(room: Room, p: Player): void {
  if (room.hostId !== p.id) throw new RuleError("notHost");
}
