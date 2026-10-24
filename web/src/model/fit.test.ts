import { describe, expect, it } from "vitest";
import { fitTable } from "./fit";

describe("fitTable", () => {
  it("fills a 844×390 phone by height", () => expect(fitTable(844, 390)).toEqual({ scale: 390 / 360, width: 844 / (390 / 360), height: 360 }));
  it("fits width on a 667×375 phone", () => expect(fitTable(667, 375)).toEqual({ scale: 667 / 700, width: 700, height: 360 }));
  it("handles a 932×430 phone", () => expect(fitTable(932, 430).height).toBe(360));
  it("handles a 640×320 landscape window", () => {
    const f = fitTable(640, 320);
    expect(f.scale * f.height).toBeLessThanOrEqual(320);
    expect(f.scale * f.width).toBeLessThanOrEqual(640);
  });
});
