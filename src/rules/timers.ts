import { endBluffReveal, decide, pass, startAuction } from "./auction";
import { cancelTrade, respond } from "./cowTrade";
import { addLog, nextClockwise, playerById, type Tx } from "./engine";
import { RuleError } from "./errors";
import { closeRoom, requireHost } from "./lobby";
import { autoPay, settlePayment } from "./payment";
import { endTurn, inGame, phaseDurationMs, setPhase, waitingOn } from "./turn";
import { AWAY_AFTER, FINISHED_CLOSE_MS, HOST_TRANSFER_MS, NOBODY_CONNECTED_MS, type Player, type Room } from "./types";

/** Everything due at tx.now. null = the room closed (event pushed). */
export function tick(room: Room, tx: Tx): Room | null {
  if (room.status === "PLAYING" && room.game!.deadline !== null && room.game!.deadline <= tx.now) {
    applyTimeout(room, tx);
    settleAway(room, tx);
  }
  checkHostTransfer(room, tx.now);
  if (room.nobodySince !== null && room.nobodySince + NOBODY_CONNECTED_MS <= tx.now) return closeRoom(tx, "inactive");
  if (room.status === "FINISHED" && room.finishedAt !== null && room.finishedAt + FINISHED_CLOSE_MS <= tx.now) return closeRoom(tx, "finished");
  return room;
}

export function applyTimeout(room: Room, tx: Tx): void {
  const id = waitingOn(room.game!.phase);
  if (id !== null) {
    const p = playerById(room, id);
    addLog(room, `Time's up for ${p.name}.`);
    p.timeouts++;
    if (p.timeouts >= AWAY_AFTER && !p.away) {
      p.away = true;
      addLog(room, `${p.name} is away.`);
    }
  }
  applyDefault(room, tx);
}

export function applyDefault(room: Room, tx: Tx): void {
  const game = room.game!;
  const phase = game.phase;
  switch (phase.kind) {
    case "action":
      if (game.deck.length > 0) {
        startAuction(room, tx);
      } else {
        addLog(room, `${playerById(room, phase.playerId).name}'s turn was skipped.`);
        endTurn(room, tx);
      }
      return;
    case "bidding":
      pass(room, playerById(room, phase.auction.turnId!), tx);
      return;
    case "decision":
      decide(room, playerById(room, phase.auction.auctioneerId), "sell", tx);
      return;
    case "payment": {
      const payer = playerById(room, phase.payerId);
      settlePayment(room, autoPay(payer.money, phase.amount), tx);
      return;
    }
    case "tradeSetup":
      cancelTrade(room, tx);
      return;
    case "tradeResponse":
      respond(room, playerById(room, phase.terms.defenderId), [], tx);
      return;
    case "bluff":
      endBluffReveal(room, tx);
      return;
  }
}

export function settleAway(room: Room, tx: Tx): void {
  for (;;) {
    if (room.status !== "PLAYING") return;
    const phase = room.game!.phase;
    const id = waitingOn(phase);
    if (id === null || !playerById(room, id).away) return;
    if (!inGame(room).some((p) => !p.away)) return;
    if (phase.kind === "action" && room.game!.deck.length === 0) return;
    applyDefault(room, tx);
  }
}

export function checkHostTransfer(room: Room, now: number): void {
  const host = room.players.find((p) => p.id === room.hostId);
  if (!host || host.connected || host.disconnectedAt === null) return;
  if (host.disconnectedAt + HOST_TRANSFER_MS > now) return;
  const next = nextClockwise(room, host.seat, (p) => p.connected);
  if (!next) return;
  room.hostId = next.id;
  addLog(room, `${next.name} is now the host.`);
}

export function nextDeadline(room: Room | null): number | null {
  if (!room) return null;
  const times: number[] = [];
  if (room.status === "PLAYING" && room.game?.deadline != null) times.push(room.game.deadline);
  const host = room.players.find((p) => p.id === room.hostId);
  if (host && !host.connected && host.disconnectedAt !== null && room.players.some((p) => p.id !== host.id && p.connected)) {
    times.push(host.disconnectedAt + HOST_TRANSFER_MS);
  }
  if (room.nobodySince !== null) times.push(room.nobodySince + NOBODY_CONNECTED_MS);
  if (room.status === "FINISHED" && room.finishedAt !== null) times.push(room.finishedAt + FINISHED_CLOSE_MS);
  return times.length ? Math.min(...times) : null;
}

export function pause(room: Room, host: Player, _tx: Tx): void {
  requireHost(room, host);
  if (room.status !== "PLAYING") throw new RuleError("invalid");
  room.status = "PAUSED";
  room.game!.deadline = null;
  addLog(room, `Game paused by ${host.name}.`);
}

export function resume(room: Room, host: Player, tx: Tx): void {
  requireHost(room, host);
  if (room.status !== "PAUSED") throw new RuleError("invalid");
  const game = room.game!;
  room.status = "PLAYING";
  game.deadline = tx.now + phaseDurationMs(game.phase, room.settings);
  addLog(room, "Game resumed.");
}

export function markActive(room: Room, p: Player): void {
  p.timeouts = 0;
  if (p.away) {
    p.away = false;
    addLog(room, `${p.name} is back.`);
  }
}
