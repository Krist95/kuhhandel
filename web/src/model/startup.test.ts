import { describe, expect, it } from "vitest";
import { decideStartup } from "./startup";

describe("decideStartup", () => {
  it("uses a fresh join link over a saved room, and clears the URL", () => {
    expect(decideStartup("/join/ABC123", "SAVED1")).toEqual({ roomId: "ABC123", clearUrl: true });
  });

  it("uses a fresh join link when there is no saved room, and clears the URL", () => {
    expect(decideStartup("/join/abc123", null)).toEqual({ roomId: "ABC123", clearUrl: true });
  });

  it("falls back to the saved room when there is no join link", () => {
    expect(decideStartup("/", "SAVED1")).toEqual({ roomId: "SAVED1", clearUrl: false });
  });

  it("has nothing to connect to when there is no join link and no saved room", () => {
    expect(decideStartup("/", null)).toEqual({ roomId: null, clearUrl: false });
  });

  it("falls back to the saved room for a stale or malformed join path, and still clears the URL", () => {
    expect(decideStartup("/join/dead-room-that-is-gone", "SAVED1")).toEqual({ roomId: "SAVED1", clearUrl: true });
  });

  it("has nothing to connect to for a malformed join path with no saved room, but still clears the URL", () => {
    expect(decideStartup("/join/", null)).toEqual({ roomId: null, clearUrl: true });
  });
});
