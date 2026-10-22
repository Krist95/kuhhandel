import { useState } from "preact/hooks";
import { ANIMAL_NAME, type Animal, type TradeTerms } from "../../../src/rules/types";
import type { TradeTarget } from "../model/controls";
import { send } from "../net/socket";
import { view } from "../state";
import { MoneyPicker } from "./MoneyPicker";

export function TradeWizard(props: { fixed: TradeTerms | null; targets: TradeTarget[]; onClose: () => void }) {
  const nameOf = (id: string) => view.value?.room?.players.find((p) => p.id === id)?.name ?? "?";
  const [target, setTarget] = useState<TradeTarget | null>(null);
  const [animal, setAnimal] = useState<{ animal: Animal; maxCount: 1 | 2 } | null>(null);
  const [count, setCount] = useState<1 | 2 | null>(null);
  const word = (a: Animal, n: number) => ANIMAL_NAME[a][n === 1 ? 0 : 1];
  const offer = (terms: TradeTerms) => (cardIds: string[]) => {
    send({ type: "cowTradeOffer", targetId: terms.defenderId, animal: terms.animal, count: terms.count, cardIds });
    props.onClose();
  };

  if (props.fixed) {
    const f = props.fixed;
    return <MoneyPicker mode="offer" note={`Repeat round: ${f.count} ${word(f.animal, f.count)} with ${nameOf(f.defenderId)}`} onSubmit={offer(f)} onClose={props.onClose} />;
  }
  if (target && animal && (count !== null || animal.maxCount === 1)) {
    const terms: TradeTerms = { defenderId: target.playerId, animal: animal.animal, count: count ?? 1 };
    return <MoneyPicker mode="offer" note={`${terms.count} ${word(terms.animal, terms.count)} with ${nameOf(terms.defenderId)}`} onSubmit={offer(terms)} onClose={props.onClose} />;
  }
  const back = () => {
    if (animal) { setAnimal(null); setCount(null); } else setTarget(null);
  };
  return (
    <div class="overlay picker" role="dialog" aria-label="Cow trade">
      <div class="sheet">
        {!target && <>
          <div class="hint">Trade with</div>
          <div class="money-cards">
            {props.targets.map((t) => <button key={t.playerId} onClick={() => setTarget(t)}>{nameOf(t.playerId)}</button>)}
          </div>
        </>}
        {target && !animal && <>
          <div class="hint">Which animal</div>
          <div class="money-cards">
            {target.animals.map((a) => <button key={a.animal} onClick={() => setAnimal(a)}>{ANIMAL_NAME[a.animal][0]}</button>)}
          </div>
        </>}
        {target && animal && <>
          <div class="hint">How many</div>
          <div class="money-cards">
            {([1, 2] as const).map((n) => <button key={n} onClick={() => setCount(n)}>{n}</button>)}
          </div>
        </>}
        <div class="sheet-buttons">
          {target && <button class="secondary" onClick={back}>Back</button>}
          <button class="secondary" onClick={props.onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
