import { describe, expect, it } from "vitest";
import { herdOf } from "../../../src/rules/herd";
import { herdChips } from "./money";

describe("money", () => {
  it("lists owned animals and marks complete sets", () =>
    expect(herdChips(herdOf({ horse: 4, cat: 1 }))).toEqual([{ animal: "cat", count: 1, complete: false }, { animal: "horse", count: 4, complete: true }]));
});
