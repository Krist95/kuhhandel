import { describe, it, expect } from "vitest";
import { parseClientMessage } from "../src/protocol";

describe("parseClientMessage", () => {
  it("accepts well-formed messages and drops unknown fields", () => {
    expect(parseClientMessage('{"type":"bid","amount":20,"x":1}')).toEqual({ type: "bid", amount: 20 });
    expect(parseClientMessage('{"type":"pass"}')).toEqual({ type: "pass" });
    const offer = { type: "cowTradeOffer", targetId: "p1", animal: "cow", count: 2, cardIds: ["a"] };
    expect(parseClientMessage(JSON.stringify(offer))).toEqual(offer);
  });
  it.each([
    "not json", "[]", "null", '{"type":"nope"}', '{"type":"bid","amount":"20"}', '{"type":"bid","amount":1e999}',
    '{"type":"pay","cardIds":"a"}', '{"type":"pay","cardIds":[1]}', '{"type":"chooseAction","action":"steal"}',
    '{"type":"cowTradeOffer","targetId":"p","animal":"unicorn","count":1,"cardIds":[]}',
    JSON.stringify({ type: "hello", clientToken: "x".repeat(65) }), JSON.stringify({ type: "pay", cardIds: Array(61).fill("a") }), "x".repeat(5000),
  ])("rejects malformed input %#", (raw) => expect(parseClientMessage(raw)).toBeNull());
});
