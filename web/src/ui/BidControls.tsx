import { useState } from "preact/hooks";
import { bidStep, canSubmitBid } from "../model/controls";
import { send } from "../net/socket";

export function BidControls(props: { topBid: number; minBid: number }) {
  const { minBid } = props;
  const [text, setText] = useState(String(minBid));
  const amount = text.trim() === "" ? NaN : Number(text);
  const raise = (add: 10 | 50 | 100) => setText(String(bidStep(Number.isFinite(amount) ? Math.max(amount, minBid) : minBid, add)));
  return (
    <div class="bid-controls">
      <input type="number" inputMode="numeric" step={10} min={minBid} value={text} aria-label="Bid amount"
        onInput={(e) => setText((e.target as HTMLInputElement).value)} />
      <div class="row">
        {([10, 50, 100] as const).map((n) => <button key={n} class="secondary small" onClick={() => raise(n)}>+{n}</button>)}
      </div>
      <div class="row">
        <button disabled={!canSubmitBid(amount, minBid)} onClick={() => send({ type: "bid", amount })}>Bid</button>
        <button class="secondary" onClick={() => send({ type: "pass" })}>Pass</button>
      </div>
    </div>
  );
}
