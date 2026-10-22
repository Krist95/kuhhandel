import { addLog, nextClockwise, playerById, type Tx } from "./engine";
import { RuleError } from "./errors";
import { randomId } from "./rng";
import {
  ANIMALS, DECISION_SECONDS, DEFAULT_SETTINGS, ROOM_ID_ALPHABET,
  type Action, type Herd, type Intent, type Player, type Room, type Seat,
} from "./types";

export function normalizeName(raw: string, max: number): string | null {
  const s = raw.trim();
  const n = [...s].length;
  return n >= 1 && n <= max ? s : null;
}

function emptyHerd(): Herd {
  return Object.fromEntries(ANIMALS.map((a) => [a, 0])) as Herd;
}

function isSeat(n: number): n is Seat {
  return Number.isInteger(n) && n >= 1 && n <= 5;
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

export function createRoom(a: Extract<Action, { type: "create" }>, tx: Tx): Room {
  const roomName = normalizeName(a.roomName, 24);
  if (roomName === null) throw new RuleError("badRoomName");
  const name = normalizeName(a.playerName, 16);
  if (name === null) throw new RuleError("badName");
  if (!isSeat(a.seat)) throw new RuleError("badSeat");
  const roomId = randomId(tx.rng, 6, ROOM_ID_ALPHABET);
  const host = newPlayer(tx, [], a.token, name, a.seat);
  const room: Room = {
    status: "LOBBY", roomId, roomName, passwordHash: a.passwordHash, passwordSalt: a.passwordSalt,
    hostId: host.id, players: [host], blockedTokens: [], settings: { ...DEFAULT_SETTINGS },
    game: null, scores: null, log: [], logSeq: 0, finishedAt: null, nobodySince: null,
  };
  addLog(room, `${name} created the room.`);
  return room;
}

export function joinRoom(room: Room, a: Extract<Action, { type: "join" }>, tx: Tx): void {
  if (room.blockedTokens.includes(a.token)) throw new RuleError("blocked");
  const name = normalizeName(a.playerName, 16);
  if (name === null) throw new RuleError("badName");
  if (!isSeat(a.seat)) throw new RuleError("badSeat");
  const lower = name.toLowerCase();
  if (room.players.some((p) => p.name.toLowerCase() === lower)) throw new RuleError("nameTaken");
  if (room.players.some((p) => p.token === a.token)) throw new RuleError("alreadySeated");
  if (room.players.some((p) => p.seat === a.seat)) throw new RuleError("seatTaken");
  room.players.push(newPlayer(tx, room.players, a.token, name, a.seat));
  room.nobodySince = null;
  addLog(room, `${name} joined.`);
}

export function leaveSeat(room: Room, p: Player, tx: Tx): Room | null {
  room.players = room.players.filter((x) => x.id !== p.id);
  addLog(room, `${p.name} left.`);
  if (room.players.length === 0) return closeRoom(tx);
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

export function updateSettings(room: Room, host: Player, i: Extract<Intent, { type: "updateSettings" }>): void {
  requireHost(room, host);
  const { moneyRule, decisionSeconds } = i;
  if (moneyRule !== undefined && moneyRule !== "swap" && moneyRule !== "loserTakesBoth") throw new RuleError("invalid");
  if (decisionSeconds !== undefined && !(DECISION_SECONDS as readonly number[]).includes(decisionSeconds)) throw new RuleError("invalid");
  if (moneyRule !== undefined) room.settings.moneyRule = moneyRule;
  if (decisionSeconds !== undefined) room.settings.decisionSeconds = decisionSeconds as Room["settings"]["decisionSeconds"];
}

export function setConnected(room: Room, token: string, connected: boolean, tx: Tx): void {
  const p = room.players.find((x) => x.token === token);
  if (!p) return;
  p.connected = connected;
  if (connected) {
    p.disconnectedAt = null;
    room.nobodySince = null;
  } else {
    p.disconnectedAt = tx.now;
    if (room.players.every((x) => !x.connected)) room.nobodySince = tx.now;
  }
}

export function closeRoom(tx: Tx): null {
  tx.events.push({ kind: "closed", reason: "hostClosed" });
  return null;
}

export function requireHost(room: Room, p: Player): void {
  if (room.hostId !== p.id) throw new RuleError("notHost");
}
