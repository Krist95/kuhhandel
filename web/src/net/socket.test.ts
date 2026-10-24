import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// A static import with no browser globals stubbed: socket.ts must not touch window/location/document/WebSocket on import.
import { backoffMs } from "./socket";

it("backs off exponentially up to 10 s", () => expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]));

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static all: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  closeCalls = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) { FakeSocket.all.push(this); }
  send(data: string): void {
    if (this.readyState === FakeSocket.CONNECTING) throw new Error("InvalidStateError");
    this.sent.push(data);
  }
  close(): void { this.closeCalls++; this.readyState = FakeSocket.CLOSING; } // a half-open socket never finishes closing
  // What the server or the network does:
  serverOpen(): void { this.readyState = FakeSocket.OPEN; this.onopen?.(); }
  serverSend(data: string): void { this.onmessage?.({ data }); }
  serverClose(code: number): void { this.readyState = FakeSocket.CLOSED; this.onclose?.({ code }); }
}
const last = () => FakeSocket.all.at(-1)!;
const emptyView = { serverTime: 5, me: null, room: null };

// A fresh copy of socket.ts and state.ts per test, since both keep module state.
async function load() {
  vi.resetModules();
  const socket = await import("./socket");
  const state = await import("../state");
  return { ...socket, ...state };
}
async function online() {
  const s = await load();
  s.startConnection("main");
  const sock = last();
  sock.serverOpen();
  return { s, sock };
}

describe("connection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.all = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("location", { protocol: "https:", host: "kuhhandel.test" });
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("closes a socket that stays silent for 10 s after a ping, then reconnects with backoff", async () => {
    const { s, sock } = await online();
    expect(sock.url).toBe("wss://kuhhandel.test/ws?room=main");
    expect(JSON.parse(sock.sent[0]!)).toMatchObject({ type: "hello" });
    expect(s.conn.value).toBe("online");
    vi.advanceTimersByTime(25_000);
    expect(sock.sent.at(-1)).toBe("ping");
    vi.advanceTimersByTime(9_999);
    expect(sock.closeCalls).toBe(0);
    vi.advanceTimersByTime(1);
    expect([sock.closeCalls, s.conn.value, FakeSocket.all.length]).toEqual([1, "offline", 1]);
    vi.advanceTimersByTime(backoffMs(0));
    expect([FakeSocket.all.length, s.conn.value]).toEqual([2, "connecting"]);
  });

  it("takes a pong, or any other frame, as proof of life, and never handles a pong as a message", async () => {
    const { s, sock } = await online();
    vi.advanceTimersByTime(25_000);
    sock.serverSend("pong");
    expect([s.view.value, s.toast.value, s.notice.value]).toEqual([null, null, null]);
    vi.advanceTimersByTime(20_000); // well past the watchdog
    expect(sock.closeCalls).toBe(0);
    vi.advanceTimersByTime(5_000); // the next ping, answered by a view this time
    expect(sock.sent.filter((m) => m === "ping")).toHaveLength(2);
    sock.serverSend(JSON.stringify({ type: "view", view: emptyView }));
    vi.advanceTimersByTime(10_000);
    expect([sock.closeCalls, s.view.value]).toEqual([0, emptyView]);
  });

  it("keeps one watchdog per silence and clears it on every frame", async () => {
    const { sock } = await online();
    const base = vi.getTimerCount(); // the ping interval
    document.dispatchEvent(new Event("visibilitychange"));
    expect(sock.sent.at(-1)).toBe("ping"); // an open socket is checked at once on return
    expect(vi.getTimerCount()).toBe(base + 1);
    vi.advanceTimersByTime(5_000);
    window.dispatchEvent(new Event("online"));
    expect(vi.getTimerCount()).toBe(base + 1); // the second ping keeps the first deadline
    sock.serverSend("pong");
    expect(vi.getTimerCount()).toBe(base);
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(10_000);
    expect(sock.closeCalls).toBe(1);
  });

  it("reopens at once when the page returns while offline, instead of waiting out the backoff", async () => {
    const { s, sock } = await online();
    sock.serverClose(1006);
    expect(s.conn.value).toBe("offline");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(FakeSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.all).toHaveLength(2); // the pending retry was cancelled
  });

  it("shows the replaced screen on close code 4001 and never reconnects by itself", async () => {
    const { s, sock } = await online();
    sock.serverClose(4001);
    expect(s.conn.value).toBe("replaced");
    vi.advanceTimersByTime(60_000);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    expect([FakeSocket.all.length, vi.getTimerCount()]).toEqual([1, 0]);
  });

  it("send() says whether the message went out; sendOrToast tells the player when it did not", async () => {
    const s = await load();
    expect(s.send({ type: "pass" })).toBe(false); // no socket yet
    s.startConnection("main");
    const sock = last();
    expect(s.send({ type: "pass" })).toBe(false); // still connecting
    sock.serverOpen();
    expect(s.send({ type: "pass" })).toBe(true);
    expect(sock.sent.at(-1)).toBe(JSON.stringify({ type: "pass" }));
    sock.serverClose(1006);
    expect(s.toast.value).toBeNull();
    expect(s.sendOrToast({ type: "pass" })).toBe(false);
    expect(s.toast.value).toBe("Not connected — reconnecting…");
  });
});
