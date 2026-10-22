import { useEffect, useState } from "preact/hooks";
import type { RoomView } from "../../../src/protocol";
import { secondsLeft } from "../model/clock";
import { scoreLine } from "../model/reveals";
import { send } from "../net/socket";
import { offset, view } from "../state";
import { ConfirmDialog } from "./ConfirmDialog";

export function EndScreen(props: { room: RoomView }) {
  const { room } = props;
  const [, tick] = useState(0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const isHost = view.value?.me?.id === room.hostId;
  const s = secondsLeft(room.closeAt, Date.now(), offset.value);
  const winners = (room.scores ?? []).filter((r) => r.winner).length;
  return (
    <div class="center end-screen">
      <h2>Game over</h2>
      <div class="ranking">
        {(room.scores ?? []).map((row) => (
          <div key={row.playerId} class={`rank-row${row.winner ? " winner" : ""}`}>
            <span>{row.rank}. {room.players.find((p) => p.id === row.playerId)?.name ?? "?"}</span>
            {row.winner && <b> {winners > 1 ? "Shared win" : "Winner"}</b>}
            <div>{scoreLine(row)}</div>
          </div>
        ))}
      </div>
      {s !== null && <p class="countdown">Room closes in {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</p>}
      {isHost && (
        <div class="row">
          <button onClick={() => send({ type: "playAgain" })}>Play again</button>
          <button class="danger" onClick={() => setConfirm(true)}>Close room</button>
        </div>
      )}
      {confirm && (
        <ConfirmDialog message="Close the room for everyone?" confirmLabel="Close room"
          onConfirm={() => send({ type: "closeRoom" })} onCancel={() => setConfirm(false)} />
      )}
    </div>
  );
}
