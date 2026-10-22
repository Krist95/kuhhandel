import { expect, it } from "vitest";
import { loadToken, uuidV4 } from "./token";
it("makes v4 UUIDs", () => expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
it("reuses a stored token and stores a new one", () => {
  const data = new Map<string, string>();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  const first = loadToken(store);
  expect([data.get("kuhhandel.token"), loadToken(store)]).toEqual([first, first]);
});
it("works without usable storage", () => {
  expect(loadToken(null)).toMatch(/^[0-9a-f-]{36}$/);
  expect(loadToken({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} })).toMatch(/^[0-9a-f-]{36}$/);
});
