import { useEffect, useState } from "preact/hooks";
import type { RoomView } from "../../../src/protocol";
import { secondsLeft } from "../model/clock";
import { loadSeen, markSeen, revealToShow, scoreLine } from "../model/reveals";
import { sendOrToast } from "../net/socket";
import { offset, view } from "../state";
import { ConfirmDialog } from "./ConfirmDialog";
import { seenStore, TradeRevealModal } from "./TradeRevealModal";

export function EndScreen(props: { room: RoomView }) {
  const { room } = props;
  const [, tick] = useState(0);
  const [confirm, setConfirm] = useState(false);
  // The trade that completes the last set ends the game, so its reveal is shown here.
  const [seen, setSeen] = useState<Set<number>>(() => loadSeen(seenStore(), room.roomId));
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const meId = view.value?.me?.id ?? "";
  const isHost = meId === room.hostId;
  const s = secondsLeft(room.closeAt, Date.now(), offset.value);
  const winners = (room.scores ?? []).filter((r) => r.winner).length;
  const names: Record<string, string> = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
  const reveal = revealToShow(view.value?.me?.tradeReveal ?? null, seen);
  return (
    <div class="center end-screen">
      <h2>Game over</h2>
      <div class="ranking">
        {(room.scores ?? []).map((row) => (
          <div key={row.playerId} class={`rank-row${row.winner ? " winner" : ""}`}>
            <span>{row.rank}. {names[row.playerId] ?? "?"}</span>
            {row.winner && <b> {winners > 1 ? "Shared win" : "Winner"}</b>}
            <div>{scoreLine(row)}</div>
          </div>
        ))}
      </div>
      {s !== null && <p class="countdown">Room closes in {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</p>}
      {isHost && (
        <div class="row">
          <button onClick={() => sendOrToast({ type: "playAgain" })}>Play again</button>
          <button class="danger" onClick={() => setConfirm(true)}>Close room</button>
        </div>
      )}
      {confirm && (
        <ConfirmDialog message="Close the room for everyone?" confirmLabel="Close room"
          onConfirm={() => sendOrToast({ type: "closeRoom" })} onCancel={() => setConfirm(false)} />
      )}
      {reveal && (
        <TradeRevealModal reveal={reveal} meId={meId} names={names} onOk={() => setSeen(markSeen(seenStore(), room.roomId, reveal.id))} />
      )}
    </div>
  );
}
