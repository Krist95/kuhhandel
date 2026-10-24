import { describe, expect, it } from "vitest";
import { herdOf } from "../../../src/rules/herd";
import { herdChips, noteOverlap } from "./money";

describe("money", () => {
  it("lists owned animals and marks complete sets", () =>
    expect(herdChips(herdOf({ horse: 4, cat: 1 }))).toEqual([{ animal: "cat", count: 1, complete: false }, { animal: "horse", count: 4, complete: true }]));
});

describe("noteOverlap", () => {
  it("is zero when the notes fit side by side", () => {
    expect(noteOverlap(6, 400)).toEqual({ overlap: 0, scroll: false });
    expect(noteOverlap(1, 10)).toEqual({ overlap: 0, scroll: false });
    expect(noteOverlap(0, 10)).toEqual({ overlap: 0, scroll: false });
  });
  it("overlaps just enough for all n notes to fit", () => {
    // 14 notes: 14*56 + 13*4 = 836; 836 - 446 = 390 over 13 gaps = 30.
    expect(noteOverlap(14, 446)).toEqual({ overlap: 30, scroll: false });
  });
  it("keeps at least 22px of each note visible, then scrolls", () => {
    // 22px visible per note means at most 56 + 4 - 22 = 38 overlap.
    expect(noteOverlap(14, 300)).toEqual({ overlap: 38, scroll: true });
    expect(noteOverlap(14, 13 * 22 + 56)).toEqual({ overlap: 38, scroll: false });
  });
});
