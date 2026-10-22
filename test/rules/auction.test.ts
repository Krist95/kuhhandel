import { describe, expect, it } from "vitest";
import { DONKEY_PAYOUTS, MAX_BID } from "../../src/rules/types";
import { act, auc, cash, count, game, idOf, NAMES, passAll, reject, T0 } from "./helpers";

const FOUR = ["Anna", "Ben", "Clara", "Dan"];
const choose = { type: "chooseAction", action: "auction" } as const;
const bid = (amount: number) => ({ type: "bid", amount }) as const;
const pass = { type: "pass" } as const;
const start = () => act(game(FOUR, { deck: ["horse", "cow", "cat"] }), "Anna", choose);

describe("bidding", () => {
  it("starts with the player after the auctioneer", () => {
    const r = start();
    expect(auc(r)).toMatchObject({ card: "horse", topBid: 0, topBidderId: null, turnId: idOf(r, "Ben") });
  });
  it("accepts any multiple of 10 above the top bid, including jumps and bluffs", () => {
    let r = start();
    for (const bad of [0, 5, 15, -10, 10.5, MAX_BID + 10]) expect(reject(r, "Ben", bid(bad))).toBe("badBid");
    r = act(r, "Ben", bid(10));
    expect(reject(r, "Clara", bid(10))).toBe("badBid");
    r = act(r, "Clara", bid(500)); // more than Clara's 90
    expect(auc(r)).toMatchObject({ topBid: 500, topBidderId: idOf(r, "Clara"), turnId: idOf(r, "Dan") });
  });
  it("makes passing final", () => {
    const r = act(act(act(start(), "Ben", pass), "Clara", bid(10)), "Dan", bid(20));
    expect(auc(r).turnId).toBe(idOf(r, "Clara"));
    expect(reject(r, "Ben", bid(30))).toBe("notYourTurn");
  });
  it("ends when the only remaining bidder holds the top bid", () => {
    const r = act(act(act(start(), "Ben", bid(10)), "Clara", pass), "Dan", pass);
    expect(r.game!.phase.kind).toBe("decision");
    expect(auc(r)).toMatchObject({ topBid: 10, topBidderId: idOf(r, "Ben") });
  });
  it("still gives the last bidder a turn when nobody has bid", () => {
    const r = act(act(start(), "Ben", pass), "Clara", pass);
    expect(auc(r).turnId).toBe(idOf(r, "Dan"));
    expect(act(r, "Dan", bid(10)).game!.phase.kind).toBe("decision");
  });
  it("gives the animal to the auctioneer for free when everyone passes", () => {
    const r = passAll(start());
    expect([count(r, "Anna", "horse"), cash(r, "Anna")]).toEqual([1, 90]);
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
    expect(r.log.at(-1)!.text).toBe("No bids. Anna takes the Horse for free.");
  });
  it("rejects a repeated bid from a double tap", () => {
    expect(reject(act(start(), "Ben", bid(10)), "Ben", bid(10))).toBe("notYourTurn");
  });
  it("gives every bid turn a fresh timer", () => {
    expect(act(start(), "Ben", bid(10), T0 + 7_000).game!.deadline).toBe(T0 + 27_000);
  });
  it("pays donkey bonuses of 50, 100, 200 and 500 in order", () => {
    let r = game(NAMES, { deck: ["donkey", "donkey", "donkey", "donkey", "horse"] });
    for (const [i, n] of ["Anna", "Ben", "Clara", "Anna"].entries()) {
      const before = cash(r, "Clara");
      r = act(r, n, choose);
      expect(cash(r, "Clara") - before).toBe(DONKEY_PAYOUTS[i]);
      r = passAll(r);
    }
    expect(r.game!.donkeysRevealed).toBe(4);
  });
});
