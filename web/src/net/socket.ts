import type { ClientMessage, ServerMessage } from "../../../src/protocol";
import { conn, onServerMessage, toast } from "../state";
import { loadToken } from "./token";

export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt), 10000);
}

const PING_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000; // a socket silent this long after a ping is treated as dead (e.g. half-open after a network switch)
export const NOT_CONNECTED = "Not connected — reconnecting…";

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let watchdog: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let replaced = false;
let listening = false;
let token: string | null = null;

function clearWatchdog(): void {
  clearTimeout(watchdog); watchdog = undefined;
}

function clearTimers(): void {
  clearInterval(pingTimer); pingTimer = undefined;
  clearTimeout(retryTimer); retryTimer = undefined;
  clearWatchdog();
}

function dropSocket(): void {
  clearTimers();
  if (ws) {
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch { /* already closed */ }
    ws = null;
  }
}

function getToken(): string {
  if (token === null) {
    let store: Storage | null = null;
    try { store = localStorage; } catch { /* blocked */ }
    token = loadToken(store);
  }
  return token;
}

function scheduleRetry(): void {
  conn.value = "offline";
  clearTimeout(retryTimer);
  retryTimer = setTimeout(open, backoffMs(attempt++));
}

/** Pings, and closes the socket if nothing at all comes back in time. One watchdog at a time keeps the earliest deadline. */
function ping(sock: WebSocket): void {
  try { sock.send("ping"); } catch { /* closing; onclose handles it */ }
  watchdog ??= setTimeout(() => {
    watchdog = undefined;
    if (ws !== sock) return;
    dropSocket(); // a half-open socket may never fire close, so don't wait for it
    scheduleRetry();
  }, PONG_TIMEOUT_MS);
}

/** The page is back or the network returned: check an open socket, reopen a closed one now. */
function wake(): void {
  if (replaced) return;
  if (ws && ws.readyState === WebSocket.OPEN) return ping(ws);
  if (ws && ws.readyState === WebSocket.CONNECTING) return;
  open();
}

function open(): void {
  dropSocket();
  replaced = false;
  conn.value = "connecting";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const sock = new WebSocket(`${proto}//${location.host}/ws`);
  ws = sock;
  sock.onopen = () => {
    attempt = 0;
    conn.value = "online";
    sock.send(JSON.stringify({ type: "hello", clientToken: getToken() } satisfies ClientMessage));
    clearInterval(pingTimer);
    pingTimer = setInterval(() => { if (sock.readyState === WebSocket.OPEN) ping(sock); }, PING_MS);
  };
  sock.onmessage = (ev) => {
    clearWatchdog(); // any frame proves the socket is alive
    if (typeof ev.data !== "string" || ev.data === "pong") return;
    let msg: ServerMessage;
    try { msg = JSON.parse(ev.data) as ServerMessage; } catch { return; }
    onServerMessage(msg, Date.now());
  };
  sock.onclose = (ev) => {
    if (ws !== sock) return;
    clearTimers();
    ws = null;
    if (ev.code === 4001) {
      replaced = true;
      conn.value = "replaced";
      return;
    }
    scheduleRetry();
  };
}

export function startConnection(): void {
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") wake();
    });
    window.addEventListener("online", wake);
  }
  attempt = 0;
  open();
}

/** Never throws. Returns true if the message was handed to an open socket. */
export function send(msg: ClientMessage): boolean {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
  } catch { /* dropped; reconnect re-sends hello */ }
  return false;
}

/** For player intents: a tap that could not be sent says so instead of vanishing. */
export function sendOrToast(msg: ClientMessage): boolean {
  const sent = send(msg);
  if (!sent) toast.value = NOT_CONNECTED;
  return sent;
}
