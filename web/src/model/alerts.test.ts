import { expect, it } from "vitest";
import type { Room } from "../../../src/rules/types";
import { buildView } from "../../../src/rules/view";
import { act, game, NAMES, tok, T0 } from "../../../test/rules/helpers";
import { alertKey, shouldAlert } from "./alerts";

const keyFor = (r: Room, name: string) => alertKey(buildView(r, tok(name), T0));
it("alerts only the player being waited on, and only for the listed decisions", () => {
  const r = game();
  expect([keyFor(r, "Anna"), keyFor(r, "Ben")]).toEqual([`action:${T0 + 20_000}`, null]);
  expect(keyFor(act(r, "Anna", { type: "chooseAction", action: "auction" }), "Ben")).toBe(`bidding:${T0 + 20_000}`);
  const setup = act(game(NAMES, { herds: { Anna: { cow: 1 }, Ben: { cow: 1 } } }), "Anna", { type: "chooseAction", action: "cowTrade" });
  expect(keyFor(setup, "Anna")).toBeNull();
  expect(alertKey(null)).toBeNull();
});
it("fires once per new decision", () =>
  expect([shouldAlert(null, "a:1"), shouldAlert("a:1", "a:1"), shouldAlert("a:1", "b:2"), shouldAlert("a:1", null)]).toEqual([true, false, true, false]));
