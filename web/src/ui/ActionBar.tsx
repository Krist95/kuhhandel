import { useState } from "preact/hooks";
import { deriveControls, sheetKey, type Controls, type Enabled } from "../model/controls";
import { send } from "../net/socket";
import { view } from "../state";
import { AwayBanner } from "./AwayBanner";
import { BidControls } from "./BidControls";
import { MoneyPicker } from "./MoneyPicker";
import { TradeWizard } from "./TradeWizard";

function Reasoned(props: { label: string; en: Enabled; onClick: () => void }) {
  return (
    <div class="reasoned">
      <button disabled={!props.en.ok} onClick={props.onClick}>{props.label}</button>
      {!props.en.ok && <div class="hint">{props.en.reason}</div>}
    </div>
  );
}

export function ActionBar() {
  const v = view.value;
  if (!v) return null;
  const c = deriveControls(v);
  return <ControlView key={sheetKey(c, v.room?.game?.deadline ?? null)} c={c} />;
}

function ControlView(props: { c: Controls }) {
  const c = props.c;
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  switch (c.kind) {
    case "watch": return null;
    case "away": return <AwayBanner />;
    case "turn":
      return (
        <div class="action-bar">
          <Reasoned label="Auction" en={c.auction} onClick={() => send({ type: "chooseAction", action: "auction" })} />
          <Reasoned label="Cow trade" en={c.cowTrade} onClick={() => send({ type: "chooseAction", action: "cowTrade" })} />
        </div>
      );
    case "bid":
      return <BidControls key={c.minBid} topBid={c.topBid} minBid={c.minBid} />;
    case "decide":
      return (
        <div class="action-bar">
          <button onClick={() => send({ type: "auctioneerDecision", decision: "sell" })}>Sell</button>
          <Reasoned label="Buy it" en={c.buyEnabled ? { ok: true } : { ok: false, reason: "Can't afford it" }}
            onClick={() => send({ type: "auctioneerDecision", decision: "buy" })} />
        </div>
      );
    case "pay":
      return (
        <div class="action-bar">
          <button onClick={() => setOpen(true)}>Pay {c.amount}</button>
          {open && <MoneyPicker mode="pay" owed={c.amount} onSubmit={(cardIds) => { send({ type: "pay", cardIds }); close(); }} onClose={close} />}
        </div>
      );
    case "tradeSetup":
      return (
        <div class="action-bar">
          <button onClick={() => setOpen(true)}>Set up trade</button>
          {open && <TradeWizard fixed={c.fixed} targets={c.targets} onClose={close} />}
        </div>
      );
    case "respond":
      return (
        <div class="action-bar">
          <button onClick={() => setOpen(true)}>Respond</button>
          {open && (
            <MoneyPicker mode="counter" note={`Offered ${c.offerCount} ${c.offerCount === 1 ? "card" : "cards"}`}
              onSubmit={(cardIds) => { send({ type: "cowTradeResponse", cardIds }); close(); }}
              onNothing={() => { send({ type: "cowTradeResponse", cardIds: [] }); close(); }} onClose={close} />
          )}
        </div>
      );
  }
}
