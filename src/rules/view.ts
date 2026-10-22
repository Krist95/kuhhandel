import type { GameView, MeView, PublicPhase, PublicPlayer, PublicTrade, RoomView, TradeReveal, View } from "../protocol";
import { cashOf } from "./payment";
import { DONKEY_PAYOUTS, FINISHED_CLOSE_MS } from "./types";
import type { Game, MoneyCard, Phase, Player, Room } from "./types";

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

function publicPlayer(p: Player): PublicPlayer {
  return { id: p.id, name: p.name, seat: p.seat, connected: p.connected, away: p.away, out: p.out, moneyCount: p.money.length, herd: { ...p.herd } };
}

function publicPhase(phase: Phase): PublicPhase {
  switch (phase.kind) {
    case "action": return { kind: "action", playerId: phase.playerId };
    case "bidding": case "decision": {
      const a = phase.auction;
      return { kind: phase.kind, card: a.card, auctioneerId: a.auctioneerId, topBid: a.topBid, topBidderId: a.topBidderId, turnId: a.turnId,
        passed: [...a.passed], excluded: [...a.excluded] };
    }
    case "bluff": {
      const a = phase.auction;
      return { kind: "bluff", card: a.card, auctioneerId: a.auctioneerId, blufferId: phase.blufferId, bid: phase.bid, cards: [...phase.cards],
        excluded: [...a.excluded] };
    }
    case "payment":
      return { kind: "payment", card: phase.card, payerId: phase.payerId, receiverId: phase.receiverId, amount: phase.amount };
    case "tradeSetup":
      return { kind: "tradeSetup", challengerId: phase.challengerId, terms: phase.terms ? { ...phase.terms } : null, ties: phase.ties };
    case "tradeResponse":
      return { kind: "tradeResponse", challengerId: phase.challengerId, terms: { ...phase.terms }, ties: phase.ties, offerCount: phase.offer.length };
  }
}

function publicTrade(t: NonNullable<Game["lastTrade"]>): PublicTrade {
  return { id: t.id, challengerId: t.challengerId, defenderId: t.defenderId, animal: t.animal, count: t.count, ties: t.ties,
    challengerCards: t.challengerCards.length, defenderCards: t.defenderCards ? t.defenderCards.length : null, winnerId: t.winnerId };
}

function gameView(g: Game): GameView {
  return { deckCount: g.deck.length, donkeysRevealed: g.donkeysRevealed, nextDonkeyPayout: DONKEY_PAYOUTS[g.donkeysRevealed] ?? null,
    activePlayerId: g.activePlayerId, phase: publicPhase(g.phase), deadline: g.deadline, lastTrade: g.lastTrade ? publicTrade(g.lastTrade) : null };
}

function meView(room: Room, me: Player): MeView {
  const g = room.game;
  const card = (c: MoneyCard): MoneyCard => ({ id: c.id, value: c.value });
  let offer: MoneyCard[] | null = null;
  let buyEnabled: boolean | null = null;
  let tradeReveal: TradeReveal | null = null;
  let payment: MeView["payment"] = null;
  if (g) {
    const ph = g.phase;
    if (ph.kind === "tradeResponse" && ph.challengerId === me.id) offer = ph.offer.map(card);
    if (ph.kind === "decision" && ph.auction.auctioneerId === me.id) buyEnabled = cashOf(me.money) >= ph.auction.topBid;
    const t = g.lastTrade;
    if (t && t.defenderCards !== null && (t.challengerId === me.id || t.defenderId === me.id)) {
      tradeReveal = { id: t.id, challengerId: t.challengerId, defenderId: t.defenderId, animal: t.animal, count: t.count, ties: t.ties,
        challengerValues: [...t.challengerCards], defenderValues: [...t.defenderCards],
        challengerTotal: sum(t.challengerCards), defenderTotal: sum(t.defenderCards), winnerId: t.winnerId };
    }
    const p = g.lastPayment;
    if (p && (p.payerId === me.id || p.receiverId === me.id)) {
      payment = { id: p.id, payerId: p.payerId, receiverId: p.receiverId, amount: p.amount, cards: [...p.cards] };
    }
  }
  return { id: me.id, money: me.money.map(card), offer, buyEnabled, tradeReveal, payment };
}

export function buildView(room: Room | null, token: string | null, now: number): View {
  const me = room && token !== null ? room.players.find((p) => p.token === token) : undefined;
  if (!room || !me) return { serverTime: now, me: null, room: null };
  const rv: RoomView = {
    status: room.status, roomId: room.roomId, roomName: room.roomName, hostId: room.hostId,
    settings: { moneyRule: room.settings.moneyRule, decisionSeconds: room.settings.decisionSeconds },
    players: room.players.map(publicPlayer),
    game: room.game ? gameView(room.game) : null,
    log: room.log.map((e) => ({ seq: e.seq, text: e.text })),
    scores: room.scores ? room.scores.map((s) => ({ ...s, sets: [...s.sets] })) : null,
    closeAt: room.status === "FINISHED" && room.finishedAt !== null ? room.finishedAt + FINISHED_CLOSE_MS : null,
  };
  return { serverTime: now, me: meView(room, me), room: rv };
}
