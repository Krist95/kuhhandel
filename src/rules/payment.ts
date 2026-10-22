import { RuleError } from "./errors";
import type { MoneyCard, MoneyValue, Player } from "./types";

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
