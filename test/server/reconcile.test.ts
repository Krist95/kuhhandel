import { abortAllDurableObjects, evictDurableObject, reset, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import type { GameRoom } from "../../src/room";
import { NOBODY_CONNECTED_MS, type Room } from "../../src/rules/types";
import { connect, roomStub, setupGame } from "./client";

// reset() only wipes objects that are still running, so it must come before abortAllDurableObjects().
afterEach(async () => { await reset(); await abortAllDurableObjects(); });
const stored = () => runInDurableObject(roomStub(), async (_i, s) =>
  ({ room: (await s.storage.get<Room>("room"))!, alarm: await s.storage.getAlarm() }));

describe("GameRoom lost sockets", () => {
  it("marks seats whose sockets did not survive a restart as disconnected and sets the alarm", async () => {
    const [anna] = await setupGame(["Anna", "Ben"]);
    expect((await stored()).alarm).toBeNull();
    // The instance is torn down and its sockets closed; the new instance never gets webSocketClose for them.
    await evictDurableObject(roomStub(), { webSockets: "close" });
    const { room, alarm } = await stored();
    expect(room.players.map((p) => [p.name, p.connected])).toEqual([["Anna", false], ["Ben", false]]);
    expect(room.nobodySince).not.toBeNull();
    expect(alarm).toBe(room.nobodySince! + NOBODY_CONNECTED_MS);
    // A reconnect still restores the seat.
    expect((await connect(anna!.token)).view.me!.id).toBe(anna!.view.me!.id);
    expect((await stored()).room.players.find((p) => p.name === "Anna")!.connected).toBe(true);
  });
  it("changes nothing after a hibernation wake, when every connected seat still has its socket", async () => {
    await setupGame(["Anna", "Ben"]);
    const before = await stored();
    await evictDurableObject(roomStub()); // hibernates the sockets
    expect(await stored()).toEqual(before);
  });
  it("treats a socket error like a close", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    await runInDurableObject(roomStub(), async (room: GameRoom, s) => {
      const ws = s.getWebSockets().find((w) => (w.deserializeAttachment() as { token: string | null }).token === b!.token)!;
      await room.webSocketError(ws, new Error("connection reset"));
    });
    await anna!.waitView((v) => !v.room!.players.find((p) => p.name === "Ben")!.connected);
  });
});
