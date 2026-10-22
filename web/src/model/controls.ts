import type { PublicPhase, View } from "../../../src/protocol";
import { maxTradeCount, tradeableAnimals } from "../../../src/rules/herd";
import { MAX_BID, type Animal, type TradeTerms } from "../../../src/rules/types";

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

/** The player the game is waiting on, or null when nobody (bluff reveal). */
export function waitingOnPublic(phase: PublicPhase): string | null {
  switch (phase.kind) {
    case "action": return phase.playerId;
    case "bidding": return phase.turnId;
    case "decision": return phase.auctioneerId;
    case "payment": return phase.payerId;
    case "tradeSetup": return phase.challengerId;
    case "tradeResponse": return phase.terms.defenderId;
    case "bluff": return null;
  }
}

export function bidStep(current: number, add: 10 | 50 | 100): number {
  return current + add;
}

export function canSubmitBid(amount: number, minBid: number): boolean {
  return Number.isInteger(amount) && amount % 10 === 0 && amount >= minBid && amount <= MAX_BID;
}

/** In-game opponents in seat order after you, only those sharing a tradeable animal with you. */
export function tradeTargets(view: View): TradeTarget[] {
  const room = view.room;
  const meId = view.me?.id;
  const me = room?.players.find((p) => p.id === meId);
  if (!room || !me) return [];
  const others = room.players.filter((p) => p.id !== me.id && !p.out);
  const after = others.filter((p) => p.seat > me.seat).sort((a, b) => a.seat - b.seat);
  const before = others.filter((p) => p.seat < me.seat).sort((a, b) => a.seat - b.seat);
  const out: TradeTarget[] = [];
  for (const p of [...after, ...before]) {
    const animals = tradeableAnimals(me.herd, p.herd).map((animal) => ({ animal, maxCount: maxTradeCount(me.herd, p.herd, animal) }));
    if (animals.length > 0) out.push({ playerId: p.id, animals });
  }
  return out;
}

export function deriveControls(view: View): Controls {
  const room = view.room;
  const game = room?.game ?? null;
  const me = view.me;
  const self = room?.players.find((p) => p.id === me?.id);
  if (!room || !game || !me || !self) return { kind: "watch", waitingOnId: null };
  const waitingOnId = waitingOnPublic(game.phase);
  if (room.status === "PLAYING" && self.away) return { kind: "away" };
  if (room.status !== "PLAYING" || waitingOnId !== me.id) return { kind: "watch", waitingOnId };
  const ph = game.phase;
  switch (ph.kind) {
    case "action": {
      const auction: Enabled = game.deckCount === 0 ? { ok: false, reason: "Deck is empty" } : { ok: true };
      const cowTrade: Enabled = tradeTargets(view).length === 0 ? { ok: false, reason: "No cow trade possible" }
        : me.money.length === 0 ? { ok: false, reason: "You need a money card" } : { ok: true };
      return { kind: "turn", auction, cowTrade };
    }
    case "bidding":
      return { kind: "bid", topBid: ph.topBid, minBid: ph.topBid + 10 };
    case "decision":
      return { kind: "decide", buyEnabled: me.buyEnabled === true, topBid: ph.topBid, topBidderId: ph.topBidderId ?? "" };
    case "payment":
      return { kind: "pay", amount: ph.amount };
    case "tradeSetup":
      return { kind: "tradeSetup", fixed: ph.terms, targets: tradeTargets(view) };
    case "tradeResponse":
      return { kind: "respond", challengerId: ph.challengerId, animal: ph.terms.animal, count: ph.terms.count, offerCount: ph.offerCount };
    case "bluff":
      return { kind: "watch", waitingOnId };
  }
}
