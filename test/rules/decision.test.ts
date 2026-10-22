import { describe, expect, it } from "vitest";
import { endBluffReveal } from "../../src/rules/auction";
import { act, auc, cash, count, game, ids, idOf, NAMES, reject, T0, withTx } from "./helpers";

const FOUR = ["Anna", "Ben", "Clara", "Dan"];
const choose = { type: "chooseAction", action: "auction" } as const;
const decide = (decision: "sell" | "buy") => ({ type: "auctioneerDecision", decision }) as const;
const pay = (cardIds: string[]) => ({ type: "pay", cardIds }) as const;
const bid = (amount: number) => ({ type: "bid", amount }) as const;
const pass = { type: "pass" } as const;
/** Anna auctions a Horse; Ben bids `amount`; Clara and Dan pass. */
const toDecision = (amount: number) =>
  act(act(act(act(game(FOUR, { deck: ["horse", "cow", "cat"] }), "Anna", choose), "Ben", bid(amount)), "Clara", pass), "Dan", pass);

describe("auctioneer decision and payment", () => {
  it("Sell: the top bidder pays the auctioneer and takes the animal", () => {
    let r = act(toDecision(30), "Anna", decide("sell"));
    expect(r.game!.phase).toMatchObject({ kind: "payment", payerId: idOf(r, "Ben"), receiverId: idOf(r, "Anna"), amount: 30, card: "horse" });
    r = act(r, "Ben", pay(ids(r, "Ben", 10, 10, 10)));
    expect([count(r, "Ben", "horse"), cash(r, "Ben"), cash(r, "Anna")]).toEqual([1, 60, 120]);
    expect(r.log.at(-1)!.text).toBe("Ben bought the Horse for 30 (3 cards).");
    expect(r.game!.lastPayment).toMatchObject({ payerId: idOf(r, "Ben"), receiverId: idOf(r, "Anna"), amount: 30, cards: [10, 10, 10] });
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
  it("gives no change: overpayment goes to the receiver", () => {
    let r = act(toDecision(30), "Anna", decide("sell"));
    r = act(r, "Ben", pay(ids(r, "Ben", 50)));
    expect([cash(r, "Anna"), cash(r, "Ben")]).toEqual([140, 40]);
  });
  it("rejects underpayment, foreign or repeated cards and the wrong payer", () => {
    const r = act(toDecision(30), "Anna", decide("sell"));
    const [ten] = ids(r, "Ben", 10);
    expect(reject(r, "Ben", pay(ids(r, "Ben", 10, 10)))).toBe("underpaid");
    expect(reject(r, "Ben", pay(ids(r, "Anna", 50)))).toBe("badCards");
    expect(reject(r, "Ben", pay([ten, ten, ten]))).toBe("badCards");
    expect(reject(r, "Clara", pay(ids(r, "Clara", 50)))).toBe("notYourTurn");
  });
  it("Buy: the auctioneer pays the top bidder and keeps the animal", () => {
    let r = act(toDecision(50), "Anna", decide("buy"));
    expect(r.game!.phase).toMatchObject({ kind: "payment", payerId: idOf(r, "Anna"), receiverId: idOf(r, "Ben"), amount: 50 });
    r = act(r, "Anna", pay(ids(r, "Anna", 50)));
    expect([count(r, "Anna", "horse"), cash(r, "Anna"), cash(r, "Ben")]).toEqual([1, 40, 140]);
    expect(r.log.at(-1)!.text).toBe("Anna bought the Horse for 50 (1 card).");
  });
  it("enables Buy only when the auctioneer's cash covers the bid", () => {
    expect(reject(toDecision(100), "Anna", decide("buy"))).toBe("buyDisabled");
    expect(act(toDecision(90), "Anna", decide("buy")).game!.phase.kind).toBe("payment");
  });
  it("calls a bluff on Sell: reveals the cash, excludes the bidder and restarts bidding", () => {
    let r = act(toDecision(100), "Anna", decide("sell"));
    expect(r.game!.phase).toMatchObject({ kind: "bluff", blufferId: idOf(r, "Ben"), bid: 100, cards: [0, 0, 10, 10, 10, 10, 50] });
    expect(r.game!.deadline).toBe(T0 + 5_000);
    expect(r.log.at(-1)!.text).toBe("Bluff! Ben bid 100 but only has 90 (0, 0, 10, 10, 10, 10, 50).");
    expect(cash(r, "Ben")).toBe(90);
    r = withTx(r, endBluffReveal, T0 + 5_000);
    expect(auc(r)).toMatchObject({ topBid: 0, topBidderId: null, excluded: [idOf(r, "Ben")], passed: [], turnId: idOf(r, "Clara") });
    expect([r.game!.phase.kind, r.game!.deadline]).toEqual(["bidding", T0 + 25_000]);
  });
  it("accumulates exclusions, gives the animal away free when nobody bids, then clears them", () => {
    let r = withTx(act(toDecision(100), "Anna", decide("sell")), endBluffReveal);
    r = act(act(r, "Clara", bid(100)), "Dan", pass);
    r = withTx(act(r, "Anna", decide("sell")), endBluffReveal);
    expect(auc(r).excluded).toEqual([idOf(r, "Ben"), idOf(r, "Clara")]);
    r = act(r, "Dan", pass);
    expect(count(r, "Anna", "horse")).toBe(1);
    expect(auc(act(r, "Ben", choose)).excluded).toEqual([]);
  });
  it("gives the animal away free when a restart has no eligible bidders", () => {
    let r = act(act(act(game(NAMES, { deck: ["horse", "cow"] }), "Anna", choose), "Ben", bid(100)), "Clara", pass);
    r = withTx(act(r, "Anna", decide("sell")), endBluffReveal); // Ben excluded
    r = withTx(act(act(r, "Clara", bid(100)), "Anna", decide("sell")), endBluffReveal); // Clara excluded
    expect(count(r, "Anna", "horse")).toBe(1);
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
});
