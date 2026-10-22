import { ERROR_TEXT, RuleError } from "./errors";
import { bid, decide, pass } from "./auction";
import { offer, respond } from "./cowTrade";
import { pay } from "./payment";
import { startGame } from "./setup";
import { chooseAction } from "./turn";
import { closeRoom, createRoom, joinRoom, leaveSeat, removePlayer, requireHost, setConnected, updateSettings } from "./lobby";
import { LOG_LIMIT, type Action, type Ctx, type Outcome, type Player, type Room, type RoomEvent, type Seat } from "./types";

export interface Tx extends Ctx { events: RoomEvent[] }

export function reduce(room: Room | null, action: Action, ctx: Ctx): Outcome {
  const tx: Tx = { ...ctx, events: [] };
  try {
    const draft: Room | null = room ? JSON.parse(JSON.stringify(room)) : null;
    const state = apply(draft, action, tx);
    return { ok: true, state, events: tx.events };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: { code: e.code, message: ERROR_TEXT[e.code] } };
    throw e;
  }
}

function apply(room: Room | null, action: Action, tx: Tx): Room | null {
  switch (action.type) {
    case "create":
      if (room) throw new RuleError("roomInUse");
      return createRoom(action, tx);
    case "join":
      if (!room) throw new RuleError("badCredentials");
      if (room.status !== "LOBBY") throw new RuleError("gameStarted");
      joinRoom(room, action, tx);
      return room;
    case "connect":
    case "disconnect":
      if (room) setConnected(room, action.token, action.type === "connect", tx);
      return room;
    case "tick":
      return room;
    case "intent": {
      if (!room) throw new RuleError("notSeated");
      const p = playerByToken(room, action.token);
      const i = action.intent;
      switch (i.type) {
        case "leaveSeat":
          needLobby(room);
          return leaveSeat(room, p, tx);
        case "removePlayer":
          needLobby(room);
          removePlayer(room, p, i.playerId, tx);
          return room;
        case "updateSettings":
          needLobby(room);
          updateSettings(room, p, i);
          return room;
        case "closeRoom":
          requireHost(room, p);
          return closeRoom(tx);
        case "startGame":
          needLobby(room);
          requireHost(room, p);
          if (room.players.length < 3 || room.players.length > 5) throw new RuleError("notEnoughPlayers");
          startGame(room, tx);
          return room;
        case "playAgain":
          if (room.status !== "FINISHED") throw new RuleError("invalid");
          requireHost(room, p);
          startGame(room, tx);
          return room;
        case "chooseAction":
          needPlaying(room);
          chooseAction(room, p, i.action, tx);
          return room;
        case "bid":
          needPlaying(room);
          bid(room, p, i.amount, tx);
          return room;
        case "pass":
          needPlaying(room);
          pass(room, p, tx);
          return room;
        case "auctioneerDecision":
          needPlaying(room);
          decide(room, p, i.decision, tx);
          return room;
        case "pay":
          needPlaying(room);
          pay(room, p, i.cardIds, tx);
          return room;
        case "cowTradeOffer":
          needPlaying(room);
          offer(room, p, i, tx);
          return room;
        case "cowTradeResponse":
          needPlaying(room);
          respond(room, p, i.cardIds, tx);
          return room;
        default:
          throw new RuleError("invalid");
      }
    }
  }
}

function needLobby(room: Room): void {
  if (room.status !== "LOBBY") throw new RuleError("invalid");
}

function needPlaying(room: Room): void {
  if (room.status === "PAUSED") throw new RuleError("paused");
  if (room.status !== "PLAYING") throw new RuleError("invalid");
}

export function addLog(room: Room, text: string): void {
  room.log.push({ seq: ++room.logSeq, text });
  if (room.log.length > LOG_LIMIT) room.log.splice(0, room.log.length - LOG_LIMIT);
}

export function playerByToken(room: Room, token: string): Player {
  const p = room.players.find((x) => x.token === token);
  if (!p) throw new RuleError("notSeated");
  return p;
}

export function playerById(room: Room, id: string): Player {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new RuleError("invalid");
  return p;
}

export function nextClockwise(room: Room, fromSeat: Seat, ok: (p: Player) => boolean): Player | null {
  const others = room.players.filter((p) => p.seat !== fromSeat && ok(p)).sort((a, b) => a.seat - b.seat);
  return others.find((p) => p.seat > fromSeat) ?? others[0] ?? null;
}
