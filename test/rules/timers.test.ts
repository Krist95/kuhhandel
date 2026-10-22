import { describe, expect, it } from "vitest";
import { nextDeadline } from "../../src/rules/timers";
import { NAMES, T0, act, auc, cash, count, game, idOf, ids, lobby, outcome, pl, reject, run, tickAt, tok, withTx } from "./helpers";

const D = 20_000;
const choose = { type: "chooseAction", action: "auction" } as const;
const g = () => game(NAMES, { deck: ["horse", "cow", "cat"] });

describe("timeouts", () => {
  it("auto-auctions when a turn times out with cards in the deck", () => {
    expect(tickAt(g(), T0 + D - 1)!.game!.phase.kind).toBe("action");
    const r = tickAt(g(), T0 + D)!;
    expect([r.game!.phase.kind, pl(r, "Anna").timeouts]).toEqual(["bidding", 1]);
    expect(r.log.map((e) => e.text)).toContain("Time's up for Anna.");
  });
  it("skips the turn when it times out with an empty deck", () => {
    const r = tickAt(game(NAMES, { deck: [], herds: { Anna: { cow: 1 }, Ben: { cow: 1 }, Clara: { cow: 2 } } }), T0 + D)!;
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
  });
  it("passes on a bid timeout", () => {
    const r = tickAt(act(g(), "Anna", choose), T0 + D)!;
    expect(auc(r)).toMatchObject({ passed: [idOf(r, "Ben")], turnId: idOf(r, "Clara") });
  });
  it("sells on a decision timeout, auto-pays on a payment timeout, and rejects a late Pay", () => {
    let r = act(act(act(g(), "Anna", choose), "Ben", { type: "bid", amount: 30 }), "Clara", { type: "pass" });
    r = tickAt(r, T0 + D)!;
    expect(r.game!.phase).toMatchObject({ kind: "payment", payerId: idOf(r, "Ben"), amount: 30 });
    r = tickAt(r, T0 + 2 * D)!;
    expect([cash(r, "Ben"), cash(r, "Anna"), count(r, "Ben", "horse")]).toEqual([60, 120, 1]);
    expect(reject(r, "Ben", { type: "pay", cardIds: ids(r, "Ben", 10) })).toBe("notYourTurn");
  });
  it("cancels a trade on a setup timeout and forfeits on a response timeout", () => {
    const s = act(game(NAMES, { herds: { Anna: { cow: 2 }, Ben: { cow: 2 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
    const cancelled = tickAt(s, T0 + D)!;
    expect(cancelled.log.map((e) => e.text)).toContain("Anna's Cow trade was cancelled.");
    expect(cancelled.game!.phase).toEqual({ kind: "action", playerId: idOf(cancelled, "Ben") });
    const o = act(s, "Anna", { type: "cowTradeOffer", targetId: idOf(s, "Ben"), animal: "cow", count: 2, cardIds: ids(s, "Anna", 10) });
    expect(count(tickAt(o, T0 + D)!, "Anna", "cow")).toBe(4);
  });
  it("restarts bidding when the 5-second bluff reveal ends", () => {
    let r = act(act(act(g(), "Anna", choose), "Ben", { type: "bid", amount: 100 }), "Clara", { type: "pass" });
    r = act(r, "Anna", { type: "auctioneerDecision", decision: "sell" });
    expect(tickAt(r, T0 + 4_999)!.game!.phase.kind).toBe("bluff");
    expect(tickAt(r, T0 + 5_000)!.game!.phase.kind).toBe("bidding");
  });
  it("keeps running timers for disconnected players", () => {
    expect(tickAt(run(g(), { type: "disconnect", token: tok("Anna") }), T0 + D)!.game!.phase.kind).toBe("bidding");
  });
});

describe("away", () => {
  it("marks a player Away on the 3rd consecutive timeout; any action resets the count", () => {
    const two = withTx(g(), (d) => { pl(d, "Anna").timeouts = 2; });
    const r = tickAt(two, T0 + D)!;
    expect(pl(r, "Anna").away).toBe(true);
    expect(r.log.map((e) => e.text)).toContain("Anna is away.");
    expect(pl(act(two, "Anna", choose), "Anna").timeouts).toBe(0);
  });
  it("resolves an Away player's decisions instantly", () => {
    let r = withTx(game(NAMES, { first: "Ben" }), (d) => { pl(d, "Anna").away = true; });
    r = act(act(r, "Ben", choose), "Clara", { type: "pass" }); // Anna's bid turn passes at once; Ben takes it free
    expect(r.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Clara") });
  });
  it("clears Away with imBack", () => {
    const r = act(withTx(g(), (d) => { Object.assign(pl(d, "Ben"), { away: true, timeouts: 3 }); }), "Ben", { type: "imBack" });
    expect(pl(r, "Ben")).toMatchObject({ away: false, timeouts: 0 });
    expect(r.log.at(-1)!.text).toBe("Ben is back.");
  });
  it("falls back to normal deadlines when every in-game player is Away", () => {
    const all = withTx(g(), (d) => d.players.forEach((p) => { p.away = true; }));
    expect(tickAt(all, T0 + 1)!.game!.phase.kind).toBe("action");
    const r = tickAt(all, T0 + D)!;
    expect([r.game!.phase.kind, auc(r).turnId, r.game!.deadline]).toEqual(["bidding", idOf(r, "Ben"), T0 + 2 * D]);
  });
  it("waits out an Away player's empty-deck turn instead of skipping it instantly", () => {
    let r = game(NAMES, { deck: [], first: "Ben", herds: { Anna: { horse: 4 }, Ben: { cow: 2 }, Clara: { cow: 2 } } });
    r = withTx(r, (d) => { pl(d, "Ben").away = true; pl(d, "Clara").away = true; });
    expect(tickAt(r, T0 + 1)!.game!.phase).toEqual({ kind: "action", playerId: idOf(r, "Ben") });
    const next = tickAt(r, T0 + D)!;
    expect([next.game!.phase, next.game!.deadline]).toEqual([{ kind: "action", playerId: idOf(r, "Clara") }, T0 + 2 * D]);
  });
});

describe("pause", () => {
  it("freezes timers and restarts the current decision at full length on resume", () => {
    let r = act(g(), "Anna", { type: "pause" }, T0 + 5_000);
    expect([r.status, r.game!.deadline, r.log.at(-1)!.text]).toEqual(["PAUSED", null, "Game paused by Anna."]);
    expect(reject(r, "Anna", choose)).toBe("paused");
    r = tickAt(r, T0 + 500_000)!;
    expect(r.game!.phase.kind).toBe("action");
    r = act(r, "Anna", { type: "resume" }, T0 + 500_000);
    expect([r.status, r.game!.deadline]).toEqual(["PLAYING", T0 + 500_000 + D]);
  });
  it("is host-only", () => expect(reject(g(), "Ben", { type: "pause" })).toBe("notHost"));
});

describe("host transfer and closing", () => {
  it("passes host after 2 minutes of host disconnection, also while paused", () => {
    let r = run(act(g(), "Anna", { type: "pause" }), { type: "disconnect", token: tok("Anna") })!;
    expect(tickAt(r, T0 + 119_999)!.hostId).toBe(idOf(r, "Anna"));
    r = tickAt(r, T0 + 120_000)!;
    expect([r.hostId, r.log.at(-1)!.text]).toEqual([idOf(r, "Ben"), "Ben is now the host."]);
  });
  it("skips disconnected players when choosing the new host", () => {
    const r = run(run(lobby(), { type: "disconnect", token: tok("Anna") }), { type: "disconnect", token: tok("Ben") })!;
    expect(tickAt(r, T0 + 120_000)!.hostId).toBe(idOf(r, "Clara"));
  });
  it("passes host on a later reconnect when nobody else was connected", () => {
    let r = lobby();
    for (const n of NAMES) r = run(r, { type: "disconnect", token: tok(n) })!;
    expect(run(r, { type: "connect", token: tok("Clara") }, T0 + 180_000)!.hostId).toBe(idOf(r, "Clara"));
  });
  it("closes after 10 minutes with nobody connected, unless someone reconnects", () => {
    let r = lobby();
    for (const n of NAMES) r = run(r, { type: "disconnect", token: tok(n) })!;
    expect(outcome(r, { type: "tick" }, T0 + 600_000)).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "inactive" }] });
    expect(tickAt(run(r, { type: "connect", token: tok("Ben") }, T0 + 300_000), T0 + 600_000)).not.toBeNull();
  });
  it("closes a finished room after 5 minutes unless the host plays again", () => {
    const done = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4 }, Clara: { cat: 4 } } });
    expect(outcome(done, { type: "tick" }, T0 + 300_000)).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "finished" }] });
    expect(tickAt(act(done, "Anna", { type: "playAgain" }, T0 + 60_000), T0 + 300_000)!.status).toBe("PLAYING");
  });
  it("starts the inactive clock when the last connected player leaves", () => {
    let r = lobby(["Anna", "Ben", "Clara"]);
    r = run(run(r, { type: "disconnect", token: tok("Ben") }), { type: "disconnect", token: tok("Clara") })!;
    r = act(r, "Anna", { type: "leaveSeat" }, T0 + 1_000);
    expect(r.nobodySince).toBe(T0 + 1_000);
    expect(nextDeadline(r)).toBe(T0 + 1_000 + 600_000);
    expect(outcome(r, { type: "tick" }, T0 + 1_000 + 600_000)).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "inactive" }] });
  });
  it("reports the earliest pending deadline", () => {
    expect(nextDeadline(g())).toBe(T0 + D);
    expect(nextDeadline(run(lobby(), { type: "disconnect", token: tok("Anna") }, T0 + 1_000))).toBe(T0 + 121_000);
    expect(nextDeadline(act(g(), "Anna", { type: "pause" }))).toBeNull();
    expect(nextDeadline(null)).toBeNull();
  });
  it("reports a finished room's closing time", () => {
    const done = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4 }, Clara: { cat: 4 } } });
    expect([done.status, done.finishedAt]).toEqual(["FINISHED", T0]);
    expect(nextDeadline(done)).toBe(T0 + 300_000);
  });
});
