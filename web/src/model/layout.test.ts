import { describe, expect, it } from "vitest";
import type { PublicPlayer } from "../../../src/protocol";
import { railOrder, seatPositions } from "./layout";

const ps = (...seats: number[]) => seats.map((seat) => ({ id: `p${seat}`, seat }));
const show = (xs: { id: string; pos: string }[]) => xs.map((x) => `${x.pos}:${x.id}`);
describe("seatPositions", () => {
  it("3 players", () => expect(show(seatPositions(ps(1, 2, 4), "p2"))).toEqual(["bottom:p2", "topLeft:p4", "topRight:p1"]));
  it("4 players", () => expect(show(seatPositions(ps(1, 2, 3, 5), "p5"))).toEqual(["bottom:p5", "left:p1", "top:p2", "right:p3"]));
  it("5 players", () =>
    expect(show(seatPositions(ps(1, 2, 3, 4, 5), "p3"))).toEqual(["bottom:p3", "left:p4", "topLeft:p5", "topRight:p1", "right:p2"]));
});

describe("railOrder", () => {
  const pl = (...seats: number[]) => seats.map((seat) => ({ id: `p${seat}`, seat }) as unknown as PublicPlayer);
  const ids = (xs: PublicPlayer[]) => xs.map((x) => x.id);
  it("lists opponents clockwise after you", () => expect(ids(railOrder(pl(1, 2, 3, 4, 5), "p3"))).toEqual(["p4", "p5", "p1", "p2"]));
  it("3 players", () => expect(ids(railOrder(pl(1, 2, 3), "p1"))).toEqual(["p2", "p3"]));
  it("starts from the lowest seat when me is not seated", () => expect(ids(railOrder(pl(3, 1, 2), "zz"))).toEqual(["p1", "p2", "p3"]));
});
