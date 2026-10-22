import type { RoomView } from "../../../src/protocol";
import { seatPositions, type Pos } from "../model/layout";
import { view } from "../state";
import { Center } from "./Center";
import { MyArea } from "./MyArea";
import { OpponentPanel } from "./OpponentPanel";

export function Table(props: { room: RoomView }) {
  const { room } = props;
  const game = room.game;
  const meId = view.value?.me?.id ?? "";
  if (game === null) return null;
  const places = seatPositions(room.players, meId);
  const me = room.players.find((p) => p.id === meId);
  const at = (pos: Pos) => {
    const id = places.find((x) => x.pos === pos)?.id;
    const p = room.players.find((q) => q.id === id);
    return p ? <OpponentPanel player={p} isHost={p.id === room.hostId} isTurn={p.id === game.activePlayerId} /> : null;
  };
  return (
    <div class={`table${room.status === "PAUSED" ? " paused-table" : ""}`}>
      <div class="corner">
        <button class="small secondary" aria-label="Info">i</button>
        <button class="small secondary" aria-label="Log">Log</button>
        {meId === room.hostId && <button class="small secondary" aria-label="Host menu">Host</button>}
      </div>
      <div class="cell c1 r1">{at("topLeft")}</div>
      <div class="cell c2 r1">{at("top")}</div>
      <div class="cell c3 r1">{at("topRight")}</div>
      <div class="cell c1 r2">{at("left")}</div>
      <div class="cell c2 r2"><Center room={room} game={game} /></div>
      <div class="cell c3 r2">{at("right")}</div>
      <div class="cell my r3">{me && <MyArea player={me} />}</div>
      <div class="action-cell cell c3 r3" />
    </div>
  );
}
