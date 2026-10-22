import type { PublicPlayer } from "../../../src/protocol";
import { herdChips, moneySummary } from "../model/money";
import { view } from "../state";
import { AnimalCard } from "./AnimalCard";

export function MyArea(props: { player: PublicPlayer }) {
  const money = view.value?.me?.money ?? [];
  return (
    <div class="my-area">
      <div class="chips">
        {herdChips(props.player.herd).map((c) => <AnimalCard key={c.animal} animal={c.animal} count={c.count} size="chip" complete={c.complete} />)}
      </div>
      <button class="secondary small money-summary" onClick={() => undefined}>{moneySummary(money.map((m) => m.value))}</button>
    </div>
  );
}
