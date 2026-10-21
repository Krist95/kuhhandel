import { describe, expect, it } from "vitest";
import { mulberry32, pickOne, randomId, shuffle } from "../../src/rules/rng";
import { ANIMAL_VALUE, ROOM_ID_ALPHABET, STARTING_MONEY } from "../../src/rules/types";

describe("rng", () => {
  it("mulberry32 is deterministic and in [0, 1)", () => {
    const xs = Array.from({ length: 100 }, mulberry32(42));
    expect(xs).toEqual(Array.from({ length: 100 }, mulberry32(42)));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
  it("randomId only uses the given alphabet", () => {
    expect(randomId(mulberry32(7), 6, ROOM_ID_ALPHABET)).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(randomId(mulberry32(7))).toMatch(/^[a-z0-9]{8}$/);
  });
  it("shuffle returns a seeded permutation and leaves its input alone", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(mulberry32(1), input);
    expect([...out].sort()).toEqual(input);
    expect(out).toEqual(shuffle(mulberry32(1), input));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("pickOne returns an element", () => expect([1, 2, 3]).toContain(pickOne(mulberry32(3), [1, 2, 3])));
  it("pins the spec constants", () => {
    expect(STARTING_MONEY.reduce<number>((s, v) => s + v, 0)).toBe(90);
    expect(Object.values(ANIMAL_VALUE)).toEqual([10, 40, 90, 160, 250, 350, 500, 650, 800, 1000]);
  });
});
