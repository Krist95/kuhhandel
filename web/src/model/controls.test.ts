import { describe, expect, it } from "vitest";
import type { PublicPhase } from "../../../src/protocol";
import { MAX_BID } from "../../../src/rules/types";
import type { Room } from "../../../src/rules/types";
import { buildView } from "../../../src/rules/view";
import { act, game, ids, idOf, NAMES, pl, tok, T0, withTx } from "../../../test/rules/helpers";
import { bidStep, canSubmitBid, deriveControls, sheetKey, waitingOnPublic } from "./controls";

const terms = { defenderId: "d", animal: "cow", count: 1 } as never;
describe("waitingOnPublic", () => {
  const cases: [PublicPhase, string | null][] = [
    [{ kind: "action", playerId: "a" }, "a"],
    [{ kind: "bidding", card: "cow", auctioneerId: "u", topBid: 0, topBidderId: null, turnId: "t", passed: [], excluded: [] }, "t"],
    [{ kind: "decision", card: "cow", auctioneerId: "u", topBid: 0, topBidderId: null, turnId: null, passed: [], excluded: [] }, "u"],
    [{ kind: "bluff", card: "cow", auctioneerId: "u", blufferId: "b", bid: 1, cards: [], excluded: [] }, null],
    [{ kind: "payment", card: "cow", payerId: "p", receiverId: "r", amount: 5 }, "p"],
    [{ kind: "tradeSetup", challengerId: "c", terms: null, ties: 0 }, "c"],
    [{ kind: "tradeResponse", challengerId: "c", terms, ties: 0, offerCount: 1 }, "d"],
  ];
  it.each(cases)("%j", (phase, expected) => expect(waitingOnPublic(phase)).toBe(expected));
});

const controls = (r: Room, name: string) => deriveControls(buildView(r, tok(name), T0));
const auction = { type: "chooseAction", action: "auction" } as const;
const cows = { Anna: { cow: 1 }, Ben: { cow: 1 } };

describe("deriveControls", () => {
  it("offers Auction and Cow trade on your turn, with reasons when disabled", () => {
    expect(controls(game(NAMES, { herds: cows }), "Anna")).toEqual({ kind: "turn", auction: { ok: true }, cowTrade: { ok: true } });
    expect(controls(game(), "Anna")).toMatchObject({ cowTrade: { ok: false, reason: "No cow trade possible" } });
    expect(controls(game(NAMES, { herds: cows, money: { Anna: [] } }), "Anna")).toMatchObject({ cowTrade: { ok: false, reason: "You need a money card" } });
    expect(controls(game(NAMES, { herds: cows, deck: [] }), "Anna")).toMatchObject({ auction: { ok: false, reason: "Deck is empty" } });
    expect(controls(game(), "Ben")).toEqual({ kind: "watch", waitingOnId: idOf(game(), "Anna") });
  });
  it("shows bid controls on your bid turn", () => {
    expect(controls(act(act(game(), "Anna", auction), "Ben", { type: "bid", amount: 30 }), "Clara")).toEqual({ kind: "bid", topBid: 30, minBid: 40 });
  });
  it("shows Sell/Buy to the auctioneer, with Buy only when affordable", () => {
    const r = act(act(act(game(), "Anna", auction), "Ben", { type: "bid", amount: 100 }), "Clara", { type: "pass" });
    expect(controls(r, "Anna")).toEqual({ kind: "decide", buyEnabled: false, topBid: 100, topBidderId: idOf(r, "Ben") });
  });
  it("asks the payer to pay", () => {
    let r = act(act(act(game(), "Anna", auction), "Ben", { type: "bid", amount: 20 }), "Clara", { type: "pass" });
    r = act(r, "Anna", { type: "auctioneerDecision", decision: "sell" });
    expect(controls(r, "Ben")).toEqual({ kind: "pay", amount: 20 });
  });
  it("lists only legal trade targets, with 2 only when both hold 2", () => {
    const r = act(game(NAMES, { herds: { Anna: { cow: 2, cat: 1 }, Ben: { cow: 2 }, Clara: { cat: 1, cow: 1 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
    expect(controls(r, "Anna")).toEqual({ kind: "tradeSetup", fixed: null, targets: [
      { playerId: idOf(r, "Ben"), animals: [{ animal: "cow", maxCount: 2 }] },
      { playerId: idOf(r, "Clara"), animals: [{ animal: "cat", maxCount: 1 }, { animal: "cow", maxCount: 1 }] } ] });
  });
  it("shows the defender how many cards were offered", () => {
    const s = act(game(NAMES, { herds: { Anna: { cow: 2 }, Ben: { cow: 2 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
    const r = act(s, "Anna", { type: "cowTradeOffer", targetId: idOf(s, "Ben"), animal: "cow", count: 2, cardIds: ids(s, "Anna", 10, 0) });
    expect(controls(r, "Ben")).toEqual({ kind: "respond", challengerId: idOf(r, "Anna"), animal: "cow", count: 2, offerCount: 2 });
  });
  it("shows the Away banner to an Away player", () =>
    expect(controls(withTx(game(), (d) => { pl(d, "Ben").away = true; }), "Ben")).toEqual({ kind: "away" }));
});
it("adds quick raises to the field and validates amounts", () => {
  expect(bidStep(40, 50)).toBe(90);
  expect([canSubmitBid(40, 40), canSubmitBid(45, 40), canSubmitBid(30, 40), canSubmitBid(MAX_BID + 10, 40)]).toEqual([true, false, false, false]);
});

describe("sheetKey", () => {
  it("differs across kinds and across consecutive decisions of the same kind", () => {
    const pay = { kind: "pay", amount: 20 } as const;
    expect(sheetKey(pay, 100)).toBe(sheetKey(pay, 100));
    expect(sheetKey(pay, 100)).not.toBe(sheetKey(pay, 200));
    expect(sheetKey(pay, 100)).not.toBe(sheetKey({ kind: "away" }, 100));
    expect(sheetKey(pay, null)).not.toBe(sheetKey(pay, 100));
  });
});
