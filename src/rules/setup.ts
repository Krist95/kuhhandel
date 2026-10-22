import { addLog, type Tx } from "./engine";
import { emptyHerd } from "./herd";
import { pickOne, randomId, shuffle } from "./rng";
import { beginTurn } from "./turn";
import { ANIMALS, STARTING_MONEY, type Animal, type MoneyCard, type MoneyValue, type Room } from "./types";

export function buildDeck(): Animal[] {
  return ANIMALS.flatMap((a) => [a, a, a, a]);
}

/** A money card whose ID is unique among all cards currently held in the room. */
export function mintCard(room: Room, tx: Tx, value: MoneyValue): MoneyCard {
  const held = new Set([...room.players.flatMap((p) => p.money.map((c) => c.id)), ...room.players.map((p) => p.id)]);
  let id = randomId(tx.rng);
  while (held.has(id)) id = randomId(tx.rng);
  return { id, value };
}

export function startGame(room: Room, tx: Tx): void {
  for (const p of room.players) {
    p.money = [];
    for (const v of STARTING_MONEY) p.money.push(mintCard(room, tx, v));
    p.herd = emptyHerd();
    p.out = false;
    p.away = false;
    p.timeouts = 0;
  }
  const first = pickOne(tx.rng, room.players);
  room.status = "PLAYING";
  room.scores = null;
  room.finishedAt = null;
  room.log = [];
  room.game = {
    deck: shuffle(tx.rng, buildDeck()), donkeysRevealed: 0, activePlayerId: first.id,
    phase: { kind: "action", playerId: first.id }, deadline: null,
    lastPayment: null, lastTrade: null, recordSeq: 0,
  };
  addLog(room, `Game started. ${first.name} goes first.`);
  beginTurn(room, first.id, tx);
}
