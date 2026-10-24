import type { PublicPhase, PublicPlayer, View } from "../../../src/protocol";
import type { Animal } from "../../../src/rules/types";
import type { TradeTarget } from "./controls";

export type PillState = "now" | "top" | "passed" | "excl" | "wait";
export interface BidderPill { id: string; label: string; state: PillState; amount: number | null }

/** Seat order clockwise starting at `startId`, through all players. */
function clockwiseFrom(players: readonly PublicPlayer[], startId: string): PublicPlayer[] {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const at = Math.max(0, sorted.findIndex((p) => p.id === startId));
  return [...sorted.slice(at), ...sorted.slice(0, at)];
}

export function bidderPills(phase: Extract<PublicPhase, { kind: "bidding" | "decision" }>, players: readonly PublicPlayer[], meId: string): BidderPill[] {
  return clockwiseFrom(players, phase.auctioneerId)
    .filter((p) => p.id !== phase.auctioneerId && !p.out)
    .map((p) => {
      const state: PillState = phase.excluded.includes(p.id) ? "excl" : phase.passed.includes(p.id) ? "passed"
        : p.id === phase.turnId ? "now" : p.id === phase.topBidderId ? "top" : "wait";
      return { id: p.id, label: p.id === meId ? "You" : p.name, state, amount: state === "top" ? phase.topBid : null };
    });
}

export function tradeOptions(targets: readonly TradeTarget[]): { playerId: string; animal: Animal; maxCount: 1 | 2 }[] {
  return targets.flatMap((t) => t.animals.map((a) => ({ playerId: t.playerId, animal: a.animal, maxCount: a.maxCount })));
}

export function payHint(selected: number, owed: number): string {
  if (selected < owed) return `${owed - selected} still to go.`;
  if (selected === owed) return "Exact.";
  return `${selected - owed} over — no change given.`;
}

export const stepBid = (amount: number, minBid: number, dir: -1 | 1): number => Math.max(minBid, amount + 10 * dir);

export function ringState(secondsLeft: number | null, decisionSeconds: number, paused: boolean): { p: number; low: boolean; label: string | null } {
  const s = secondsLeft ?? 0;
  return {
    p: Math.min(1, Math.max(0, s / decisionSeconds)),
    low: secondsLeft !== null && secondsLeft <= 5,
    label: paused || secondsLeft === null ? null : String(secondsLeft),
  };
}

export function intro(view: View): { key: string; firstId: string; order: { id: string; label: string; first: boolean; me: boolean }[] } | null {
  const room = view.room;
  const g = room?.game;
  if (!room || !g || room.status !== "PLAYING" || g.deckCount !== 40 || g.phase.kind !== "action") return null;
  const meId = view.me?.id;
  return {
    key: `${room.roomId}:${g.activePlayerId}`,
    firstId: g.activePlayerId,
    order: clockwiseFrom(room.players, g.activePlayerId).map((p) => ({ id: p.id, label: p.id === meId ? "You" : p.name, first: p.id === g.activePlayerId, me: p.id === meId })),
  };
}
