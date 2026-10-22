import { describe, expect, it } from "vitest";
import type { TradeReveal } from "../../../src/protocol";
import { moneyRuleText, revealText, revealToShow, scoreLine } from "./reveals";

const reveal: TradeReveal = { id: 7, challengerId: "a", defenderId: "b", animal: "cow", count: 2, ties: 0,
  challengerValues: [10, 10, 50], defenderValues: [100, 100, 10], challengerTotal: 70, defenderTotal: 210, winnerId: "b" };
const names = { a: "Anna", b: "Ben" };

describe("reveals", () => {
  it("shows each reveal once", () => {
    expect(revealToShow(reveal, new Set())).toBe(reveal);
    expect(revealToShow(reveal, new Set([7]))).toBeNull();
    expect(revealToShow(null, new Set())).toBeNull();
  });
  it("describes the reveal from each side", () => {
    expect(revealText(reveal, "a", names)).toBe("You 70 vs Ben 210. Ben wins 2 Cows.");
    expect(revealText(reveal, "b", names)).toBe("Anna 70 vs You 210. You win 2 Cows.");
    expect(revealText({ ...reveal, winnerId: null, ties: 0, defenderTotal: 70 }, "a", names)).toBe("You 70 vs Ben 70. Tie (1 of 3).");
  });
  it("explains each score", () => {
    expect(scoreLine({ playerId: "a", sets: ["cow", "horse"], setValue: 1800, multiplier: 2, score: 3600, rank: 1, winner: true }))
      .toBe("Cow + Horse = 1800 × 2 = 3600");
    expect(scoreLine({ playerId: "b", sets: [], setValue: 0, multiplier: 0, score: 0, rank: 2, winner: false })).toBe("No complete sets = 0");
  });
  it("describes the money rule", () => expect(moneyRuleText("loserTakesBoth")).toBe("Loser takes both offers."));
});
