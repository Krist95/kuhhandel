import type { ComponentChildren } from "preact";
import type { GameView, RoomView } from "../../../src/protocol";
import { animalsText, cardsText } from "../../../src/rules/text";
import { MAX_TIES, type Animal } from "../../../src/rules/types";
import { waitingOnPublic } from "../model/controls";
import { AnimalCard } from "./AnimalCard";
import { Countdown } from "./Countdown";

export function Center(props: { room: RoomView; game: GameView }) {
  const { room, game } = props;
  const nameOf = (id: string): string => room.players.find((p) => p.id === id)?.name ?? "?";
  const ph = game.phase;
  const lines: ComponentChildren[] = [];
  let card: Animal | null = null;
  switch (ph.kind) {
    case "action":
      lines.push(<div>{nameOf(ph.playerId)} chooses an action</div>);
      break;
    case "bidding":
    case "decision":
      card = ph.card;
      lines.push(<div>Auctioneer: {nameOf(ph.auctioneerId)}</div>);
      lines.push(<div>Top bid {ph.topBid}{ph.topBidderId ? ` · ${nameOf(ph.topBidderId)}` : ""}</div>);
      if (ph.kind === "bidding" && ph.turnId) lines.push(<div>Bidding: {nameOf(ph.turnId)}</div>);
      if (ph.kind === "decision") lines.push(<div>{nameOf(ph.auctioneerId)} decides</div>);
      if (ph.passed.length > 0) {
        lines.push(<div>{ph.passed.map((id) => <s key={id} class="passed">{nameOf(id)} </s>)}</div>);
      }
      if (ph.excluded.length > 0) lines.push(<div>Excluded: {ph.excluded.map(nameOf).join(", ")}</div>);
      break;
    case "bluff":
      card = ph.card;
      lines.push(<div>Auctioneer: {nameOf(ph.auctioneerId)}</div>);
      lines.push(<div>{nameOf(ph.blufferId)} bid {ph.bid} and was called on a bluff</div>);
      if (ph.excluded.length > 0) lines.push(<div>Excluded: {ph.excluded.map(nameOf).join(", ")}</div>);
      break;
    case "payment":
      card = ph.card;
      lines.push(<div>{nameOf(ph.payerId)} pays {ph.amount}</div>);
      break;
    case "tradeSetup":
      lines.push(<div>{nameOf(ph.challengerId)} is setting up a Cow trade</div>);
      if (ph.ties > 0) lines.push(<div>Repeat {ph.ties} of {MAX_TIES}</div>);
      break;
    case "tradeResponse":
      lines.push(
        <div>
          {nameOf(ph.challengerId)} vs {nameOf(ph.terms.defenderId)} · {animalsText(ph.terms.count, ph.terms.animal)} · {nameOf(ph.challengerId)} put down {cardsText(ph.offerCount)}
        </div>,
      );
      if (ph.ties > 0) lines.push(<div>Repeat {ph.ties} of {MAX_TIES}</div>);
      break;
  }
  const waiting = waitingOnPublic(ph);
  return (
    <div class="center-table">
      <div class="stats">
        <span>Deck {game.deckCount}</span>
        <span>Donkeys {game.donkeysRevealed}/4{game.nextDonkeyPayout !== null ? ` · next +${game.nextDonkeyPayout}` : ""}</span>
      </div>
      {card && <AnimalCard animal={card} size="card" />}
      {lines}
      {room.status !== "PAUSED" && <Countdown deadline={game.deadline} label={waiting ? nameOf(waiting) : null} />}
    </div>
  );
}
