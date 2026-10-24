import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { ClientMessage, RoomView } from "../../../../src/protocol";
import { autoPay } from "../../../../src/rules/payment";
import { ANIMAL_NAME, type Animal, type MoneyCard, type TradeTerms } from "../../../../src/rules/types";
import { bidStep, canSubmitBid, deriveControls, sheetKey, type Controls } from "../../model/controls";
import { payHint, stepBid, tradeOptions } from "../../model/stage";
import { sendOrToast } from "../../net/socket";
import { errorSeq, picked, validPicks, view } from "../../state";
import { AwayBanner } from "../AwayBanner";
import { AnimalTile } from "./Animals";
import { BidAmountSheet } from "./BidAmountSheet";
import { CountdownRing } from "./CountdownRing";

/** Which picking mode the Hand is in for these controls. */
export function dockHandMode(c: Controls): "view" | "pay" | "offer" | "counter" {
  switch (c.kind) {
    case "pay": return "pay";
    case "tradeSetup": return "offer";
    case "respond": return "counter";
    default: return "view";
  }
}

/** "Pig" for one, "2 Pigs" for more. */
const animals = (a: Animal, n: number): string => (n === 1 ? ANIMAL_NAME[a][0] : `${n} ${ANIMAL_NAME[a][1]}`);

interface Ctx { room: RoomView; meId: string; money: readonly MoneyCard[]; nameOf: (id: string) => string; ring: (lg?: boolean) => ComponentChildren }
/** Ctx plus the dock's one-shot send: after a successful send the decision buttons stay disabled until the next decision remounts DockBody. */
interface DCtx extends Ctx { sent: boolean; send: (msg: ClientMessage) => void }

function Head(props: { ring: ComponentChildren; h: string; s: string }) {
  return (
    <div class="head">
      {props.ring}
      <div><div class="h">{props.h}</div><div class="s">{props.s}</div></div>
    </div>
  );
}

/** Picked ids still in hand, and their total. */
function selection(money: readonly MoneyCard[]): { ids: string[]; sum: number } {
  const ids = validPicks(picked.value, money);
  const sum = money.filter((m) => ids.includes(m.id)).reduce((n, m) => n + m.value, 0);
  return { ids, sum };
}

export function ActionDock(props: { room: RoomView; meId: string }) {
  const { room, meId } = props;
  const v = view.value;
  const c: Controls = v ? deriveControls(v) : { kind: "watch", waitingOnId: null };
  const deadline = room.game?.deadline ?? null;
  const key = sheetKey(c, deadline);

  useEffect(() => { picked.value = []; }, [key]);

  const ctx: Ctx = {
    room,
    meId,
    money: v?.me?.money ?? [],
    nameOf: (id) => room.players.find((p) => p.id === id)?.name ?? "?",
    ring: (lg) => (
      <CountdownRing deadline={deadline} decisionSeconds={room.settings.decisionSeconds} paused={room.status === "PAUSED"} size={lg ? "lg" : "md"} />
    ),
  };
  return <DockBody key={key} c={c} ctx={ctx} />;
}

function DockBody(props: { c: Controls; ctx: Ctx }) {
  const { c } = props;
  const [sent, setSent] = useState(false);
  // A rejected send leaves the decision open: re-enable the buttons instead of waiting for the timeout.
  const errors = errorSeq.value;
  useEffect(() => setSent(false), [errors]);
  const ctx: DCtx = {
    ...props.ctx,
    sent,
    send: (msg) => { if (!sent && sendOrToast(msg)) setSent(true); },
  };
  switch (c.kind) {
    case "away": return <div class="kh-dock"><AwayBanner /></div>;
    case "watch": return <Watch waitingOnId={c.waitingOnId} ctx={ctx} />;
    case "turn": return <Turn c={c} ctx={ctx} />;
    case "bid": return <Bid key={c.minBid} c={c} ctx={ctx} />;
    case "decide": return <Decide c={c} ctx={ctx} />;
    case "pay": return <Pay c={c} ctx={ctx} />;
    case "tradeSetup": return <Setup c={c} ctx={ctx} />;
    case "respond": return <Respond c={c} ctx={ctx} />;
  }
}

function watchLine(ctx: Ctx): string {
  const ph = ctx.room.game?.phase;
  if (!ph) return "";
  switch (ph.kind) {
    case "action": return "Choosing an action";
    case "bidding": {
      const animal = ANIMAL_NAME[ph.card][0];
      return ph.auctioneerId === ctx.meId ? `Bidding on your ${animal}` : `Bidding on ${ctx.nameOf(ph.auctioneerId)}’s ${animal}`;
    }
    case "decision": return "Deciding: sell or buy";
    case "payment": return `Paying ${ph.amount}`;
    case "tradeSetup": return "Setting up a cow trade";
    case "tradeResponse": return "Answering a cow trade";
    case "bluff": return "";
  }
}

function Watch(props: { waitingOnId: string | null; ctx: Ctx }) {
  const { waitingOnId, ctx } = props;
  const h = waitingOnId === null ? "Bluff called" : `${ctx.nameOf(waitingOnId)}’s move`;
  return (
    <div class="kh-dock">
      <Head ring={ctx.ring()} h={h} s={watchLine(ctx)} />
      <div class="push"><div class="kh-hint">Nothing for you to do. Look busy.</div></div>
    </div>
  );
}

function Turn(props: { c: Extract<Controls, { kind: "turn" }>; ctx: DCtx }) {
  const { c, ctx } = props;
  const deck = ctx.room.game?.deckCount ?? 0;
  return (
    <div class="kh-dock mine">
      <Head ring={ctx.ring(true)} h="Your turn" s={deck === 0 ? "Timeout = skip turn" : "Timeout = auction"} />
      <div class="push">
        <button class="kh-btn big" disabled={!c.auction.ok || ctx.sent} onClick={() => ctx.send({ type: "chooseAction", action: "auction" })}>
          Auction<small>{c.auction.ok ? `Flip the top card · ${deck} left` : c.auction.reason}</small>
        </button>
        <button class="kh-btn big secondary" disabled={!c.cowTrade.ok || ctx.sent} onClick={() => ctx.send({ type: "chooseAction", action: "cowTrade" })}>
          Cow trade<small>{c.cowTrade.ok ? "Challenge someone for an animal" : c.cowTrade.reason}</small>
        </button>
      </div>
    </div>
  );
}

function Bid(props: { c: Extract<Controls, { kind: "bid" }>; ctx: DCtx }) {
  const { c, ctx } = props;
  const [amount, setAmount] = useState(c.minBid);
  const [sheet, setSheet] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  const ph = ctx.room.game?.phase;
  const topId = ph && (ph.kind === "bidding" || ph.kind === "decision") ? ph.topBidderId : null;
  const topName = topId === null ? null : topId === ctx.meId ? "You" : ctx.nameOf(topId);
  return (
    <div class="kh-dock mine">
      <Head ring={ctx.ring()} h="Your bid" s={topName === null ? `Top: ${c.topBid}` : `Top: ${c.topBid} · ${topName}`} />
      <div class="push">
        <div class="kh-stepper">
          <button aria-label="Lower" onClick={() => setAmount(stepBid(amount, c.minBid, -1))}>−</button>
          <output
            onPointerDown={() => { clear(); timer.current = setTimeout(() => { timer.current = null; setSheet(true); }, 500); }}
            onPointerUp={clear} onPointerLeave={clear} onPointerCancel={clear}
            onContextMenu={(e) => e.preventDefault()}
          >{amount}</output>
          <button aria-label="Raise" onClick={() => setAmount(stepBid(amount, c.minBid, 1))}>+</button>
        </div>
        <div class="kh-three">
          {([10, 50, 100] as const).map((n) => (
            <button key={n} class="kh-btn quick" onClick={() => setAmount(bidStep(amount, n))}>+{n}</button>
          ))}
        </div>
        <div class="kh-two">
          <button class="kh-btn secondary" disabled={ctx.sent} onClick={() => ctx.send({ type: "pass" })}>Pass</button>
          <button class="kh-btn" disabled={!canSubmitBid(amount, c.minBid) || ctx.sent} onClick={() => ctx.send({ type: "bid", amount })}>Bid {amount}</button>
        </div>
      </div>
      {sheet && (
        <BidAmountSheet amount={amount} minBid={c.minBid}
          onSet={(n) => { setAmount(n); setSheet(false); }} onCancel={() => setSheet(false)} />
      )}
    </div>
  );
}

function Decide(props: { c: Extract<Controls, { kind: "decide" }>; ctx: DCtx }) {
  const { c, ctx } = props;
  const name = ctx.nameOf(c.topBidderId);
  return (
    <div class="kh-dock mine">
      <Head ring={ctx.ring()} h={`${name} bid ${c.topBid}`} s="Timeout = sell" />
      <div class="push">
        <button class="kh-btn big" disabled={ctx.sent} onClick={() => ctx.send({ type: "auctioneerDecision", decision: "sell" })}>
          Sell<small>{`${name} pays you ${c.topBid}`}</small>
        </button>
        <button class="kh-btn big secondary" disabled={!c.buyEnabled || ctx.sent} onClick={() => ctx.send({ type: "auctioneerDecision", decision: "buy" })}>
          Buy it<small>{c.buyEnabled ? `You pay ${name} ${c.topBid}` : `You can’t cover ${c.topBid}`}</small>
        </button>
      </div>
    </div>
  );
}

function Pay(props: { c: Extract<Controls, { kind: "pay" }>; ctx: DCtx }) {
  const { c, ctx } = props;
  const owed = c.amount;
  const { ids, sum } = selection(ctx.money);
  const ph = ctx.room.game?.phase;
  const to = ph?.kind === "payment" ? ctx.nameOf(ph.receiverId) : "?";
  const done = sum >= owed;
  const bestFit = () => {
    try {
      picked.value = autoPay(ctx.money, owed).map((m) => m.id);
    } catch {
      // Not enough cash to cover it: leave the selection as it is.
    }
  };
  return (
    <div class="kh-dock mine">
      <Head ring={ctx.ring()} h={`Pay ${owed} to ${to}`} s="Tap notes in your hand" />
      <div class="push">
        <div class={`kh-meter${done ? " done" : ""}`} style={{ "--m": owed > 0 ? Math.min(1, sum / owed) : 1 } as any}><i></i></div>
        <div class="kh-hint">{payHint(sum, owed)}</div>
        <div class="kh-two">
          <button class="kh-btn secondary" onClick={bestFit}>Best fit</button>
          <button class="kh-btn" disabled={!done || ctx.sent} onClick={() => ctx.send({ type: "pay", cardIds: ids })}>Pay {sum}</button>
        </div>
      </div>
    </div>
  );
}

function Setup(props: { c: Extract<Controls, { kind: "tradeSetup" }>; ctx: DCtx }) {
  const { c, ctx } = props;
  const [choice, setChoice] = useState<{ row: number; count: 1 | 2 } | null>(null);
  const opts = tradeOptions(c.targets);
  const { ids } = selection(ctx.money);
  const chosen = choice !== null ? opts[choice.row] : undefined;
  const terms: TradeTerms | null = c.fixed
    ?? (chosen && choice ? { defenderId: chosen.playerId, animal: chosen.animal, count: choice.count } : null);
  const canOffer = terms !== null && ids.length >= 1;
  const offer = () => {
    if (!terms) return;
    ctx.send({ type: "cowTradeOffer", targetId: terms.defenderId, animal: terms.animal, count: terms.count, cardIds: ids });
  };
  return (
    <div class="kh-dock mine">
      <Head ring={ctx.ring()} h="Cow trade" s={c.fixed
        ? `Repeat round · ${c.fixed.count} ${ANIMAL_NAME[c.fixed.animal][c.fixed.count === 1 ? 0 : 1]} with ${ctx.nameOf(c.fixed.defenderId)}`
        : "Pick a rival and an animal"} />
      {!c.fixed && (
        <div class="kh-col" style="gap:5px;flex:1 1 auto;min-height:0;overflow-y:auto">
          {opts.map((o, i) => {
            const on = choice?.row === i;
            return (
              <div key={`${o.playerId}:${o.animal}`} class="kh-opt" aria-pressed={on ? "true" : "false"} onClick={() => setChoice({ row: i, count: 1 })}>
                <AnimalTile animal={o.animal} />
                <span class="nm">{`${ctx.nameOf(o.playerId)} · ${ANIMAL_NAME[o.animal][0]}`}</span>
                <span class="kh-seg">
                  <button aria-pressed={on && choice?.count === 1 ? "true" : "false"}
                    onClick={(e) => { e.stopPropagation(); setChoice({ row: i, count: 1 }); }}>×1</button>
                  <button aria-pressed={on && choice?.count === 2 ? "true" : "false"} disabled={o.maxCount < 2}
                    onClick={(e) => { e.stopPropagation(); setChoice({ row: i, count: 2 }); }}>×2</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div class="push">
        <div class="kh-hint">Then pick face-down notes in your hand. Zeros welcome.</div>
        <div class="kh-two">
          <button class="kh-btn secondary" onClick={() => { setChoice(null); picked.value = []; }}>Cancel</button>
          <button class="kh-btn" disabled={!canOffer || ctx.sent} onClick={offer}>Offer {ids.length}</button>
        </div>
      </div>
    </div>
  );
}

function Respond(props: { c: Extract<Controls, { kind: "respond" }>; ctx: DCtx }) {
  const { c, ctx } = props;
  const who = ctx.nameOf(c.challengerId);
  const { ids, sum } = selection(ctx.money);
  const cards = `${c.offerCount} ${c.offerCount === 1 ? "card" : "cards"}`;
  return (
    <div class="kh-dock mine">
      <Head ring={ctx.ring()} h={`${who} wants your ${animals(c.animal, c.count)}`} s={`They put down ${cards}`} />
      <div class="push">
        <div class="kh-hint">{`Counter with notes from your hand, or fold and pocket their ${cards}.`}</div>
        <div class="kh-two">
          <button class="kh-btn secondary" disabled={ctx.sent} onClick={() => ctx.send({ type: "cowTradeResponse", cardIds: [] })}>Put nothing</button>
          <button class="kh-btn" disabled={ids.length === 0 || ctx.sent} onClick={() => ctx.send({ type: "cowTradeResponse", cardIds: ids })}>Counter {sum}</button>
        </div>
      </div>
    </div>
  );
}
