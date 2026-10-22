import { describe, expect, it } from "vitest";
import type { PublicPhase } from "../../../src/protocol";
import { waitingOnPublic } from "./controls";

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
