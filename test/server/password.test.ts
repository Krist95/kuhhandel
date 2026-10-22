import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/password";

it("verifies only the right password, with a fresh salt each time", async () => {
  const a = await hashPassword("moo"), b = await hashPassword("moo");
  expect([a.salt === b.salt, a.hash === b.hash]).toEqual([false, false]);
  expect(await verifyPassword("moo", a.hash, a.salt)).toBe(true);
  expect(await verifyPassword("Moo", a.hash, a.salt)).toBe(false);
  expect(JSON.stringify(a)).not.toContain("moo");
});
