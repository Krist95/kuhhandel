import type { TradeReveal } from "../../../src/protocol";
import type { MoneyValue } from "../../../src/rules/types";
import { revealText } from "../model/reveals";
import { MoneyNote } from "./MoneyNote";

function Offer(props: { name: string; values: MoneyValue[] }) {
  return (
    <div class="row notes">
      <span>{props.name}:</span>
      {props.values.length > 0 ? props.values.map((v, i) => <MoneyNote key={i} value={v} size="chip" />) : <span>nothing</span>}
    </div>
  );
}

export function TradeRevealModal(props: { reveal: TradeReveal; meId: string; names: Record<string, string>; onOk: () => void }) {
  const { reveal: r, names } = props;
  const nm = (id: string): string => names[id] ?? "?";
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <h2>Cow trade</h2>
        <Offer name={nm(r.challengerId)} values={r.challengerValues} />
        <Offer name={nm(r.defenderId)} values={r.defenderValues} />
        <p>{revealText(r, props.meId, names)}</p>
        <button onClick={props.onOk}>OK</button>
      </div>
    </div>
  );
}
