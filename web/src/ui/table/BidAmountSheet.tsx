import { useState } from "preact/hooks";
import { canSubmitBid } from "../../model/controls";

/** Numeric entry for the bid amount, opened by long-pressing the stepper's amount. */
export function BidAmountSheet(props: { amount: number; minBid: number; onSet: (amount: number) => void; onCancel: () => void }) {
  const { minBid, onSet, onCancel } = props;
  const [text, setText] = useState(String(props.amount));
  const value = text.trim() === "" ? NaN : Number(text);
  const ok = canSubmitBid(value, minBid);
  return (
    <div class="overlay picker" role="dialog" aria-modal="true" aria-label="Bid amount">
      <div class="sheet">
        <input type="number" inputMode="numeric" step={10} min={minBid} value={text} aria-label="Bid amount" autoFocus
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === "Enter" && ok) onSet(value); }} />
        <div class="kh-two">
          <button class="kh-btn secondary" onClick={onCancel}>Cancel</button>
          <button class="kh-btn" disabled={!ok} onClick={() => onSet(value)}>Set</button>
        </div>
      </div>
    </div>
  );
}
