import { useState } from "preact/hooks";
import type { PublicPlayer } from "../../../src/protocol";
import { herdChips, moneySummary } from "../model/money";
import { view } from "../state";
import { AnimalCard } from "./AnimalCard";
import { MoneyPicker } from "./MoneyPicker";

export function MyArea(props: { player: PublicPlayer }) {
  const [open, setOpen] = useState(false);
  const money = view.value?.me?.money ?? [];
  return (
    <div class="my-area">
      <div class="chips">
        {herdChips(props.player.herd).map((c) => <AnimalCard key={c.animal} animal={c.animal} count={c.count} size="chip" complete={c.complete} />)}
      </div>
      <button class="secondary small money-summary" onClick={() => setOpen(true)}>{moneySummary(money.map((m) => m.value))}</button>
      {open && <MoneyPicker mode="view" onClose={() => setOpen(false)} />}
    </div>
  );
}
