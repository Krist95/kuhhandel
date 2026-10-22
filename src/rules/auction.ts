import { addLog, nextClockwise, playerById, type Tx } from "./engine";
import { mintCard } from "./setup";
import { endTurn, inGame, setPhase } from "./turn";
import { ANIMAL_NAME, DONKEY_PAYOUTS, type Auction, type Room } from "./types";

export function eligibleBidders(room: Room, auctioneerId: string, excluded: readonly string[]): string[] {
  const start = playerById(room, auctioneerId);
  const out: string[] = [];
  let seat = start.seat;
  for (;;) {
    const next = nextClockwise(room, seat, (p) => !p.out);
    if (!next || next.id === start.id) break;
    seat = next.seat;
    if (!excluded.includes(next.id)) out.push(next.id);
  }
  return out;
}

export function startAuction(room: Room, tx: Tx): void {
  const game = room.game!;
  const auctioneer = playerById(room, game.activePlayerId);
  const card = game.deck.shift()!;
  addLog(room, `${auctioneer.name} auctions the ${ANIMAL_NAME[card][0]}.`);
  if (card === "donkey") {
    const payout = DONKEY_PAYOUTS[game.donkeysRevealed++];
    for (const p of inGame(room)) p.money.push(mintCard(room, tx, payout));
    addLog(room, `Donkey! Everyone receives ${payout}.`);
  }
  const bidders = eligibleBidders(room, auctioneer.id, []);
  const auction: Auction = {
    card, auctioneerId: auctioneer.id, bidders, excluded: [], passed: [],
    topBid: 0, topBidderId: null, turnId: bidders[0] ?? null,
  };
  if (bidders.length === 0) giveFree(room, auction, tx);
  else setPhase(room, { kind: "bidding", auction }, tx);
}

export function giveFree(room: Room, auction: Auction, tx: Tx): void {
  const auctioneer = playerById(room, auction.auctioneerId);
  auctioneer.herd[auction.card]++;
  addLog(room, `No bids. ${auctioneer.name} takes the ${ANIMAL_NAME[auction.card][0]} for free.`);
  endTurn(room, tx);
}
