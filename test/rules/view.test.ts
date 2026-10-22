import { describe, it, expect } from "vitest";
import { buildView } from "../../src/rules/view";
import type { View } from "../../src/protocol";
import type { Room } from "../../src/rules/types";
import { act, game, ids, idOf, lobby, NAMES, pl, T0, tok } from "./helpers";

const view = (r: Room, name: string) => buildView(r, tok(name), T0);
const json = (v: View) => JSON.stringify(v);
const cardIdsOf = (r: Room, name: string) => pl(r, name).money.map((c) => c.id);
const auctionTo = (r: Room, amount: number) =>
  act(act(act(r, "Anna", { type: "chooseAction", action: "auction" }), "Ben", { type: "bid", amount }), "Clara", { type: "pass" });
const challenge = (r: Room, cardIds: (s: Room) => string[]) => {
  const s = act(r, "Anna", { type: "chooseAction", action: "cowTrade" });
  return act(s, "Anna", { type: "cowTradeOffer", targetId: idOf(s, "Ben"), animal: "cow", count: 2, cardIds: cardIds(s) });
};
const cows = { Anna: { cow: 2 }, Ben: { cow: 2 } };

describe("views", () => {
  it("tells visitors nothing about the room", () => {
    expect(buildView(lobby(), "tok-zed", T0)).toEqual({ serverTime: T0, me: null, room: null });
    expect(buildView(null, tok("Anna"), T0)).toEqual({ serverTime: T0, me: null, room: null });
  });
  it("shows public player fields, only your own cards, and never a token", () => {
    const r = game();
    for (const n of NAMES) {
      const v = view(r, n), s = json(v);
      expect(v.me!.money.map((c) => c.id).sort()).toEqual(cardIdsOf(r, n).sort());
      for (const o of NAMES.filter((x) => x !== n)) for (const id of cardIdsOf(r, o)) expect(s).not.toContain(id);
      for (const t of NAMES.map(tok)) expect(s).not.toContain(t);
      expect(Object.keys(v.room!.players[0]!).sort()).toEqual(["away", "connected", "herd", "id", "moneyCount", "name", "out", "seat"]);
    }
  });
  it("never includes the room's password hash or salt", () => {
    const finished = game(NAMES, { deck: [], herds: { Anna: { horse: 4 } } });
    for (const base of [lobby(), game(), finished]) {
      const r: Room = { ...base, passwordHash: "HASH-5f3a9c0e", passwordSalt: "SALT-c81d2e47" };
      for (const n of NAMES) {
        const s = json(view(r, n));
        expect(s).not.toContain("HASH-5f3a9c0e");
        expect(s).not.toContain("SALT-c81d2e47");
      }
    }
  });
  it("shows Buy availability only to the auctioneer, and others cannot tell the difference", () => {
    const poor = auctionTo(game(NAMES, { money: { Anna: [10, 10, 10, 10, 10, 10, 10] } }), 100);
    const rich = auctionTo(game(NAMES, { money: { Anna: [50, 50, 50, 10, 10, 10, 10] } }), 100);
    expect([view(poor, "Anna").me!.buyEnabled, view(rich, "Anna").me!.buyEnabled]).toEqual([false, true]);
    for (const n of ["Ben", "Clara"]) {
      expect(view(poor, n).me!.buyEnabled).toBeNull();
      expect(view(poor, n)).toEqual(view(rich, n));
    }
  });
  it("hides a cow trade offer from everyone but the challenger", () => {
    let offered: string[] = [];
    const r = challenge(game(NAMES, { herds: cows }), (s) => (offered = ids(s, "Anna", 50, 10)));
    expect(view(r, "Anna").me!.offer!.map((c) => c.id)).toEqual(offered);
    for (const n of ["Ben", "Clara"]) {
      expect(view(r, n).room!.game!.phase).toMatchObject({ kind: "tradeResponse", offerCount: 2 });
      expect(view(r, n).me!.offer).toBeNull();
      for (const id of offered) expect(json(view(r, n))).not.toContain(id);
    }
  });
  it("reveals counter-offer values only to the two participants, in both money modes", () => {
    for (const moneyRule of ["swap", "loserTakesBoth"] as const) {
      const o = challenge(game(NAMES, { settings: { moneyRule }, herds: cows, money: { Anna: [10, 10, 50, 0], Ben: [100, 100, 10, 10] } }),
        (s) => ids(s, "Anna", 10, 10, 50));
      const r = act(o, "Ben", { type: "cowTradeResponse", cardIds: ids(o, "Ben", 100, 100, 10) });
      expect(view(r, "Anna").me!.tradeReveal).toMatchObject({ challengerTotal: 70, defenderTotal: 210, winnerId: idOf(r, "Ben") });
      expect(view(r, "Ben").me!.tradeReveal).toMatchObject({ challengerValues: [10, 10, 50], defenderValues: [100, 100, 10] });
      const clara = view(r, "Clara");
      expect(clara.me!.tradeReveal).toBeNull();
      expect(clara.room!.game!.lastTrade).toMatchObject({ challengerCards: 3, defenderCards: 3, winnerId: idOf(r, "Ben") });
      for (const id of ["Anna-1", "Anna-2", "Anna-3", "Ben-1", "Ben-2", "Ben-3"]) expect(json(clara)).not.toContain(id);
      for (const e of r.log) expect(e.text).not.toMatch(/\b(70|210)\b/);
    }
  });
  it("reveals nothing on a forfeit", () => {
    const o = challenge(game(NAMES, { herds: cows }), (s) => ids(s, "Anna", 0));
    const r = act(o, "Ben", { type: "cowTradeResponse", cardIds: [] });
    for (const n of NAMES) expect(view(r, n).me!.tradeReveal).toBeNull();
    expect(view(r, "Clara").room!.game!.lastTrade).toMatchObject({ challengerCards: 1, defenderCards: null });
  });
  it("shows payment cards to the payer and receiver only", () => {
    let r = act(auctionTo(game(), 20), "Anna", { type: "auctioneerDecision", decision: "sell" });
    r = act(r, "Ben", { type: "pay", cardIds: ids(r, "Ben", 10, 10) });
    for (const n of ["Anna", "Ben"]) expect(view(r, n).me!.payment).toMatchObject({ amount: 20, cards: [10, 10] });
    expect(view(r, "Clara").me!.payment).toBeNull();
  });
  it("shows a called bluff to everyone", () => {
    const r = act(auctionTo(game(), 100), "Anna", { type: "auctioneerDecision", decision: "sell" });
    for (const n of NAMES) expect(view(r, n).room!.game!.phase).toMatchObject({ kind: "bluff", cards: [0, 0, 10, 10, 10, 10, 50] });
  });
  it("includes public game details and the finished-room countdown", () => {
    expect(view(game(), "Ben").room!.game).toMatchObject({ deckCount: 40, donkeysRevealed: 0, nextDonkeyPayout: 50, deadline: T0 + 20_000 });
    const done = game(NAMES, { deck: [], herds: { Anna: { horse: 4 }, Ben: { cow: 4 }, Clara: { cat: 4 } } });
    expect(view(done, "Ben").room!.closeAt).toBe(T0 + 300_000);
  });
});
