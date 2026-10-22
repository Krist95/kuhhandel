import { expect, it } from "vitest";
import { clockOffset, secondsLeft } from "./clock";
it("counts down from the server deadline even when the phone clock is off", () => {
  const off = clockOffset(1_000_000, 995_000);
  expect(off).toBe(5_000);
  expect(secondsLeft(1_020_000, 995_000, off)).toBe(20);
  expect(secondsLeft(1_020_000, 1_014_500, off)).toBe(1);
  expect(secondsLeft(1_020_000, 1_100_000, off)).toBe(0);
  expect(secondsLeft(null, 995_000, off)).toBeNull();
});
