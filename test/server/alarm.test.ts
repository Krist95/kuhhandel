import { abortAllDurableObjects, reset, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../../src/protocol";
import type { GameRoom } from "../../src/room";
import { roomStub, setupGame } from "./client";

// reset() only wipes objects that are still running, so it must come before abortAllDurableObjects().
afterEach(async () => { await reset(); await abortAllDurableObjects(); });
const alarmAt = () => runInDurableObject(roomStub(), (_i, s) => s.storage.getAlarm());
const timersAt = (now: number) => runInDurableObject(roomStub(), (room: GameRoom) => room.runTimers(now));

describe("GameRoom alarm", () => {
  it("is set to the decision deadline and applies the timeout when it fires", async () => {
    const clients = await setupGame(["Anna", "Ben", "Clara"]);
    const started = (await clients[0]!.request({ type: "startGame" })) as Extract<ServerMessage, { type: "view" }>;
    const deadline = started.view.room!.game!.deadline!;
    expect(await alarmAt()).toBe(deadline);
    await timersAt(deadline);
    await clients[1]!.waitView((v) => v.room!.game!.phase.kind === "bidding");
  });
  it("is cleared when nothing is pending", async () => {
    await setupGame(["Anna"]);
    expect(await alarmAt()).toBeNull();
  });
  it("closes the room 10 minutes after the last player disconnects", async () => {
    const [anna] = await setupGame(["Anna"]);
    anna!.close();
    await vi.waitUntil(async () => (await alarmAt()) !== null);
    await timersAt((await alarmAt())!);
    expect(await runInDurableObject(roomStub(), (_i, s) => s.storage.get("room"))).toBeUndefined();
  });
});
