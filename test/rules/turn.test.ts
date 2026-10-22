import { describe, expect, it } from "vitest";
import { nextInGame } from "../../src/rules/turn";
import { NAMES, T0, act, by, cash, fail, game, idOf, lobby, nameOf, pl, reject, type GameOpts } from "./helpers";

describe("turns", () => {
  const choose = (action: "auction" | "cowTrade") => ({ type: "chooseAction", action }) as const;
  it("gives each decision two minutes with the 120-second setting", () => {
    expect(game(NAMES, { settings: { decisionSeconds: 120 } }).game!.deadline).toBe(T0 + 120_000);
  });
  it("auctions the top card", () => {
    const r = act(game(NAMES, { deck: ["horse", "cow"] }), "Anna", choose("auction"));
    expect([r.game!.phase.kind, r.game!.deck]).toEqual(["bidding", ["cow"]]);
    expect(r.log.at(-1)!.text).toBe("Anna auctions the Horse.");
  });
  it("only lets the active player choose, and only while playing", () => {
    expect(reject(game(), "Ben", choose("auction"))).toBe("notYourTurn");
    expect(fail(lobby(), by("Anna", choose("auction")))).toBe("invalid");
  });
  it("allows a cow trade only with a legal trade and a money card", () => {
    const base = { herds: { Anna: { cow: 1 }, Ben: { cow: 1 } } };
    expect(act(game(NAMES, base), "Anna", choose("cowTrade")).game!.phase.kind).toBe("tradeSetup");
    expect(reject(game(NAMES, { ...base, money: { Anna: [] } }), "Anna", choose("cowTrade"))).toBe("cantTrade");
    expect(reject(game(NAMES, { herds: { Anna: { cow: 4 } } }), "Anna", choose("cowTrade"))).toBe("cantTrade");
    expect(reject(game(NAMES, { ...base, deck: [] }), "Anna", choose("auction"))).toBe("deckEmpty");
  });
  it("pays the donkey bonus to everyone before the donkey is auctioned", () => {
    const r = act(game(NAMES, { deck: ["donkey", "horse"] }), "Anna", choose("auction"));
    expect(NAMES.map((n) => cash(r, n))).toEqual([140, 140, 140]);
    expect(r.log.map((e) => e.text).slice(-2)).toEqual(["Anna auctions the Donkey.", "Donkey! Everyone receives 50."]);
    expect([r.game!.donkeysRevealed, r.game!.phase.kind]).toEqual([1, "bidding"]);
  });
  it("marks a player with no animals out once the deck is empty, and skips them", () => {
    const r = game(NAMES, { deck: [], herds: { Ben: { cow: 2 }, Clara: { cow: 2 } } });
    expect(pl(r, "Anna").out).toBe(true);
    expect(r.game!.activePlayerId).toBe(idOf(r, "Ben"));
    expect(nextInGame(r, idOf(r, "Clara")).name).toBe("Ben");
  });
  it("skips a player who has animals but no possible cow trade", () => {
    const r = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 2 }, Clara: { cow: 2 } } });
    expect(pl(r, "Anna").out).toBe(false);
    expect(r.log.map((e) => e.text)).toContain("Anna has no possible cow trade. Turn skipped.");
    expect(r.game!.activePlayerId).toBe(idOf(r, "Ben"));
  });
  it("ends the game when no legal trade exists", () => {
    const r = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4, cat: 4 }, Clara: { pig: 4 } } });
    expect([r.status, r.finishedAt]).toEqual(["FINISHED", 1_000_000]);
    expect(r.scores!.map((s) => [nameOf(r, s.playerId), s.score])).toEqual([["Ben", 1780], ["Anna", 1000], ["Clara", 650]]);
  });
  it("ends the game when nobody who could trade holds a money card", () => {
    const r = game(NAMES, { deck: [], herds: { Anna: { cow: 2 }, Ben: { cow: 2 }, Clara: { horse: 4 } }, money: { Anna: [], Ben: [] } });
    expect(r.status).toBe("FINISHED");
  });
  it("logs the winner, or every name that shares the win", () => {
    const over = (names: string[], herds: GameOpts["herds"] = {}) => game(names, { deck: [], herds }).log.at(-1)!.text;
    expect(over(NAMES, { Anna: { horse: 4 } })).toBe("Game over. Anna wins with 1000.");
    expect(over(NAMES, { Anna: { rooster: 4, donkey: 4 }, Ben: { dog: 4, goat: 4 } })).toBe("Game over. Anna and Ben share the win with 1020.");
    expect(over(NAMES)).toBe("Game over. Anna, Ben and Clara share the win with 0.");
    expect(over([...NAMES, "Dan"])).toBe("Game over. Anna, Ben, Clara and Dan share the win with 0.");
  });
});
