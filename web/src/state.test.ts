import { expect, it } from "vitest";
import { homeScreen, notice, offset, onServerMessage, toast, view } from "./state";
it("stores the view and the clock offset", () => {
  onServerMessage({ type: "view", view: { serverTime: 10_000, me: null, room: null } }, 7_000);
  expect([view.value?.serverTime, offset.value]).toEqual([10_000, 3_000]);
});
it("turns errors into a toast and closures into a homepage notice", () => {
  onServerMessage({ type: "error", code: "badBid", message: "Bid a multiple of 10 above the top bid." }, 0);
  expect(toast.value).toBe("Bid a multiple of 10 above the top bid.");
  onServerMessage({ type: "roomClosed", reason: "inactive" }, 0);
  expect([notice.value, homeScreen.value]).toEqual(["The room closed because nobody was connected for 10 minutes.", "home"]);
  onServerMessage({ type: "removed" }, 0);
  expect(notice.value).toBe("You were removed from the room.");
});
