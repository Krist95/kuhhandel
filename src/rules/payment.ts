import { addLog, playerById, type Tx } from "./engine";
import { RuleError } from "./errors";
import { cardsText } from "./text";
import { endTurn } from "./turn";
import { ANIMAL_NAME, type MoneyCard, type MoneyValue, type Player, type Room } from "./types";

const DENOMINATIONS: readonly MoneyValue[] = [10, 50, 100, 200, 500];

export function cashOf(cards: readonly MoneyCard[]): number {
  return cards.reduce((sum, c) => sum + c.value, 0);
}

export function pickCards(hand: readonly MoneyCard[], ids: readonly string[]): MoneyCard[] {
  const seen = new Set<string>();
  return ids.map((id) => {
    const card = hand.find((c) => c.id === id);
    if (!card || seen.has(id)) throw new RuleError("badCards");
    seen.add(id);
    return card;
  });
}

export function removeCards(p: Player, cards: readonly MoneyCard[]): void {
  const gone = new Set(cards.map((c) => c.id));
  p.money = p.money.filter((c) => !gone.has(c.id));
}

export function autoPay(hand: readonly MoneyCard[], amount: number): MoneyCard[] {
  if (cashOf(hand) < amount) throw new RuleError("underpaid");
  const groups = DENOMINATIONS.map((v) => hand.filter((c) => c.value === v));
  let best: { total: number; count: number; use: number[] } | null = null;
  const use: number[] = [];
  const walk = (i: number, total: number, count: number): void => {
    if (i === groups.length) {
      if (total < amount) return;
      if (!best || total < best.total || (total === best.total && count < best.count)) best = { total, count, use: [...use] };
      return;
    }
    for (let n = 0; n <= groups[i].length; n++) {
      use[i] = n;
      walk(i + 1, total + n * DENOMINATIONS[i], count + n);
    }
  };
  walk(0, 0, 0);
  const chosen = best as { use: number[] } | null;
  if (!chosen) throw new RuleError("underpaid");
  return groups.flatMap((g, i) => g.slice(0, chosen.use[i]));
}

export function pay(room: Room, p: Player, cardIds: readonly string[], tx: Tx): void {
  const phase = room.game!.phase;
  if (phase.kind !== "payment" || phase.payerId !== p.id) throw new RuleError("notYourTurn");
  const cards = pickCards(p.money, cardIds);
  if (cashOf(cards) < phase.amount) throw new RuleError("underpaid");
  settlePayment(room, cards, tx);
}

export function settlePayment(room: Room, cards: readonly MoneyCard[], tx: Tx): void {
  const game = room.game!;
  const phase = game.phase;
  if (phase.kind !== "payment") throw new RuleError("invalid");
  const payer = playerById(room, phase.payerId);
  const receiver = playerById(room, phase.receiverId);
  removeCards(payer, cards);
  receiver.money.push(...cards);
  payer.herd[phase.card]++;
  game.lastPayment = { id: ++game.recordSeq, payerId: payer.id, receiverId: receiver.id, amount: phase.amount, cards: cards.map((c) => c.value) };
  addLog(room, `${payer.name} bought the ${ANIMAL_NAME[phase.card][0]} for ${phase.amount} (${cardsText(cards.length)}).`);
  endTurn(room, tx);
}
