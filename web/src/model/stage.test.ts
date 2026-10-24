import { describe, expect, it } from "vitest";
import type { PublicPhase, PublicPlayer } from "../../../src/protocol";
import { buildView } from "../../../src/rules/view";
import { act, game, tok, T0 } from "../../../test/rules/helpers";
import { bidderPills, intro, payHint, ringState, stepBid, tradeOptions } from "./stage";

const P = (seat: number, out = false): PublicPlayer =>
  ({ id: `p${seat}`, name: `P${seat}`, seat: seat as PublicPlayer["seat"], connected: true, away: false, out, moneyCount: 0, herd: {} as never });
const players = [1, 2, 3, 4, 5].map((s) => P(s));
type Bid = Extract<PublicPhase, { kind: "bidding" | "decision" }>;
const phase = (o: Partial<Bid> = {}): Bid =>
  ({ kind: "bidding", card: "cow", auctioneerId: "p2", topBid: 120, topBidderId: "p5", turnId: "p3", passed: ["p1"], excluded: [], ...o });

describe("bidderPills", () => {
  it("runs clockwise after the auctioneer with states and amounts", () => {
    expect(bidderPills(phase(), players, "p4")).toEqual([
      { id: "p3", label: "P3", state: "now", amount: null },
      { id: "p4", label: "You", state: "wait", amount: null },
      { id: "p5", label: "P5", state: "top", amount: 120 },
      { id: "p1", label: "P1", state: "passed", amount: null },
    ]);
  });
  it("applies excl > passed > now precedence and drops out players", () => {
    const ps = [P(1), P(2), P(3), P(4, true), P(5)];
    const r = bidderPills(phase({ passed: ["p3"], excluded: ["p5"], turnId: "p3", topBidderId: null }), ps, "p1");
    expect(r.map((x) => [x.id, x.state])).toEqual([["p3", "passed"], ["p5", "excl"], ["p1", "wait"]]);
  });
});

describe("tradeOptions", () => {
  it("flattens targets then animals", () => {
    const r = tradeOptions([{ playerId: "b", animals: [{ animal: "horse", maxCount: 1 }] }, { playerId: "c", animals: [{ animal: "sheep", maxCount: 2 }] }]);
    expect(r).toEqual([{ playerId: "b", animal: "horse", maxCount: 1 }, { playerId: "c", animal: "sheep", maxCount: 2 }]);
  });
});

describe("payHint", () => {
  it("words the remaining, exact and over cases", () => {
    expect(payHint(110, 160)).toBe("50 still to go.");
    expect(payHint(160, 160)).toBe("Exact.");
    expect(payHint(190, 160)).toBe("30 over — no change given.");
  });
});

describe("stepBid", () => {
  it("steps by 10, never below the minimum", () => {
    expect(stepBid(100, 100, -1)).toBe(100);
    expect(stepBid(100, 90, 1)).toBe(110);
  });
});

describe("ringState", () => {
  it("computes progress, low and label", () => {
    expect(ringState(12, 20, false)).toEqual({ p: 0.6, low: false, label: "12" });
    expect(ringState(4, 20, false).low).toBe(true);
    expect(ringState(12, 20, true).label).toBeNull();
    expect(ringState(null, 20, false).label).toBeNull();
    expect(ringState(25, 20, false).p).toBe(1);
  });
});

describe("intro", () => {
  const view = () => buildView(game(), tok("Clara"), T0);
  it("is non-null on a fresh deal, led by the active player", () => {
    const i = intro(view())!;
    expect(i).not.toBeNull();
    expect(i.order[0].first).toBe(true);
    expect(i.order[0].id).toBe(i.firstId);
    expect(i.order).toHaveLength(3);
    expect(i.order.filter((o) => o.me)).toHaveLength(1);
    expect(i.order.find((o) => o.me)!.label).toBe("You");
  });
  it("keys on room and first player, not the deadline (pause/resume keeps it)", () => {
    const v = view();
    const i = intro(v)!;
    expect(i.key).toBe(`${v.room!.roomId}:${i.firstId}`);
    const resumed = { ...v, room: { ...v.room!, game: { ...v.room!.game!, deadline: (v.room!.game!.deadline ?? 0) + 7000 } } };
    expect(intro(resumed)!.key).toBe(i.key);
  });
  it("is null once play starts or when paused", () => {
    expect(intro(buildView(act(game(), "Anna", { type: "chooseAction", action: "auction" }), tok("Clara"), T0))).toBeNull();
    const v = view();
    expect(intro({ ...v, room: { ...v.room!, status: "PAUSED" } })).toBeNull();
  });
});
