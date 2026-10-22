import type { GameView, RoomView } from "../../../src/protocol";
import { Countdown } from "./Countdown";

export function BluffOverlay(props: { room: RoomView; game: GameView }) {
  const ph = props.game.phase;
  if (ph.kind !== "bluff") return null;
  const name = props.room.players.find((p) => p.id === ph.blufferId)?.name ?? "?";
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <h2>Bluff! {name} bid {ph.bid}</h2>
        <div class="row">{ph.cards.map((v, i) => <span key={i} class="money-card">{v}</span>)}</div>
        <Countdown deadline={props.game.deadline} label={null} />
      </div>
    </div>
  );
}
