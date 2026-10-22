import { describe, it, expect } from "vitest";
import { herdOf, tradeableAnimals, maxTradeCount } from "../../src/rules/herd";
import { scoreHerd, rankPlayers } from "../../src/rules/scoring";

const h = herdOf;
describe("herd", () => {
  it("finds animals both players hold that neither has completed", () => {
    expect(tradeableAnimals(h({ cow: 2, horse: 1 }), h({ cow: 1, horse: 3, cat: 2 }))).toEqual(["cow", "horse"]);
    expect(tradeableAnimals(h({ cow: 3 }), h({ cow: 1 }))).toEqual(["cow"]);
    expect(tradeableAnimals(h({ cow: 4 }), h({ cat: 1 }))).toEqual([]);
  });
  it("allows trading 2 only when both hold at least 2", () => {
    expect(maxTradeCount(h({ cow: 2 }), h({ cow: 2 }), "cow")).toBe(2);
    expect(maxTradeCount(h({ cow: 3 }), h({ cow: 1 }), "cow")).toBe(1);
  });
});
describe("scoring", () => {
  it("multiplies the sum of complete sets by the number of sets", () => {
    expect(scoreHerd(h({ horse: 4, cow: 4, cat: 2 }))).toEqual({ sets: ["cow", "horse"], setValue: 1800, multiplier: 2, score: 3600 });
    expect(scoreHerd(h({ cat: 3 }))).toEqual({ sets: [], setValue: 0, multiplier: 0, score: 0 });
  });
  it("breaks equal scores with more complete sets", () => {
    const rows = rankPlayers([
      { playerId: "a", herd: h({ horse: 4 }) },
      { playerId: "b", herd: h({ rooster: 4, goose: 4, cat: 4, dog: 4 }) },
      { playerId: "c", herd: h({ sheep: 4, goat: 4 }) },
    ]);
    expect(rows.map((r) => [r.playerId, r.score, r.rank, r.winner])).toEqual([["b", 1200, 1, true], ["c", 1200, 2, false], ["a", 1000, 3, false]]);
  });
  it("shares the win only when score and set count are both equal", () => {
    const rows = rankPlayers([
      { playerId: "a", herd: h({ rooster: 4, pig: 4 }) },
      { playerId: "b", herd: h({ dog: 4, donkey: 4 }) },
      { playerId: "c", herd: h({ horse: 4 }) },
    ]);
    expect(rows.filter((r) => r.winner).map((r) => r.playerId).sort()).toEqual(["a", "b"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});
