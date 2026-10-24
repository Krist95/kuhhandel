import type { GameView, RoomView } from "../../../../src/protocol";
import { ANIMAL_NAME, DONKEY_PAYOUTS, MAX_TIES } from "../../../../src/rules/types";
import { bidderPills } from "../../model/stage";
import { LotCard } from "./Animals";
import { CardBack } from "./Money";

const HINT = "color:var(--paper);opacity:.85";
const HINT_ROUND1 = "color:var(--paper);opacity:.8";
const HINT_DECIDING = "color:var(--paper);opacity:.7";

function Pile(props: { deck: number; donkeys: number }) {
  const { deck, donkeys } = props;
  return (
    <div class="kh-pile">
      <div class="kh-deck"><span></span><span></span><span></span><b>{deck}</b></div>
      <span class="kh-cap">Deck</span>
      <div class="kh-donkeys" title="Donkeys revealed">
        {[0, 1, 2, 3].map((i) => <i key={i} class={i < donkeys ? "on" : i === donkeys ? "next" : ""}></i>)}
      </div>
      <span class="kh-cap">{donkeys < 4 ? "Next +" + DONKEY_PAYOUTS[donkeys] : "All paid"}</span>
    </div>
  );
}

export function Stage(props: { room: RoomView; game: GameView; meId: string }) {
  const { room, game, meId } = props;
  const nameOf = (id: string): string => room.players.find((p) => p.id === id)?.name ?? "?";
  const whoIs = (id: string): string => (id === meId ? "You" : nameOf(id));
  const ph = game.phase;
  const pile = <Pile deck={game.deckCount} donkeys={game.donkeysRevealed} />;
  let body;
  switch (ph.kind) {
    case "action": {
      const me = ph.playerId === meId;
      const n = game.deckCount;
      if (n === 40) {
        body = (
          <div class="kh-info">
            <span class="kh-cap">Round 1</span>
            {me ? (
              <>
                <div class="kh-banner">You open. <span>Flip a card or… no, flip a card.</span></div>
                <div class="kh-hint" style={HINT_ROUND1}>Nobody owns an animal yet, so a cow trade isn’t possible.</div>
              </>
            ) : (
              <div class="kh-banner">{nameOf(ph.playerId)} opens.</div>
            )}
          </div>
        );
      } else {
        body = (
          <div class="kh-info">
            <span class="kh-cap">{n === 0 ? "Deck empty" : n <= 10 ? `Late game · ${n} cards left` : `${n} cards left`}</span>
            {me ? (
              <div class="kh-banner">Your turn.</div>
            ) : (
              <div class="kh-banner">{nameOf(ph.playerId)}’s turn. <span>Choosing an action.</span></div>
            )}
            <div class="kh-hint" style={HINT}>Tap any pod to compare every herd.</div>
          </div>
        );
      }
      break;
    }
    case "bidding":
    case "decision": {
      const pills = bidderPills(ph, room.players, meId);
      body = (
        <>
          <LotCard animal={ph.card} />
          <div class="kh-info">
            <span class="kh-cap">{ph.auctioneerId === meId ? "Auction · Your lot" : `Auction · ${nameOf(ph.auctioneerId)}’s lot`}</span>
            <div class="kh-big">{ph.topBid}{ph.topBidderId && <small>{whoIs(ph.topBidderId)}</small>}</div>
            <div class="kh-bidders">
              {pills.map((p) => (
                <span key={p.id} class={p.state === "wait" ? "kh-bidder" : `kh-bidder ${p.state}`}>
                  {p.state === "excl" ? `${p.label} · bluffed` : p.state === "top" ? <>{p.label} <b>{p.amount}</b></> : p.label}
                </span>
              ))}
            </div>
          </div>
        </>
      );
      break;
    }
    case "bluff":
      body = (
        <>
          <LotCard animal={ph.card} />
          <div class="kh-info"><span class="kh-cap">Auction · bluff called</span></div>
        </>
      );
      break;
    case "payment": {
      const payer = whoIs(ph.payerId);
      const receiver = whoIs(ph.receiverId);
      const involved = ph.payerId === meId || ph.receiverId === meId;
      const other = ph.payerId === meId ? nameOf(ph.receiverId) : nameOf(ph.payerId);
      body = (
        <>
          <LotCard animal={ph.card} />
          <div class="kh-info">
            <span class="kh-cap">Payment</span>
            <div class="kh-big">{ph.amount}<small>{involved ? (ph.payerId === meId ? `you → ${receiver}` : `${payer} → you`) : `${payer} → ${receiver}`}</small></div>
            <div class="kh-hint" style={HINT}>
              Everyone sees the amount and how many notes. Only {involved ? `you and ${other}` : `${payer} and ${receiver}`} see which.
            </div>
          </div>
        </>
      );
      break;
    }
    case "tradeSetup": {
      const me = ph.challengerId === meId;
      const rep = ph.ties > 0 ? ` · repeat ${ph.ties} of ${MAX_TIES}` : "";
      body = (
        <div class="kh-info">
          <span class="kh-cap">{"Cow trade · setting up" + rep}</span>
          <div class="kh-banner">{whoIs(ph.challengerId)} vs <span>{me ? "…pick someone on the right." : "…picking someone."}</span></div>
          {me && <div class="kh-hint" style={HINT}>Only rivals who share an animal with you are listed. Complete sets are off the table.</div>}
        </div>
      );
      break;
    }
    case "tradeResponse": {
      const { count, animal, defenderId } = ph.terms;
      const rep = ph.ties > 0 ? ` · repeat ${ph.ties} of ${MAX_TIES}` : "";
      body = (
        <div class="kh-info">
          <span class="kh-cap">{`Cow trade · ${count} ${ANIMAL_NAME[animal][count === 1 ? 0 : 1]}${rep}`}</span>
          <div class="kh-offer">
            <div class="side">
              <span class="kh-cap">{whoIs(ph.challengerId)}</span>
              <div class="notes">{Array.from({ length: ph.offerCount }, (_, i) => <CardBack key={i} />)}</div>
            </div>
            <span class="vs">vs</span>
            <div class="side">
              <span class="kh-cap">{whoIs(defenderId)}</span>
              <div class="notes"><span class="kh-hint" style={HINT_DECIDING}>deciding…</span></div>
            </div>
          </div>
          <div class="kh-hint" style={HINT}>Values stay hidden. Only the two of you see them after.</div>
        </div>
      );
      break;
    }
  }
  return <div class="kh-stage">{pile}{body}</div>;
}
