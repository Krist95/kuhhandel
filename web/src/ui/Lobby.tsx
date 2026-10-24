import { useEffect, useState } from "preact/hooks";
import type { RoomView } from "../../../src/protocol";
import { DECISION_SECONDS } from "../../../src/rules/types";
import { lobbySeats, shareText } from "../model/lobby";
import { sendOrToast } from "../net/socket";
import { homeScreen, toast, view } from "../state";
import { ConfirmDialog } from "./ConfirmDialog";
import { QrCode } from "./QrCode";

async function share(room: RoomView, setManual: (t: string) => void): Promise<void> {
  const url = `${location.origin}/join/${room.roomId}`;
  const text = shareText(room.roomId, url);
  try {
    if (typeof navigator.share === "function") { await navigator.share({ text }); return; }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.value = "Copied";
  } catch {
    setManual(text);
  }
}

export function Lobby(props: { room: RoomView }) {
  const { room } = props;
  const me = view.value?.me?.id ?? null;
  const isHost = me !== null && me === room.hostId;
  const seats = lobbySeats(room.players);
  const [confirmClose, setConfirmClose] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const canStart = room.players.length >= 3 && room.players.length <= 5;

  useEffect(() => {
    if (toast.value !== "Copied") return;
    const t = setTimeout(() => { if (toast.value === "Copied") toast.value = null; }, 2500);
    return () => clearTimeout(t);
  }, [toast.value]);

  return (
    <div class="lobby">
      <div class="lobby-table">
        <h2>{room.roomName}</h2>
        <div class="oval">
          {seats.map((p, i) => (
            <div class={`seat seat${i + 1}${p ? "" : " empty"}`}>
              {p ? <>
                <span class={`dot${p.connected ? " on" : ""}`} title={p.connected ? "Online" : "Offline"} />
                {p.name}{p.id === room.hostId ? " (host)" : ""}
              </> : `Seat ${i + 1}`}
            </div>
          ))}
        </div>
      </div>
      <div class="lobby-side">
        {isHost && (
          <div class="row">
            <label>Cow trade money
              <select value={room.settings.moneyRule}
                onChange={(e) => sendOrToast({ type: "updateSettings", moneyRule: e.currentTarget.value as "swap" | "loserTakesBoth" })}>
                <option value="swap">Swap</option>
                <option value="loserTakesBoth">Loser takes both</option>
              </select>
            </label>
            <label>Time per decision
              <select value={room.settings.decisionSeconds}
                onChange={(e) => sendOrToast({ type: "updateSettings", decisionSeconds: Number(e.currentTarget.value) as typeof DECISION_SECONDS[number] })}>
                {DECISION_SECONDS.map((s) => <option value={s}>{s} s</option>)}
              </select>
            </label>
          </div>
        )}
        {isHost && (
          <div class="idbox">
            <div>Room ID <b>{room.roomId}</b></div>
            <button onClick={() => void share(room, setManual)}>Share</button>
            <QrCode url={`${location.origin}/join/${room.roomId}`} />
            {manual !== null && <textarea readOnly rows={3} value={manual} onFocus={(e) => e.currentTarget.select()} />}
          </div>
        )}
        <ul class="players">
          {room.players.map((p) => (
            <li>
              <span>{p.name}{p.id === room.hostId ? " (host)" : ""}</span>
              {isHost && p.id !== me && <button class="danger small" onClick={() => sendOrToast({ type: "removePlayer", playerId: p.id })}>Remove</button>}
            </li>
          ))}
        </ul>
        {toast.value && <p class="error" onClick={() => { toast.value = null; }}>{toast.value}</p>}
        <div class="row">
          <button class="secondary" onClick={() => { homeScreen.value = "home"; sendOrToast({ type: "leaveSeat" }); }}>Leave seat</button>
          {isHost && <button disabled={!canStart} onClick={() => sendOrToast({ type: "startGame" })}>Start game</button>}
          {isHost && <button class="danger" onClick={() => setConfirmClose(true)}>Close room</button>}
        </div>
        {isHost && !canStart && <p class="hint">Waiting for 3–5 players</p>}
      </div>
      {confirmClose && (
        <ConfirmDialog message="Close the room for everyone?" confirmLabel="Close room"
          onConfirm={() => { setConfirmClose(false); sendOrToast({ type: "closeRoom" }); }} onCancel={() => setConfirmClose(false)} />
      )}
    </div>
  );
}
