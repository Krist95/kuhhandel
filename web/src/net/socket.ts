import type { ClientMessage, ServerMessage } from "../../../src/protocol";
import { conn, onServerMessage } from "../state";
import { loadToken } from "./token";

export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt), 10000);
}

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let replaced = false;
let listening = false;
let token: string | null = null;

function clearTimers(): void {
  clearInterval(pingTimer); pingTimer = undefined;
  clearTimeout(retryTimer); retryTimer = undefined;
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

function reconnectNow(): void {
  if (replaced) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  open();
}

function scheduleRetry(): void {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(open, backoffMs(attempt++));
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
    pingTimer = setInterval(() => { if (sock.readyState === WebSocket.OPEN) sock.send("ping"); }, 25_000);
  };
  sock.onmessage = (ev) => {
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
    conn.value = "offline";
    scheduleRetry();
  };
}

export function startConnection(): void {
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reconnectNow();
    });
    window.addEventListener("online", reconnectNow);
  }
  attempt = 0;
  open();
}

export function send(msg: ClientMessage): void {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  } catch { /* dropped; reconnect re-sends hello */ }
}
