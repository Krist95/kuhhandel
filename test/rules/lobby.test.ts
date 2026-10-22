import { describe, expect, it } from "vitest";
import { by, createAction, fail, joinAction, lobby, outcome, pl, run, T0, tok } from "./helpers";

describe("lobby", () => {
  it("creates a room with a 6-char ID, a connected host and default settings", () => {
    const r = run(null, createAction())!;
    expect(r.status).toBe("LOBBY");
    expect(r.roomId).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(r.hostId).toBe(pl(r, "Anna").id);
    expect(pl(r, "Anna")).toMatchObject({ seat: 1, connected: true });
    expect(r.settings).toEqual({ moneyRule: "swap", decisionSeconds: 20 });
  });
  it("refuses a second room and joining a missing room", () => {
    expect(fail(lobby(), createAction("Zed", 4))).toBe("roomInUse");
    expect(fail(null, joinAction("Ben", 2))).toBe("badCredentials");
  });
  it("rejects duplicate names after trimming, case-insensitively", () => {
    expect(fail(lobby(["Anna", "Ben"]), joinAction("  anna ", 3))).toBe("nameTaken");
    expect(fail(lobby(["Anna", "Ben"]), { type: "join", token: "tok-ben-2", playerName: "BEN", seat: 3 })).toBe("nameTaken");
  });
  it("rejects a token that already has a seat", () => {
    expect(fail(lobby(["Anna", "Ben"]), joinAction("Ben", 3))).toBe("alreadySeated");
  });
  it("enforces 1–16 character names counted in code points", () => {
    for (const bad of ["", "   ", "x".repeat(17)]) expect(fail(lobby(["Anna"]), joinAction(bad, 2))).toBe("badName");
    expect(run(lobby(["Anna"]), joinAction("🐄".repeat(16), 2))).not.toBeNull();
  });
  it("rejects taken and invalid seats", () => {
    expect(fail(lobby(["Anna", "Ben"]), joinAction("Clara", 2))).toBe("seatTaken");
    for (const s of [0, 6, 2.5]) expect(fail(lobby(["Anna"]), joinAction("Clara", s))).toBe("badSeat");
  });
  it("lets a player leave and join again", () => {
    const r = run(lobby(), by("Ben", { type: "leaveSeat" }))!;
    expect(r.players.map((p) => p.name)).toEqual(["Anna", "Clara"]);
    expect(run(r, joinAction("Ben", 2))!.players).toHaveLength(3);
  });
  it("passes host clockwise when the host leaves and closes when the last player leaves", () => {
    let r = run(run(run(null, createAction("Anna", 3)), joinAction("Ben", 1)), joinAction("Clara", 5))!;
    r = run(r, by("Anna", { type: "leaveSeat" }))!;
    expect(r.hostId).toBe(pl(r, "Clara").id); // seat 5 comes after seat 3
    r = run(r, by("Clara", { type: "leaveSeat" }))!;
    expect(r.hostId).toBe(pl(r, "Ben").id);
    expect(outcome(r, by("Ben", { type: "leaveSeat" }))).toEqual({ ok: true, state: null, events: [{ kind: "closed", reason: "hostClosed" }] });
  });
  it("lets only the host remove others and blocks the removed token", () => {
    const r = lobby();
    expect(fail(r, by("Ben", { type: "removePlayer", playerId: pl(r, "Clara").id }))).toBe("notHost");
    expect(fail(r, by("Anna", { type: "removePlayer", playerId: pl(r, "Anna").id }))).toBe("invalid");
    const o = outcome(r, by("Anna", { type: "removePlayer", playerId: pl(r, "Ben").id }));
    expect(o.ok && o.events).toEqual([{ kind: "removed", token: tok("Ben") }]);
    expect(fail(o.ok ? o.state : null, joinAction("Ben", 2))).toBe("blocked");
  });
  it("lets only the host change settings, and only to allowed values", () => {
    expect(run(lobby(), by("Anna", { type: "updateSettings", moneyRule: "loserTakesBoth", decisionSeconds: 60 }))!.settings)
      .toEqual({ moneyRule: "loserTakesBoth", decisionSeconds: 60 });
    expect(fail(lobby(), by("Anna", { type: "updateSettings", decisionSeconds: 15 }))).toBe("invalid");
    expect(fail(lobby(), by("Ben", { type: "updateSettings", decisionSeconds: 30 }))).toBe("notHost");
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
