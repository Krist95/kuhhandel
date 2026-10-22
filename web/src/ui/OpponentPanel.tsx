import { useState } from "preact/hooks";
import type { PublicPlayer } from "../../../src/protocol";
import { herdChips } from "../model/money";
import { AnimalCard } from "./AnimalCard";
import { CollectionModal } from "./CollectionModal";

export function OpponentPanel(props: { player: PublicPlayer; isHost: boolean; isTurn: boolean }) {
  const { player: p } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button class="panel" onClick={() => setOpen(true)}>
        <div class="panel-head">
          <span class="name">{p.name}</span>
          {props.isHost && <span class="badge">Host</span>}
          {props.isTurn && <span class="badge turn">Turn</span>}
          {p.away && <span class="badge">Away</span>}
          {p.out && <span class="badge">Out</span>}
          {!p.connected && <span class="badge">Offline</span>}
          <span class="money" aria-label="Money cards"><span class="note" aria-hidden="true">▭</span> {p.moneyCount}</span>
        </div>
        <div class="chips">
          {herdChips(p.herd).map((c) => <AnimalCard key={c.animal} animal={c.animal} count={c.count} size="chip" complete={c.complete} />)}
        </div>
      </button>
      {open && <CollectionModal player={p} onClose={() => setOpen(false)} />}
    </>
  );
}
