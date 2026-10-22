import { describe, expect, it } from "vitest";
import { seatPositions } from "./layout";

const ps = (...seats: number[]) => seats.map((seat) => ({ id: `p${seat}`, seat }));
const show = (xs: { id: string; pos: string }[]) => xs.map((x) => `${x.pos}:${x.id}`);
describe("seatPositions", () => {
  it("3 players", () => expect(show(seatPositions(ps(1, 2, 4), "p2"))).toEqual(["bottom:p2", "topLeft:p4", "topRight:p1"]));
  it("4 players", () => expect(show(seatPositions(ps(1, 2, 3, 5), "p5"))).toEqual(["bottom:p5", "left:p1", "top:p2", "right:p3"]));
  it("5 players", () =>
    expect(show(seatPositions(ps(1, 2, 3, 4, 5), "p3"))).toEqual(["bottom:p3", "left:p4", "topLeft:p5", "topRight:p1", "right:p2"]));
});
