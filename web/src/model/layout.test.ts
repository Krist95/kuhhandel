import { describe, expect, it } from "vitest";
import type { PublicPlayer } from "../../../src/protocol";
import { railOrder } from "./layout";

describe("railOrder", () => {
  const pl = (...seats: number[]) => seats.map((seat) => ({ id: `p${seat}`, seat }) as unknown as PublicPlayer);
  const ids = (xs: PublicPlayer[]) => xs.map((x) => x.id);
  it("lists opponents clockwise after you", () => expect(ids(railOrder(pl(1, 2, 3, 4, 5), "p3"))).toEqual(["p4", "p5", "p1", "p2"]));
  it("3 players", () => expect(ids(railOrder(pl(1, 2, 3), "p1"))).toEqual(["p2", "p3"]));
  it("starts from the lowest seat when me is not seated", () => expect(ids(railOrder(pl(3, 1, 2), "zz"))).toEqual(["p1", "p2", "p3"]));
});
