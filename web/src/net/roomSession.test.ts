import { expect, it } from "vitest";
import { clearRoomId, loadRoomId, saveRoomId } from "./roomSession";

it("saves, reloads, and clears a room id", () => {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  expect(loadRoomId(store)).toBeNull();
  saveRoomId(store, "AB12CD");
  expect(loadRoomId(store)).toBe("AB12CD");
  clearRoomId(store);
  expect(loadRoomId(store)).toBeNull();
});
it("never throws without usable storage", () => {
  expect(loadRoomId(null)).toBeNull();
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  expect(loadRoomId(blocked)).toBeNull();
  expect(() => saveRoomId(blocked, "AB12CD")).not.toThrow();
  expect(() => clearRoomId(blocked)).not.toThrow();
});
