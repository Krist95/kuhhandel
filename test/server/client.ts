import { env, exports } from "cloudflare:workers";
import type { ClientMessage, ServerMessage, View } from "../../src/protocol";

export interface TestClient {
  token: string; raw: string[]; view: View;          // raw = every message received; view = latest view
  send(msg: ClientMessage | string): void;
  request(msg: ClientMessage | string): Promise<ServerMessage>; // drop queued messages, send, resolve with the next "view" or "error"
  waitView(pred: (v: View) => boolean): Promise<View>;        // latest view if it matches, else the next matching one; rejects after 2 s
  next<T extends ServerMessage["type"]>(type: T): Promise<Extract<ServerMessage, { type: T }>>; // next queued message of that type
  closed: Promise<number>; close(): void;            // closed resolves with the close code
}

const WAIT_MS = 2000;

export async function connect(token = crypto.randomUUID(), room = "main"): Promise<TestClient> {
  const res = await exports.default.fetch(`https://kuhhandel.test/ws?room=${room}`, { headers: { Upgrade: "websocket" } });
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a WebSocket upgrade, got HTTP ${res.status}`);
  ws.accept();

  let queue: ServerMessage[] = [];  // received but not yet consumed by next() or request()
  let views = 0, pongs = 0;
  const waiters = new Set<() => void>(); // re-run after every received message
  let onClose!: (code: number) => void;

  // Resolves once check() returns something, checking now and after every message; rejects after WAIT_MS.
  const waitFor = <T>(what: string, check: () => T | undefined): Promise<T> => {
    const hit = check();
    if (hit !== undefined) return Promise.resolve(hit);
    return new Promise<T>((resolve, reject) => {
      const poll = () => {
        const v = check();
        if (v === undefined) return;
        clearTimeout(timer);
        waiters.delete(poll);
        resolve(v);
      };
      const timer = setTimeout(() => { waiters.delete(poll); reject(new Error(`timed out waiting for ${what}`)); }, WAIT_MS);
      waiters.add(poll);
    });
  };
  const take = (match: (m: ServerMessage) => boolean): ServerMessage | undefined => {
    const i = queue.findIndex(match);
    return i < 0 ? undefined : queue.splice(0, i + 1)[i];
  };
  // The server answers "ping" with "pong" in order, so after the pong every earlier message has arrived.
  const settle = (): Promise<true> => {
    const start = pongs;
    ws.send("ping");
    return waitFor("pong", () => (pongs > start ? true : undefined));
  };

  const client: TestClient = {
    token, raw: [], view: { serverTime: 0, me: null, room: null },
    send: (msg) => ws.send(typeof msg === "string" ? msg : JSON.stringify(msg)),
    async request(msg) {
      await settle();
      queue = [];
      client.send(msg);
      return waitFor("a view or error", () => take((m) => m.type === "view" || m.type === "error"));
    },
    waitView(pred) {
      if (pred(client.view)) return Promise.resolve(client.view);
      const start = views;
      return waitFor("a matching view", () => (views > start && pred(client.view) ? client.view : undefined));
    },
    next<T extends ServerMessage["type"]>(type: T) {
      return waitFor(`a "${type}" message`, () => take((m) => m.type === type)) as Promise<Extract<ServerMessage, { type: T }>>;
    },
    closed: new Promise<number>((resolve) => { onClose = resolve; }),
    close: () => ws.close(1000, "Bye"),
  };

  ws.addEventListener("message", (e) => {
    const data = typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data);
    client.raw.push(data);
    if (data === "pong") {
      pongs++;
    } else {
      const msg = JSON.parse(data) as ServerMessage;
      if (msg.type === "view") { client.view = msg.view; views++; }
      queue.push(msg);
    }
    for (const poll of [...waiters]) poll();
  });
  ws.addEventListener("close", (e) => onClose(e.code));

  client.send({ type: "hello", clientToken: token });
  await client.next("view");
  return client;
}

export const roomStub = (room = "main") => env.GAME_ROOM.get(env.GAME_ROOM.idFromName(room));

export async function setupGame(names: string[], room = "main"): Promise<TestClient[]> {
  const host = await connect(crypto.randomUUID(), room);
  const created = await host.request({ type: "createRoom", roomName: "Barn", playerName: names[0]!, moneyRule: "swap", decisionSeconds: 20 });
  if (created.type !== "view") throw new Error(`createRoom failed: ${JSON.stringify(created)}`);
  const clients = [host];
  for (const name of names.slice(1)) {
    const c = await connect(crypto.randomUUID(), room);
    const joined = await c.request({ type: "joinRoom", roomId: host.view.room!.roomId, playerName: name });
    if (joined.type !== "view") throw new Error(`joinRoom failed for ${name}: ${JSON.stringify(joined)}`);
    clients.push(c);
  }
  // Every client has seen every seat before the test starts.
  await Promise.all(clients.map((c) => c.waitView((v) => v.room?.players.length === names.length)));
  return clients;
}
