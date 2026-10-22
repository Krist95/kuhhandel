import { describe, expect, it } from "vitest";
import { ERROR_TEXT } from "../../src/rules/errors";
import { autoPay, cashOf, pickCards } from "../../src/rules/payment";
import type { MoneyCard, MoneyValue } from "../../src/rules/types";

const hand = (...vs: MoneyValue[]) => vs.map((value, i) => ({ id: `c${i + 1}`, value }));
const summary = (cards: MoneyCard[]) => [cashOf(cards), cards.length];
describe("payment helpers", () => {
  it("sums card values", () => expect(cashOf(hand(0, 10, 50))).toBe(60));
  it("picks owned cards and rejects unknown or repeated ids", () => {
    expect(pickCards(hand(10, 50), ["c2"])).toEqual([{ id: "c2", value: 50 }]);
    expect(() => pickCards(hand(10, 50), ["c1", "c1"])).toThrow(ERROR_TEXT.badCards);
    expect(() => pickCards(hand(10, 50), ["zz"])).toThrow(ERROR_TEXT.badCards);
  });
  it("auto-pays the smallest covering total, then the fewest cards", () => {
    const start = hand(0, 0, 10, 10, 10, 10, 50);
    expect(summary(autoPay(start, 30))).toEqual([30, 3]);
    expect(summary(autoPay(start, 40))).toEqual([40, 4]);
    expect(summary(autoPay(start, 60))).toEqual([60, 2]);
    expect(summary(autoPay(hand(100, 50, 50, 10), 100))).toEqual([100, 1]);
    expect(summary(autoPay(hand(200, 100, 100, 10), 150))).toEqual([200, 1]);
  });
  it("never hands over zero cards", () => expect(autoPay(hand(0, 0, 10), 10).map((c) => c.value)).toEqual([10]));
  it("handles a large hand", () => {
    const big = hand(...([10, 50, 100, 200, 500] as const).flatMap((v) => Array<MoneyValue>(8).fill(v)));
    expect(summary(autoPay(big, 1230))).toEqual([1230, 6]);
  });
  it("throws when the hand cannot cover the amount", () => expect(() => autoPay(hand(10), 20)).toThrow(ERROR_TEXT.underpaid));
});
