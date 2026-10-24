import { describe, expect, it } from "vitest";
import { extractRoomId } from "./qrLink";

describe("extractRoomId", () => {
  it("extracts the room id from a join link, case-insensitively", () => {
    expect(extractRoomId("https://x.test/join/ab12cd")).toBe("AB12CD");
    expect(extractRoomId("https://x.test/join/AB12CD")).toBe("AB12CD");
  });
  it("accepts a bare room id with no link", () => expect(extractRoomId("AB12CD")).toBe("AB12CD"));
  it("rejects anything else", () => {
    expect(extractRoomId("https://x.test/")).toBeNull();
    expect(extractRoomId("not a url or code")).toBeNull();
    expect(extractRoomId("")).toBeNull();
  });
});
