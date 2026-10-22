import { describe, expect, it } from "vitest";
import { act, cash, count, game, idOf, ids, NAMES, pl, reject } from "./helpers";
import type { Animal, Intent, MoneyValue, Room, Settings } from "../../src/rules/types";

const g = (settings?: Partial<Settings>) => game(NAMES, { settings,
  herds: { Anna: { cow: 2, horse: 1 }, Ben: { cow: 2 }, Clara: { horse: 3 } },
  money: { Anna: [0, 10, 50, 100], Ben: [10, 10, 200], Clara: [50] } });
const setup = (r: Room) => act(r, "Anna", { type: "chooseAction", action: "cowTrade" });
const offer = (r: Room, cardIds: string[], target = "Ben", animal: Animal = "cow", count = 2): Intent =>
  ({ type: "cowTradeOffer", targetId: idOf(r, target), animal, count, cardIds });
const respond = (cardIds: string[]): Intent => ({ type: "cowTradeResponse", cardIds });
/** From tradeSetup: Anna offers values `a` for Ben's 2 cows, Ben answers with values `b`. */
const round = (r: Room, a: MoneyValue[], b: MoneyValue[]) => {
  const o = act(r, "Anna", offer(r, ids(r, "Anna", ...a)));
  return act(o, "Ben", respond(ids(o, "Ben", ...b)));
};

describe("cow trade", () => {
  it("validates the challenge", () => {
    const r = setup(g()), ten = ids(r, "Anna", 10);
    expect(reject(r, "Anna", offer(r, ten, "Ben", "horse", 1))).toBe("badTrade"); // Ben has no horse
    expect(reject(r, "Anna", offer(r, ten, "Anna", "cow", 1))).toBe("badTrade");
    expect(reject(r, "Anna", offer(r, ten, "Ben", "cow", 3))).toBe("badTrade");
    expect(reject(r, "Anna", offer(r, []))).toBe("badTrade");
    expect(reject(r, "Anna", offer(r, ids(r, "Ben", 10)))).toBe("badCards");
  });
  it("offers 2 animals only when both hold at least 2", () => {
    const r = setup(g());
    expect(reject(r, "Anna", offer(r, ids(r, "Anna", 10), "Clara", "horse", 2))).toBe("badTrade");
    const s = act(r, "Anna", offer(r, ids(r, "Anna", 0, 10)));
    expect(s.game!.phase).toMatchObject({ kind: "tradeResponse", terms: { defenderId: idOf(s, "Ben"), animal: "cow", count: 2 }, ties: 0 });
    expect(cash(s, "Anna")).toBe(150);
  });
  it("forfeit: challenger wins, defender takes the challenger's cards, nothing is revealed", () => {
    const r = round(setup(g()), [0], []);
    expect([count(r, "Anna", "cow"), count(r, "Ben", "cow")]).toEqual([4, 0]);
    expect(pl(r, "Ben").money.map((c) => c.id)).toContain("Anna-1");
    expect(r.game!.lastTrade).toMatchObject({ winnerId: idOf(r, "Anna"), defenderCards: null });
    expect(r.log.at(-1)!.text).toBe("Ben forfeited the Cow trade to Anna.");
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
  it("the higher total wins; swap gives each side the other's offer", () => {
    const r = round(setup(g()), [50, 10], [200]);
    expect([count(r, "Ben", "cow"), count(r, "Anna", "cow")]).toEqual([4, 0]);
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([300, 80]);
    expect(r.game!.lastTrade).toMatchObject({ winnerId: idOf(r, "Ben"), challengerCards: [50, 10], defenderCards: [200] });
    expect(r.log.at(-1)!.text).toBe("Ben counters with 1 card. Ben wins 2 Cows.");
  });
  it("loserTakesBoth gives both offers to the loser", () => {
    const r = round(setup(g({ moneyRule: "loserTakesBoth" })), [50, 10], [200]);
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([360, 20]);
  });
  it("repeats a tie with the same terms, and a repeat round may be forfeited", () => {
    const r = round(setup(g()), [10], [10]);
    expect(r.game!.phase).toMatchObject({ kind: "tradeSetup", terms: { defenderId: idOf(r, "Ben"), animal: "cow", count: 2 }, ties: 1 });
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([160, 220]);
    expect(r.log.at(-1)!.text).toBe("Tie! The Cow trade repeats (1 of 3).");
    expect(reject(r, "Anna", offer(r, ids(r, "Anna", 10), "Clara", "horse", 1))).toBe("badTrade");
    expect(round(r, [0], []).game!.lastTrade!.defenderCards).toBeNull();
  });
  it("after the third tie the challenger wins and the money rule settles the offers", () => {
    let r = setup(g());
    for (let i = 0; i < 3; i++) r = round(r, [10], [10]);
    expect([count(r, "Anna", "cow"), count(r, "Ben", "cow")]).toEqual([4, 0]);
    expect(pl(r, "Anna").money.some((c) => c.id.startsWith("Ben-"))).toBe(true);
    expect(r.log.at(-1)!.text).toBe("Third tie: Anna wins 2 Cows.");
    let lb = setup(g({ moneyRule: "loserTakesBoth" }));
    for (let i = 0; i < 3; i++) lb = round(lb, [10], [10]);
    expect([cash(lb, "Anna"), cash(lb, "Ben")]).toEqual([150, 230]);
  });
  it("only the defender responds, and only with their own cards", () => {
    const s = setup(g());
    const r = act(s, "Anna", offer(s, ids(s, "Anna", 10)));
    expect(reject(r, "Clara", respond([]))).toBe("notYourTurn");
    expect(reject(r, "Ben", respond(["Anna-4"]))).toBe("badCards");
  });
});
