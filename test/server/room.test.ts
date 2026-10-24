import { abortAllDurableObjects, evictDurableObject, reset, runInDurableObject } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import type { View } from "../../src/protocol";
import { connect, roomStub, setupGame } from "./client";

// reset() only wipes objects that are still running, so it must come before abortAllDurableObjects().
afterEach(async () => { await reset(); await abortAllDurableObjects(); });
const create = { type: "createRoom", roomName: "B", playerName: "Zed", moneyRule: "swap", decisionSeconds: 20 } as const;
const ben = (v: View) => v.room!.players.find((p) => p.name === "Ben")!;

describe("GameRoom", () => {
  it("answers plain HTTP on /ws with 426", async () => {
    expect((await exports.default.fetch("https://kuhhandel.test/ws")).status).toBe(426);
  });
  it("gives a visitor an empty view after hello", async () => {
    expect((await connect()).view).toEqual({ serverTime: expect.any(Number), me: null, room: null });
  });
  it("makes the creator host and refuses a second room", async () => {
    const [anna] = await setupGame(["Anna"]);
    expect(anna!.view.room).toMatchObject({ status: "LOBBY", hostId: anna!.view.me!.id });
    expect(await (await connect()).request(create))
      .toEqual({ type: "error", code: "roomInUse", message: "A room is already in use. Ask the host for the room ID and password." });
  });
  it("gives roomNotFound for an unknown room id, and rate-limits a connection after 5 failures", async () => {
    const [anna] = await setupGame(["Anna"]);
    const roomId = anna!.view.room!.roomId, zed = await connect();
    const join = (id: string) => zed.request({ type: "joinRoom", roomId: id, playerName: "Zed" });
    const badId = await join("ZZZZZZ");
    expect(badId).toMatchObject({ code: "roomNotFound", message: "Room not found." });
    for (let i = 0; i < 4; i++) await join("ZZZZZZ");
    expect(await join("ZZZZZZ")).toMatchObject({ code: "tooManyAttempts" });
    const fresh = await connect();
    expect(await fresh.request({ type: "joinRoom", roomId: roomId.toLowerCase(), playerName: "Zed" }))
      .toMatchObject({ type: "view" });
  });
  it("gives gameStarted for a room that's no longer in the lobby", async () => {
    const [anna] = await setupGame(["Anna", "Ben", "Clara"]);
    await anna!.request({ type: "startGame" });
    const roomId = anna!.view.room!.roomId;
    expect(await (await connect()).request({ type: "joinRoom", roomId, playerName: "Dan" }))
      .toMatchObject({ code: "gameStarted" });
  });
  it("restores seat and view on reconnect with the same token", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    b!.close();
    await anna!.waitView((v) => !ben(v).connected);
    expect((await connect(b!.token)).view.me!.id).toBe(b!.view.me!.id);
    await anna!.waitView((v) => ben(v).connected);
  });
  it("replaces an older socket for the same token without showing a disconnect", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    const second = await connect(b!.token);
    expect(await b!.closed).toBe(4001);
    expect(second.view.me!.id).toBe(b!.view.me!.id);
    await anna!.request({ type: "imBack" }); // round trip so pending events are processed
    expect(ben(anna!.view).connected).toBe(true);
  });
  it("keeps the room across an eviction", async () => {
    const [anna] = await setupGame(["Anna"]);
    await evictDurableObject(roomStub());
    expect((await connect(anna!.token)).view.room!.roomId).toBe(anna!.view.room!.roomId);
  });
  it("never sends any token to any client", async () => {
    const clients = await setupGame(["Anna", "Ben", "Clara"]);
    await clients[0]!.request({ type: "startGame" });
    for (const c of clients) for (const o of clients) for (const msg of c.raw) expect(msg).not.toContain(o.token);
  });
  it("closes the room for everyone and deletes storage", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    anna!.send({ type: "closeRoom" });
    expect(await b!.next("roomClosed")).toEqual({ type: "roomClosed", reason: "hostClosed" });
    expect(await runInDurableObject(roomStub(), (_i, state) => state.storage.get("room"))).toBeUndefined();
  });
  it("tells a removed player and blocks their token", async () => {
    const [anna, b] = await setupGame(["Anna", "Ben"]);
    anna!.send({ type: "removePlayer", playerId: b!.view.me!.id });
    expect(await b!.next("removed")).toEqual({ type: "removed" });
    expect(await b!.request({ type: "joinRoom", roomId: anna!.view.room!.roomId, playerName: "Ben" }))
      .toMatchObject({ code: "blocked" });
  });
  it("answers malformed messages with badMessage", async () => {
    expect(await (await connect()).request("not json")).toMatchObject({ type: "error", code: "badMessage" });
  });
});
