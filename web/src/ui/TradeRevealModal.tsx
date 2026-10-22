import type { TradeReveal } from "../../../src/protocol";
import { revealText } from "../model/reveals";

export function TradeRevealModal(props: { reveal: TradeReveal; meId: string; names: Record<string, string>; onOk: () => void }) {
  const { reveal: r, names } = props;
  const nm = (id: string): string => names[id] ?? "?";
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <h2>Cow trade</h2>
        <div>{nm(r.challengerId)}: {r.challengerValues.join(", ") || "nothing"}</div>
        <div>{nm(r.defenderId)}: {r.defenderValues.join(", ") || "nothing"}</div>
        <p>{revealText(r, props.meId, names)}</p>
        <button onClick={props.onOk}>OK</button>
      </div>
    </div>
  );
}
