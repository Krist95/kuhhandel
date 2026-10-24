import { describe, expect, it } from "vitest";
import type { PublicPlayer } from "../../../src/protocol";
import { ERROR_TEXT } from "../../../src/rules/errors";
import { formProblems, lobbySeats, normalizeRoomId, shareText } from "./lobby";

describe("lobby model", () => {
  it("normalizes room IDs", () => expect(normalizeRoomId(" abc-23x ")).toBe("ABC23X"));
  it("checks create forms against the server limits", () => {
    expect(formProblems({ roomName: "", playerName: " ", moneyRule: "swap", decisionSeconds: 20 }, "create"))
      .toEqual([ERROR_TEXT.badRoomName, ERROR_TEXT.badName]);
    expect(formProblems({ roomName: "Barn", playerName: "Ben", moneyRule: "swap", decisionSeconds: 20 }, "create")).toEqual([]);
  });
  it("builds the share text with the join link and no password", () => {
    const text = shareText("ABC123", "https://x.test/join/ABC123");
    expect(text).toContain("https://x.test/join/ABC123");
    expect(text).toContain("ABC123");
    expect(text).not.toContain("Password");
  });
  it("places players by seat", () =>
    expect(lobbySeats([{ seat: 3 }, { seat: 1 }] as PublicPlayer[]).map((p) => p?.seat ?? null)).toEqual([1, null, 3, null, null]));
});
