import { Fragment } from "preact";
import { useEffect } from "preact/hooks";
import type { RoomView } from "../../../../src/protocol";
import { ANIMALS, ANIMAL_VALUE, type Animal } from "../../../../src/rules/types";
import { waitingOnPublic } from "../../model/controls";
import { boardRows, deckLeft } from "../../model/herds";
import { AnimalTile } from "./Animals";
import { CountdownRing } from "./CountdownRing";

const cvar = (animal: Animal) => ({ "--c": `var(--animal-${animal})` }) as any;

function Cell(props: { animal: Animal; n: number; trade: boolean }) {
  const { animal, n, trade } = props;
  if (n === 0) return <span class="cell zero">·</span>;
  return (
    <span class={`cell${n === 4 ? " set" : ""}${trade ? " trade" : ""}`} style={cvar(animal)}>
      <b>{n === 4 ? "Set" : n}</b>
      <span class="pips">{[0, 1, 2, 3].map((i) => <i key={i} class={i < n ? "on" : ""} />)}</span>
    </span>
  );
}

export function HerdBoard(props: { room: RoomView; meId: string; focusId: string | null; onClose: () => void }) {
  const { room, meId, focusId } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);
  const game = room.game;
  const rows = boardRows(room.players, meId);
  const left = deckLeft(room.players);
  const deckTotal = ANIMALS.reduce((n, a) => n + left[a], 0);
  const waiting = game && waitingOnPublic(game.phase) === meId;
  return (
    <div class="kh-board" role="dialog" aria-label="Herds">
      <div class="bhead">
        {waiting && game && (
          <CountdownRing deadline={game.deadline} decisionSeconds={room.settings.decisionSeconds} paused={room.status === "PAUSED"} />
        )}
        <span class="h">Herds</span>
        <span class="kh-hint">Dashed gold = you can cow-trade it. Sets are locked.</span>
        <button class="kh-btn secondary close" onClick={props.onClose}>Close</button>
      </div>
      <div class="grid">
        <span class="corner" />
        {ANIMALS.map((a) => (
          <span key={a} class="colh"><AnimalTile animal={a} /><span>{ANIMAL_VALUE[a]}</span></span>
        ))}
        {rows.map((r) => (
          <Fragment key={r.player.id}>
            <span class={`rowh${r.me ? " me" : ""}${r.player.id === focusId ? " focus" : ""}`}>
              <b>{r.me ? "You" : r.player.name}</b>
              <span>{r.sets ? `${r.sets} set${r.sets > 1 ? "s" : ""} · ` : ""}{r.player.moneyCount} cards</span>
            </span>
            {ANIMALS.map((a) => <Cell key={`${r.player.id}-${a}`} animal={a} n={r.player.herd[a]} trade={r.tradeable.includes(a)} />)}
          </Fragment>
        ))}
        <span class="rowh deck"><b>In deck</b><span>{deckTotal} cards</span></span>
        {ANIMALS.map((a) => <span key={a} class="cell left">{left[a] || "—"}</span>)}
      </div>
    </div>
  );
}
