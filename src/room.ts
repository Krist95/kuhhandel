import { DurableObject } from "cloudflare:workers";
import { hashPassword, verifyPassword } from "./password";
import { parseClientMessage, type ClientMessage, type ServerMessage } from "./protocol";
import { reduce } from "./rules/engine";
import { ERROR_TEXT, type ErrorCode } from "./rules/errors";
import { nextDeadline } from "./rules/timers";
import type { Action, Room } from "./rules/types";
import { buildView } from "./rules/view";

interface Attachment { token: string | null; fails: number[] }  // fails = timestamps of bad-credential joins

const TOKEN_PATTERN = /^[0-9a-f-]{36}$/i;
const FAIL_WINDOW_MS = 60_000, MAX_FAILS = 5, MAX_PASSWORD = 64;

export function cryptoRng(): () => number {
  return () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

const attachmentOf = (ws: WebSocket) => ws.deserializeAttachment() as Attachment;

function send(ws: WebSocket, msg: ServerMessage): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // The socket is already closing; webSocketClose handles it.
  }
}

const sendError = (ws: WebSocket, code: ErrorCode) => send(ws, { type: "error", code, message: ERROR_TEXT[code] });

export class GameRoom extends DurableObject<Env> {
  private room: Room | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keepalive pings are answered by the runtime and never wake the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    void ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<Room>("room")) ?? null;
      await this.reconcile(Date.now());
    });
  }

  /**
   * After a restart (deploy, runtime update) the old sockets are gone and no webSocketClose arrives for them,
   * so a seat still marked connected without a live socket is disconnected here. After a hibernation wake every
   * connected seat still has its socket, so this changes and writes nothing.
   */
  private async reconcile(now: number): Promise<void> {
    const live = new Set(this.ctx.getWebSockets().map((ws) => attachmentOf(ws).token));
    const stale = (this.room?.players ?? []).filter((p) => p.connected && !live.has(p.token)).map((p) => p.token);
    for (const token of stale) await this.dispatch({ type: "disconnect", token }, now, null);
  }

  async fetch(_request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ token: null, fails: [] } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const msg = typeof message === "string" ? parseClientMessage(message) : null;
    if (!msg) return sendError(ws, "badMessage");
    const now = Date.now();
    const { token } = attachmentOf(ws);
    if (msg.type === "hello") return this.hello(ws, msg.clientToken, now);
    if (token === null) return sendError(ws, "badMessage");
    switch (msg.type) {
      case "createRoom": return this.createRoom(ws, token, msg, now);
      case "joinRoom": return this.joinRoom(ws, token, msg, now);
      default: return this.dispatch({ type: "intent", token, intent: msg }, now, ws);
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    // No ws.close() here: at this compatibility date the runtime answers the close frame itself.
    const { token } = attachmentOf(ws);
    if (token === null) return;
    if (this.ctx.getWebSockets().some((other) => other !== ws && attachmentOf(other).token === token)) return;
    await this.dispatch({ type: "disconnect", token }, Date.now(), ws);
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    // An error ends the connection like a close; a later webSocketClose for it is then a no-op disconnect.
    await this.webSocketClose(ws, 1011, "", false);
  }

  private async hello(ws: WebSocket, token: string, now: number): Promise<void> {
    const att = attachmentOf(ws);
    // A socket keeps the identity it was bound to; switching would leave the old seat looking connected.
    if (!TOKEN_PATTERN.test(token) || (att.token !== null && att.token !== token)) return sendError(ws, "badMessage");
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      const o = attachmentOf(other);
      if (o.token !== token) continue;
      other.serializeAttachment({ ...o, token: null } satisfies Attachment);
      try {
        other.close(4001, "Replaced by a newer connection");
      } catch {
        // Already closed.
      }
    }
    ws.serializeAttachment({ ...att, token } satisfies Attachment);
    await this.dispatch({ type: "connect", token }, now, ws);
  }

  private async createRoom(ws: WebSocket, token: string, msg: Extract<ClientMessage, { type: "createRoom" }>, now: number): Promise<void> {
    const length = [...msg.password].length;
    if (length < 1 || length > MAX_PASSWORD) return sendError(ws, "badPassword");
    if (this.room) return sendError(ws, "roomInUse");
    const { hash, salt } = await hashPassword(msg.password);
    await this.dispatch({ type: "create", token, roomName: msg.roomName, playerName: msg.playerName, seat: msg.seat,
      passwordHash: hash, passwordSalt: salt }, now, ws);
  }

  private async joinRoom(ws: WebSocket, token: string, msg: Extract<ClientMessage, { type: "joinRoom" }>, now: number): Promise<void> {
    const att = attachmentOf(ws);
    att.fails = att.fails.filter((t) => now - t < FAIL_WINDOW_MS);
    if (att.fails.length >= MAX_FAILS) {
      ws.serializeAttachment(att);
      return sendError(ws, "tooManyAttempts");
    }
    // Count the attempt before the slow hash, so joins sent back to back can't all pass the check above.
    // A correct password refunds it below.
    att.fails.push(now);
    ws.serializeAttachment(att);
    const room = this.room;
    const ok = room !== null && msg.roomId.trim().toUpperCase() === room.roomId
      && await verifyPassword(msg.password, room.passwordHash, room.passwordSalt);
    if (!ok) return sendError(ws, "badCredentials");
    const after = attachmentOf(ws); // re-read: other messages on this socket may have changed it during the await
    const i = after.fails.indexOf(now);
    if (i >= 0) after.fails.splice(i, 1);
    ws.serializeAttachment(after);
    if (this.room?.passwordHash !== room.passwordHash) return sendError(ws, "badCredentials");
    await this.dispatch({ type: "join", token, playerName: msg.playerName, seat: msg.seat }, now, ws);
  }

  async alarm(): Promise<void> {
    await this.runTimers(Date.now());
  }

  /** Applies every timer that is due at `now`. Also the test seam. */
  async runTimers(now: number): Promise<void> {
    await this.dispatch({ type: "tick" }, now, null);
  }

  /** The only place state changes: reduce, persist, schedule the alarm, then tell every socket. */
  private async dispatch(action: Action, now: number, origin: WebSocket | null): Promise<void> {
    const out = reduce(this.room, action, { now, rng: cryptoRng() });
    if (!out.ok) return origin ? sendError(origin, out.error.code) : undefined;
    const state = out.state;
    this.room = state;
    if (state) await this.ctx.storage.put("room", state);
    else await this.ctx.storage.deleteAll();
    // A deadline already in the past is passed as-is: the runtime runs a past-due alarm promptly.
    const at = nextDeadline(state);
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
    const sockets = this.ctx.getWebSockets();
    for (const e of out.events) {
      if (e.kind === "removed") {
        for (const ws of sockets) if (attachmentOf(ws).token === e.token) send(ws, { type: "removed" });
      } else {
        for (const ws of sockets) send(ws, { type: "roomClosed", reason: e.reason });
      }
    }
    for (const ws of sockets) send(ws, { type: "view", view: buildView(state, attachmentOf(ws).token, now) });
  }
}
