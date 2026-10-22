import type { GameView, RoomView } from "../../../src/protocol";
import { Countdown } from "./Countdown";
import { MoneyNote } from "./MoneyNote";

export function BluffOverlay(props: { room: RoomView; game: GameView }) {
  const ph = props.game.phase;
  if (ph.kind !== "bluff") return null;
  const name = props.room.players.find((p) => p.id === ph.blufferId)?.name ?? "?";
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <h2>Bluff! {name} bid {ph.bid}</h2>
        <div class="row notes">{ph.cards.map((v, i) => <MoneyNote key={i} value={v} size="chip" />)}</div>
        <Countdown deadline={props.game.deadline} label={null} />
      </div>
    </div>
  );
}
