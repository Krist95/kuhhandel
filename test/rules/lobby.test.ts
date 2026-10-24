import { describe, expect, it } from "vitest";
import { by, createAction, fail, joinAction, lobby, outcome, pl, run, T0, tok, updateSettingsAction } from "./helpers";

describe("lobby", () => {
  it("stores the given room ID uppercased, with a connected host and the given settings", () => {
    const r = run(null, createAction())!;
    expect(r.status).toBe("LOBBY");
    expect(r.roomId).toBe("AB12CD");
    expect(r.hostId).toBe(pl(r, "Anna").id);
    expect(pl(r, "Anna")).toMatchObject({ seat: 1, connected: true });
    expect(r.settings).toEqual({ moneyRule: "swap", decisionSeconds: 20 });
  });
  it("creates a room with default settings", () => {
    const r = run(null, createAction())!;
    expect(r.settings).toEqual({ moneyRule: "swap", decisionSeconds: 20 });
  });
  it("lets the host update settings in the lobby, partially or fully, before the game starts", () => {
    let r = run(lobby(), updateSettingsAction("Anna", { decisionSeconds: 60 }))!;
    expect(r.settings).toEqual({ moneyRule: "swap", decisionSeconds: 60 });
    r = run(r, updateSettingsAction("Anna", { moneyRule: "loserTakesBoth", decisionSeconds: 10 }))!;
    expect(r.settings).toEqual({ moneyRule: "loserTakesBoth", decisionSeconds: 10 });
  });
  it("rejects invalid settings on update, and rejects non-host or mid-game updates", () => {
    expect(fail(lobby(), updateSettingsAction("Anna", { decisionSeconds: 15 }))).toBe("invalid");
    expect(fail(lobby(), updateSettingsAction("Anna", { moneyRule: "bogus" as never }))).toBe("invalid");
    expect(fail(lobby(), updateSettingsAction("Ben", { decisionSeconds: 60 }))).toBe("notHost");
  });
  it("refuses a second room and joining a missing room", () => {
    expect(fail(lobby(), createAction("Zed"))).toBe("roomInUse");
    expect(fail(null, joinAction("Ben"))).toBe("roomNotFound");
  });
  it("rejects duplicate names after trimming, case-insensitively", () => {
    expect(fail(lobby(["Anna", "Ben"]), joinAction("  anna "))).toBe("nameTaken");
    expect(fail(lobby(["Anna", "Ben"]), { type: "join", token: "tok-ben-2", playerName: "BEN" })).toBe("nameTaken");
  });
  it("rejects a token that already has a seat", () => {
    expect(fail(lobby(["Anna", "Ben"]), joinAction("Ben"))).toBe("alreadySeated");
  });
  it("enforces 1–16 character names counted in code points", () => {
    for (const bad of ["", "   ", "x".repeat(17)]) expect(fail(lobby(["Anna"]), joinAction(bad))).toBe("badName");
    expect(run(lobby(["Anna"]), joinAction("🐄".repeat(16)))).not.toBeNull();
  });
  it("assigns the first open seat, ascending", () => {
    const r = run(lobby(["Anna", "Ben"]), joinAction("Clara"))!;
    expect(pl(r, "Clara").seat).toBe(3);
  });
  it("assigns a seat left open by an earlier departure", () => {
    let r = lobby(["Anna", "Ben", "Clara"]); // seats 1,2,3
    r = run(r, by("Ben", { type: "leaveSeat" }))!; // seat 2 now open
    r = run(r, joinAction("Dan"))!;
    expect(pl(r, "Dan").seat).toBe(2);
  });
  it("rejects joining a full room", () => {
    const r = lobby(["Anna", "Ben", "Clara", "Dan", "Eve"]); // seats 1-5 all taken
    expect(fail(r, joinAction("Fred"))).toBe("roomFull");
  });
  it("lets a player leave and join again", () => {
    const r = run(lobby(), by("Ben", { type: "leaveSeat" }))!;
    expect(r.players.map((p) => p.name)).toEqual(["Anna", "Clara"]);
    expect(run(r, joinAction("Ben"))!.players).toHaveLength(3);
  });
  it("passes host clockwise when the host leaves and closes when the last player leaves", () => {
    let r = run(run(run(null, createAction("Anna")), joinAction("Ben")), joinAction("Clara"))!;
    r = run(r, by("Anna", { type: "leaveSeat" }))!;
    expect(r.hostId).toBe(pl(r, "Ben").id); // seat 2 comes after seat 1
    r = run(r, by("Ben", { type: "leaveSeat" }))!;
    expect(r.hostId).toBe(pl(r, "Clara").id);
    expect(outcome(r, by("Clara", { type: "leaveSeat" }))).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "hostClosed" }] });
  });
  it("lets only the host remove others and blocks the removed token", () => {
    const r = lobby();
    expect(fail(r, by("Ben", { type: "removePlayer", playerId: pl(r, "Clara").id }))).toBe("notHost");
    expect(fail(r, by("Anna", { type: "removePlayer", playerId: pl(r, "Anna").id }))).toBe("invalid");
    const o = outcome(r, by("Anna", { type: "removePlayer", playerId: pl(r, "Ben").id }));
    expect(o.ok && o.events).toEqual([{ kind: "removed", token: tok("Ben") }]);
    expect(fail(o.ok ? o.state : null, joinAction("Ben"))).toBe("blocked");
  });
  it("tracks connections and when nobody is connected", () => {
    let r = run(lobby(["Anna"]), { type: "disconnect", token: tok("Anna") }, T0 + 5)!;
    expect(pl(r, "Anna")).toMatchObject({ connected: false, disconnectedAt: T0 + 5 });
    expect(r.nobodySince).toBe(T0 + 5);
    r = run(r, { type: "connect", token: tok("Anna") }, T0 + 9)!;
    expect([pl(r, "Anna").connected, r.nobodySince]).toEqual([true, null]);
  });
  it("ignores a repeated disconnect, so the first disconnect time stands", () => {
    let r = run(lobby(["Anna", "Ben"]), { type: "disconnect", token: tok("Anna") }, T0 + 5)!;
    r = run(r, { type: "disconnect", token: tok("Ben") }, T0 + 7)!;
    r = run(r, { type: "disconnect", token: tok("Anna") }, T0 + 50)!; // e.g. webSocketError, then the late webSocketClose
    r = run(r, { type: "disconnect", token: tok("Ben") }, T0 + 60)!;
    expect([pl(r, "Anna").disconnectedAt, pl(r, "Ben").disconnectedAt, r.nobodySince]).toEqual([T0 + 5, T0 + 7, T0 + 7]);
  });
  it("lets only the host close the room", () => {
    expect(outcome(lobby(), by("Anna", { type: "closeRoom" }))).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "hostClosed" }] });
    expect(fail(lobby(), by("Ben", { type: "closeRoom" }))).toBe("notHost");
  });
  it("rejects unseated senders and never mutates its input", () => {
    const r = lobby(), before = JSON.stringify(r);
    expect(fail(r, by("Zed", { type: "leaveSeat" }))).toBe("notSeated");
    fail(r, by("Ben", { type: "removePlayer", playerId: "x" }));
    expect(JSON.stringify(r)).toBe(before);
  });
});
