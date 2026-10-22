import { describe, expect, it } from "vitest";
import { buildDeck } from "../../src/rules/setup";
import { ANIMALS } from "../../src/rules/types";
import { NAMES, T0, act, by, cash, fail, game, joinAction, lobby, run } from "./helpers";

describe("startGame", () => {
  it("deals starting money, empty herds and a shuffled 40-card deck", () => {
    const r = run(lobby(), by("Anna", { type: "startGame" }))!;
    expect(r.status).toBe("PLAYING");
    for (const p of r.players) expect(p.money.map((c) => c.value).sort((a, b) => a - b)).toEqual([0, 0, 10, 10, 10, 10, 50]);
    expect(new Set(r.players.flatMap((p) => p.money.map((c) => c.id))).size).toBe(21);
    const pids = new Set(r.players.map((p) => p.id));
    for (const p of r.players) for (const c of p.money) expect(pids.has(c.id)).toBe(false);
    for (const a of ANIMALS) expect(r.game!.deck.filter((x) => x === a)).toHaveLength(4);
    expect(r.game!.deck).toHaveLength(40);
    expect(r.game!.deck).not.toEqual(buildDeck());
    expect(r.game!.phase).toEqual({ kind: "action", playerId: r.game!.activePlayerId });
    expect(r.game!.deadline).toBe(T0 + 20_000);
  });
  it("picks the first player at random from the seed", () => {
    const firsts = new Set(Array.from({ length: 20 }, (_, s) => run(lobby(), by("Anna", { type: "startGame" }), T0, s + 1)!.game!.activePlayerId));
    expect(firsts.size).toBeGreaterThan(1);
  });
  it("needs the host and 3–5 players, and locks the room once started", () => {
    expect(fail(lobby(["Anna", "Ben"]), by("Anna", { type: "startGame" }))).toBe("notEnoughPlayers");
    expect(fail(lobby(), by("Ben", { type: "startGame" }))).toBe("notHost");
    expect(fail(game(), joinAction("Dan", 4))).toBe("gameStarted");
  });
  it("Play again restarts a finished game with the same players and settings", () => {
    const done = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4 }, Clara: { cat: 4 } }, settings: { decisionSeconds: 30 } });
    expect(done.status).toBe("FINISHED");
    expect(fail(done, by("Ben", { type: "playAgain" }))).toBe("notHost");
    const r = act(done, "Anna", { type: "playAgain" }, T0 + 1000);
    expect(r).toMatchObject({ status: "PLAYING", finishedAt: null, scores: null, settings: { decisionSeconds: 30 } });
    expect(r.players.map((p) => p.name)).toEqual(NAMES);
    expect([r.game!.deck.length, cash(r, "Anna")]).toEqual([40, 90]);
  });
});
