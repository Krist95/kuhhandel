import { addLog, nextClockwise, playerById, type Tx } from "./engine";
import { RuleError } from "./errors";
import { mintCard } from "./setup";
import { endTurn, inGame, setPhase } from "./turn";
import { ANIMAL_NAME, DONKEY_PAYOUTS, MAX_BID, type Player, type Auction, type Room } from "./types";

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

function biddingAuction(room: Room, p: Player): Auction {
  const phase = room.game!.phase;
  if (phase.kind !== "bidding" || phase.auction.turnId !== p.id) throw new RuleError("notYourTurn");
  return phase.auction;
}

export function bid(room: Room, p: Player, amount: number, tx: Tx): void {
  const auction = biddingAuction(room, p);
  if (!Number.isInteger(amount) || amount < 10 || amount % 10 !== 0 || amount <= auction.topBid || amount > MAX_BID) {
    throw new RuleError("badBid");
  }
  auction.topBid = amount;
  auction.topBidderId = p.id;
  addLog(room, `${p.name} bids ${amount}.`);
  afterBidTurn(room, auction, p.id, tx);
}

export function pass(room: Room, p: Player, tx: Tx): void {
  const auction = biddingAuction(room, p);
  auction.passed.push(p.id);
  addLog(room, `${p.name} passes.`);
  afterBidTurn(room, auction, p.id, tx);
}

function afterBidTurn(room: Room, auction: Auction, currentId: string, tx: Tx): void {
  const live = auction.bidders.filter((id) => !auction.passed.includes(id));
  if (live.length === 0) return giveFree(room, auction, tx);
  if (live.length === 1 && live[0] === auction.topBidderId) {
    auction.turnId = null;
    return setPhase(room, { kind: "decision", auction }, tx);
  }
  const n = auction.bidders.length;
  const from = auction.bidders.indexOf(currentId);
  for (let k = 1; k <= n; k++) {
    const id = auction.bidders[(from + k) % n];
    if (live.includes(id)) {
      auction.turnId = id;
      break;
    }
  }
  setPhase(room, { kind: "bidding", auction }, tx);
}
