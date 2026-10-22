import { expect, it } from "vitest";
import { backoffMs } from "./socket";
it("backs off exponentially up to 10 s", () => expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]));
