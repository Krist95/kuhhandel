import type { PublicPlayer } from "../../../src/protocol";
import { herdChips } from "../model/money";
import { AnimalCard } from "./AnimalCard";

export function CollectionModal(props: { player: PublicPlayer; onClose: () => void }) {
  const chips = herdChips(props.player.herd);
  return (
    <div class="dialog-backdrop" onClick={props.onClose}>
      <div class="dialog collection" onClick={(e) => e.stopPropagation()}>
        <div class="name">{props.player.name}</div>
        {chips.length === 0 ? <p class="hint">No animals yet</p> : (
          <div class="cards">
            {chips.map((c) => (
              <div key={c.animal} class="group">
                <AnimalCard animal={c.animal} count={c.count} size="card" complete={c.complete} />
                {c.complete && <span class="badge">Complete</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
