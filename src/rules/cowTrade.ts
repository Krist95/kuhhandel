import { addLog, playerById, type Tx } from "./engine";
import { RuleError } from "./errors";
import { maxTradeCount, tradeableAnimals } from "./herd";
import { cashOf, pickCards, removeCards } from "./payment";
import { animalsText, cardsText } from "./text";
import { endTurn, inGame, setPhase } from "./turn";
import { MAX_TIES, type Intent, type MoneyCard, type Player, type Room, type TradeTerms } from "./types";

export function offer(room: Room, p: Player, i: Extract<Intent, { type: "cowTradeOffer" }>, tx: Tx): void {
  const game = room.game!;
  const phase = game.phase;
  if (phase.kind !== "tradeSetup" || phase.challengerId !== p.id) throw new RuleError("notYourTurn");
  let terms: TradeTerms;
  if (phase.terms === null) {
    const target = inGame(room).find((q) => q.id === i.targetId);
    if (!target || target.id === p.id) throw new RuleError("badTrade");
    if (!tradeableAnimals(p.herd, target.herd).includes(i.animal)) throw new RuleError("badTrade");
    const max = maxTradeCount(p.herd, target.herd, i.animal);
    if (i.count !== 1 && !(i.count === 2 && max === 2)) throw new RuleError("badTrade");
    terms = { defenderId: target.id, animal: i.animal, count: i.count as 1 | 2 };
  } else {
    terms = phase.terms;
    if (i.targetId !== terms.defenderId || i.animal !== terms.animal || i.count !== terms.count) throw new RuleError("badTrade");
  }
  if (i.cardIds.length === 0) throw new RuleError("badTrade");
  const cards = pickCards(p.money, i.cardIds);
  removeCards(p, cards);
  const defender = playerById(room, terms.defenderId);
  addLog(room, `${p.name} challenges ${defender.name} for ${animalsText(terms.count, terms.animal)} with ${cardsText(cards.length)}.`);
  setPhase(room, { kind: "tradeResponse", challengerId: p.id, terms, ties: phase.ties, offer: cards }, tx);
}

export function respond(room: Room, p: Player, cardIds: readonly string[], tx: Tx): void {
  const game = room.game!;
  const phase = game.phase;
  if (phase.kind !== "tradeResponse" || phase.terms.defenderId !== p.id) throw new RuleError("notYourTurn");
  const { terms, ties } = phase;
  const challenger = playerById(room, phase.challengerId);
  const cards = pickCards(p.money, cardIds);
  const record = { id: ++game.recordSeq, challengerId: challenger.id, defenderId: p.id, animal: terms.animal, count: terms.count, ties,
    challengerCards: phase.offer.map((c) => c.value) };
  const move = (from: Player, to: Player) => { from.herd[terms.animal] -= terms.count; to.herd[terms.animal] += terms.count; };

  if (cards.length === 0) {
    move(p, challenger);
    p.money.push(...phase.offer);
    game.lastTrade = { ...record, defenderCards: null, winnerId: challenger.id };
    addLog(room, `${p.name} forfeited the Cow trade to ${challenger.name}.`);
    return endTurn(room, tx);
  }
  const offered = cashOf(phase.offer), answered = cashOf(cards);
  const defenderCards = cards.map((c) => c.value);
  if (offered === answered && ties + 1 < MAX_TIES) {
    game.lastTrade = { ...record, defenderCards, winnerId: null };
    challenger.money.push(...phase.offer);
    addLog(room, `Tie! The Cow trade repeats (${ties + 1} of ${MAX_TIES}).`);
    return setPhase(room, { kind: "tradeSetup", challengerId: challenger.id, terms, ties: ties + 1 }, tx);
  }
  const thirdTie = offered === answered;
  const winner = offered >= answered ? challenger : p;
  const loser = winner === challenger ? p : challenger;
  const winnerOffer: MoneyCard[] = winner === challenger ? phase.offer : cards;
  const loserOffer: MoneyCard[] = winner === challenger ? cards : phase.offer;
  removeCards(p, cards);
  move(loser, winner);
  if (room.settings.moneyRule === "swap") {
    winner.money.push(...loserOffer);
    loser.money.push(...winnerOffer);
  } else {
    loser.money.push(...winnerOffer, ...loserOffer);
  }
  game.lastTrade = { ...record, defenderCards, winnerId: winner.id };
  addLog(room, thirdTie
    ? `Third tie: ${winner.name} wins ${animalsText(terms.count, terms.animal)}.`
    : `${p.name} counters with ${cardsText(cards.length)}. ${winner.name} wins ${animalsText(terms.count, terms.animal)}.`);
  endTurn(room, tx);
}

export function cancelTrade(room: Room, tx: Tx): void {
  const phase = room.game!.phase;
  if (phase.kind !== "tradeSetup") throw new RuleError("invalid");
  addLog(room, `${playerById(room, phase.challengerId).name}'s Cow trade was cancelled.`);
  endTurn(room, tx);
}
