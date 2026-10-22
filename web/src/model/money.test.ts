import { describe, expect, it } from "vitest";
import { herdOf } from "../../../src/rules/herd";
import { herdChips, moneySummary } from "./money";

describe("money", () => {
  it("summarizes a hand, zeros included", () => expect(moneySummary([10, 0, 50, 10, 10, 0, 10])).toBe("0×2 · 10×4 · 50×1 · Total 90"));
  it("handles an empty hand", () => expect(moneySummary([])).toBe("No money"));
  it("lists owned animals and marks complete sets", () =>
    expect(herdChips(herdOf({ horse: 4, cat: 1 }))).toEqual([{ animal: "cat", count: 1, complete: false }, { animal: "horse", count: 4, complete: true }]));
});
