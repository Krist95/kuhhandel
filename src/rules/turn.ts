import { startAuction } from "./auction";
import { addLog, nextClockwise, playerById, type Tx } from "./engine";
import { RuleError } from "./errors";
import { totalAnimals, tradeableAnimals } from "./herd";
import { rankPlayers } from "./scoring";
import { BLUFF_REVEAL_MS, type Phase, type Player, type Room, type Settings } from "./types";

export function phaseDurationMs(phase: Phase, s: Settings): number {
  return phase.kind === "bluff" ? BLUFF_REVEAL_MS : s.decisionSeconds * 1000;
}

export function setPhase(room: Room, phase: Phase, tx: Tx): void {
  const game = room.game!;
  game.phase = phase;
  game.deadline = tx.now + phaseDurationMs(phase, room.settings);
}

export function waitingOn(phase: Phase): string | null {
  switch (phase.kind) {
    case "action": return phase.playerId;
    case "bidding": return phase.auction.turnId;
    case "decision": return phase.auction.auctioneerId;
    case "payment": return phase.payerId;
    case "tradeSetup": return phase.challengerId;
    case "tradeResponse": return phase.terms.defenderId;
    case "bluff": return null;
  }
}

export function inGame(room: Room): Player[] {
  return room.players.filter((p) => !p.out).sort((a, b) => a.seat - b.seat);
}

/** Next player clockwise who is not out; works when fromId is itself out. */
export function nextInGame(room: Room, fromId: string): Player {
  const from = playerById(room, fromId);
  return nextClockwise(room, from.seat, (p) => !p.out) ?? from;
}

export function canChallenge(room: Room, p: Player): boolean {
  if (p.money.length < 1) return false;
  return inGame(room).some((t) => t.id !== p.id && tradeableAnimals(p.herd, t.herd).length > 0);
}

export function beginTurn(room: Room, playerId: string, tx: Tx): void {
  const game = room.game!;
  let id = playerId;
  for (;;) {
    if (game.deck.length === 0 && !inGame(room).some((q) => canChallenge(room, q))) return finishGame(room, tx);
    const p = playerById(room, id);
    if (game.deck.length === 0 && totalAnimals(p.herd) === 0) {
      p.out = true;
      addLog(room, `${p.name} has no animals and is out.`);
      id = nextInGame(room, p.id).id;
      continue;
    }
    if (game.deck.length === 0 && !canChallenge(room, p)) {
      addLog(room, `${p.name} has no possible cow trade. Turn skipped.`);
      id = nextInGame(room, p.id).id;
      continue;
    }
    game.activePlayerId = id;
    setPhase(room, { kind: "action", playerId: id }, tx);
    return;
  }
}

export function endTurn(room: Room, tx: Tx): void {
  beginTurn(room, nextInGame(room, room.game!.activePlayerId).id, tx);
}

export function chooseAction(room: Room, p: Player, action: "auction" | "cowTrade", tx: Tx): void {
  const game = room.game!;
  if (game.phase.kind !== "action" || game.phase.playerId !== p.id) throw new RuleError("notYourTurn");
  if (action === "auction") {
    if (game.deck.length === 0) throw new RuleError("deckEmpty");
    startAuction(room, tx);
  } else {
    if (!canChallenge(room, p)) throw new RuleError("cantTrade");
    setPhase(room, { kind: "tradeSetup", challengerId: p.id, terms: null, ties: 0 }, tx);
  }
}

export function finishGame(room: Room, tx: Tx): void {
  const game = room.game!;
  room.status = "FINISHED";
  room.scores = rankPlayers(room.players.map((p) => ({ playerId: p.id, herd: p.herd })));
  room.finishedAt = tx.now;
  game.deadline = null;
  const winners = room.scores.filter((s) => s.winner);
  const names = winners.map((w) => playerById(room, w.playerId).name);
  const score = winners[0].score;
  addLog(room, names.length === 1
    ? `Game over. ${names[0]} wins with ${score}.`
    : `Game over. ${names.slice(0, -1).join(", ")} and ${names.at(-1)} share the win with ${score}.`);
}
