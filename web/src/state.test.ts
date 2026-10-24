import { expect, it } from "vitest";
import type { View } from "../../src/protocol";
import type { MoneyCard } from "../../src/rules/types";
import { errorSeq, homeScreen, notice, offset, onServerMessage, picked, toast, togglePick, validPicks, view } from "./state";

const seated: View = {
  serverTime: 0,
  me: { id: "p1", money: [], offer: null, buyEnabled: null, tradeReveal: null, payment: null },
  room: { status: "LOBBY", roomId: "ABC234", roomName: "Barn", hostId: "p1", settings: { moneyRule: "swap", decisionSeconds: 20 },
    players: [], game: null, log: [], scores: null, closeAt: null },
};

it("stores the view and the clock offset", () => {
  onServerMessage({ type: "view", view: { serverTime: 10_000, me: null, room: null } }, 7_000);
  expect([view.value?.serverTime, offset.value]).toEqual([10_000, 3_000]);
});
it("turns errors into a toast and closures into a homepage notice", () => {
  onServerMessage({ type: "error", code: "badBid", message: "Bid a multiple of 10 above the top bid." }, 0);
  expect(toast.value).toBe("Bid a multiple of 10 above the top bid.");
  view.value = seated;
  homeScreen.value = { join: "ABC234" };
  onServerMessage({ type: "roomClosed", reason: "inactive" }, 0);
  expect([notice.value, homeScreen.value]).toEqual(["The room closed because nobody was connected for 10 minutes.", "home"]);
  onServerMessage({ type: "removed" }, 0);
  expect(notice.value).toBe("You were removed from the room.");
});
it("ignores a room closing for a visitor who was not in it", () => {
  view.value = { serverTime: 0, me: null, room: null };
  notice.value = null;
  homeScreen.value = "create";
  onServerMessage({ type: "roomClosed", reason: "hostClosed" }, 0);
  expect([notice.value, homeScreen.value]).toEqual([null, "create"]);
});
it("toggles a note in and out of the picked list, keeping order", () => {
  expect(togglePick(["a"], "b")).toEqual(["a", "b"]);
  expect(togglePick(["a", "b"], "a")).toEqual(["b"]);
});
it("keeps only ids still in the hand, preserving order", () => {
  const money: MoneyCard[] = [{ id: "b", value: 10 }, { id: "a", value: 0 }];
  expect(validPicks(["a", "x", "b"], money)).toEqual(["a", "b"]);
});
it("starts with nothing picked", () => {
  expect(picked.value).toEqual([]);
});

it("counts server errors so pending controls can re-enable", () => {
  const before = errorSeq.value;
  onServerMessage({ type: "error", code: "badBid", message: "Nope." }, 0);
  onServerMessage({ type: "error", code: "badBid", message: "Nope." }, 0);
  expect(errorSeq.value).toBe(before + 2);
});
