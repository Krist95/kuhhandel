import { describe, expect, it } from "vitest";
import type { PublicPlayer } from "../../../src/protocol";
import { herdOf } from "../../../src/rules/herd";
import type { Herd, Seat } from "../../../src/rules/types";
import { boardRows, deckLeft, ledger, podBadge } from "./herds";

const pp = (id: string, seat: number, herd: Partial<Herd> = {}, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  id, name: id, seat: seat as Seat, connected: true, away: false, out: false, moneyCount: 5, herd: herdOf(herd), ...extra,
});

// LATE cast from docs/design/kuhhandel-table/markup.mjs
const late = (): PublicPlayer[] => [
  pp("You", 1, { horse: 2, sheep: 1, donkey: 1, goat: 1 }),
  pp("Anna", 2, { goose: 2, pig: 1, cat: 1, dog: 3, sheep: 1, goat: 2 }),
  pp("Ben", 3, { cat: 1, horse: 1, cow: 2, donkey: 1, goose: 1 }),
  pp("Clara", 4, { rooster: 4, cow: 1, sheep: 2, goose: 1 }),
  pp("Dan", 5, { dog: 1, goat: 1, donkey: 2 }),
];

describe("ledger", () => {
  const l = ledger(herdOf({ horse: 4, cat: 1 }));
  it("has 10 entries in ANIMALS order", () => {
    expect(l).toHaveLength(10);
    expect(l[0].animal).toBe("rooster");
  });
  it("flags complete sets", () => {
    expect(l.find((e) => e.animal === "horse")).toEqual({ animal: "horse", count: 4, set: true });
    expect(l.find((e) => e.animal === "cat")?.set).toBe(false);
  });
});

describe("podBadge", () => {
  const p = (extra: Partial<PublicPlayer>) => pp("a", 1, {}, extra);
  it("prioritises Offline, Away, Out, Host", () => {
    expect(podBadge(p({ connected: false, away: true }), true)).toBe("Offline");
    expect(podBadge(p({ away: true }), true)).toBe("Away");
    expect(podBadge(p({ out: true }), true)).toBe("Out");
    expect(podBadge(p({}), true)).toBe("Host");
    expect(podBadge(p({}), false)).toBeNull();
  });
});

describe("deckLeft", () => {
  it("is 4 minus the total held", () => {
    expect(deckLeft(late())).toEqual({ rooster: 0, goose: 0, cat: 2, dog: 0, sheep: 0, goat: 0, donkey: 0, pig: 3, cow: 1, horse: 1 });
  });
});

describe("boardRows", () => {
  it("puts you first with no tradeable animals", () => {
    const rows = boardRows(late(), "You");
    expect(rows[0].player.id).toBe("You");
    expect(rows[0].me).toBe(true);
    expect(rows[0].tradeable).toEqual([]);
    expect(rows.map((r) => r.player.id)).toEqual(["You", "Anna", "Ben", "Clara", "Dan"]);
  });
  it("lists tradeable animals, excluding complete sets", () => {
    const rows = boardRows(late(), "You");
    expect(rows[1].tradeable).toEqual(["sheep", "goat"]);
    expect(rows[3].tradeable).toEqual(["sheep"]);
  });
  it("counts complete sets", () => {
    expect(boardRows(late(), "You")[3].sets).toBe(1);
  });
  it("gives out players no tradeable animals", () => {
    const players = late().map((p) => (p.id === "Dan" ? { ...p, out: true } : p));
    expect(boardRows(players, "You")[4].tradeable).toEqual([]);
  });
});
