import { describe, expect, it } from "vitest";
import type { PublicPlayer } from "../../../src/protocol";
import { ERROR_TEXT } from "../../../src/rules/errors";
import { formProblems, lobbySeats, normalizeRoomId, savePassword, savedPassword, shareText } from "./lobby";

describe("lobby model", () => {
  it("normalizes room IDs", () => expect(normalizeRoomId(" abc-23x ")).toBe("ABC23X"));
  it("checks forms against the server limits", () => {
    expect(formProblems({ roomName: "", roomId: "", password: "", playerName: " ", seat: null }, "create"))
      .toEqual([ERROR_TEXT.badRoomName, ERROR_TEXT.badPassword, ERROR_TEXT.badName, ERROR_TEXT.badSeat]);
    expect(formProblems({ roomName: "", roomId: "ABC234", password: "pw", playerName: "Ben", seat: 2 }, "join")).toEqual([]);
    expect(formProblems({ roomName: "", roomId: " ", password: "pw", playerName: "Ben", seat: 2 }, "join")).toEqual([ERROR_TEXT.badCredentials]);
  });
  it("builds the share text", () =>
    expect(shareText("ABC234", "moo", "https://k.example")).toBe("Join my Kuhhandel game: https://k.example\nRoom ID: ABC234\nPassword: moo"));
  it("places players by seat", () =>
    expect(lobbySeats([{ seat: 3 }, { seat: 1 }] as PublicPlayer[]).map((p) => p?.seat ?? null)).toEqual([1, null, 3, null, null]));
  it("remembers the password locally", () => {
    const data = new Map<string, string>();
    savePassword({ setItem: (k, v) => void data.set(k, v) }, "moo");
    expect(savedPassword({ getItem: (k) => data.get(k) ?? null })).toBe("moo");
  });
});
