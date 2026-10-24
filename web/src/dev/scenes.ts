// Dev-only fixtures for /?table=<name>: hand-built views that mirror the `scenes` in docs/design/kuhhandel-table/markup.mjs.
import type { GameView, PublicPhase, PublicPlayer, RoomView, View } from "../../../src/protocol";
import { ANIMALS, type Animal, type Herd, type MoneyValue, type Seat } from "../../../src/rules/types";

const herd = (pairs: [Animal, number][] = []): Herd => {
  const h = Object.fromEntries(ANIMALS.map((a) => [a, 0])) as Herd;
  for (const [a, n] of pairs) h[a] = n;
  return h;
};

interface Opp { name: string; herd?: [Animal, number][]; money: number; away?: boolean; offline?: boolean }

const player = (id: string, seat: Seat, o: Opp): PublicPlayer => ({
  id, name: o.name, seat, connected: !o.offline, away: !!o.away, out: false, moneyCount: o.money, herd: herd(o.herd),
});

/** You sit in seat 1; opponents fill seats 2–5, so the rail shows them in the order given. */
function scene(now: number, s: {
  me: { name?: string; herd: [Animal, number][]; money: MoneyValue[] };
  opps: [Opp, Opp, Opp, Opp];
  ids?: [string, string, string, string];
  deck: number; donkeys: number; active: string; phase: PublicPhase; secs: number; log: string[];
}): View {
  const ids = s.ids ?? ["anna", "ben", "clara", "dan"];
  const money = s.me.money.map((value, i) => ({ id: `m${i}`, value }));
  const players: PublicPlayer[] = [
    player("me", 1, { name: s.me.name ?? "You", herd: s.me.herd, money: money.length }),
    ...s.opps.map((o, i) => player(ids[i], (i + 2) as Seat, o)),
  ];
  const game: GameView = {
    deckCount: s.deck, donkeysRevealed: s.donkeys, nextDonkeyPayout: ([50, 100, 200, 500] as const)[s.donkeys] ?? null,
    activePlayerId: s.active, phase: s.phase, deadline: now + s.secs * 1000, lastTrade: null,
  };
  const room: RoomView = {
    status: "PLAYING", roomId: "DEVTBL", roomName: "Table scenes", hostId: ids[1], settings: { moneyRule: "swap", decisionSeconds: 20 },
    players, game, log: s.log.map((text, i) => ({ seq: i + 1, text })), scores: null, closeAt: null,
  };
  return { serverTime: now, me: { id: "me", money, offer: null, buyEnabled: null, tradeReveal: null, payment: null }, room };
}

const START: [Opp, Opp, Opp, Opp] = [
  { name: "Anna", money: 7 }, { name: "Ben", money: 7 }, { name: "Clara", money: 7 }, { name: "Dan", money: 7 },
];
const MID = (dan: Partial<Opp> = {}, clara: [Animal, number][] = [["rooster", 4], ["cow", 1]], anna: Opp = { name: "Anna", herd: [["goose", 2], ["pig", 1]], money: 6 }): [Opp, Opp, Opp, Opp] => [
  anna,
  { name: "Ben", herd: [["cat", 1], ["horse", 1]], money: 9 },
  { name: "Clara", herd: clara, money: 5 },
  { name: "Dan", herd: [["dog", 2]], money: 8, ...dan },
];
const LATE_ME: [Animal, number][] = [["horse", 2], ["sheep", 1], ["donkey", 1], ["goat", 1]];
const LATE: [Opp, Opp, Opp, Opp] = [
  { name: "Anna", herd: [["goose", 2], ["pig", 1], ["cat", 1], ["dog", 3], ["sheep", 1], ["goat", 2]], money: 4 },
  { name: "Ben", herd: [["cat", 1], ["horse", 1], ["cow", 2], ["donkey", 1], ["goose", 1]], money: 9 },
  { name: "Clara", herd: [["rooster", 4], ["cow", 1], ["sheep", 2], ["goose", 1]], money: 5 },
  { name: "Dan", herd: [["dog", 1], ["goat", 1], ["donkey", 2]], money: 8, away: true },
];
const HAND: MoneyValue[] = [0, 10, 50, 100, 100, 200];
const DEAL: MoneyValue[] = [0, 0, 10, 10, 10, 10, 50];

/** Five players with 16-character names, six animal types each (every animal held by three players). */
function long(now: number): View {
  const types = (i: number): [Animal, number][] => [0, 1, 2, 3, 4, 5].map((k) => [ANIMALS[(2 * i + k) % 10], 1]);
  const names = ["Annabelle Strand", "Bartholomew Kite", "Clementine Vogel", "Dashiell Hammond"];
  return scene(now, {
    me: { name: "Maximilian Bergh", herd: types(0), money: HAND },
    opps: [0, 1, 2, 3].map((i) => ({ name: names[i], herd: types(i + 1), money: 5 + i })) as [Opp, Opp, Opp, Opp],
    deck: 9, donkeys: 3, active: "anna",
    phase: { kind: "bidding", card: "horse", auctioneerId: "anna", topBid: 150, topBidderId: "clara", turnId: "me", passed: ["ben"], excluded: [] },
    secs: 14, log: ["Annabelle Strand is auctioning", "Clementine Vogel bid 150"],
  });
}

export function buildScenes(now: number): Record<string, View> {
  return {
    intro: scene(now, {
      me: { herd: [], money: DEAL }, opps: START, deck: 40, donkeys: 0, active: "clara",
      phase: { kind: "action", playerId: "clara" }, secs: 20, log: ["Game started"],
    }),
    start: scene(now, {
      me: { herd: [], money: DEAL }, opps: START, deck: 40, donkeys: 0, active: "me",
      phase: { kind: "action", playerId: "me" }, secs: 17, log: ["The deck is shuffled. You go first."],
    }),
    bidding: scene(now, {
      me: { herd: [["horse", 2], ["sheep", 1], ["goose", 1]], money: [0, 10, 10, 50, 100, 200] }, opps: MID({ away: true }),
      deck: 27, donkeys: 1, active: "me",
      phase: { kind: "bidding", card: "horse", auctioneerId: "me", topBid: 120, topBidderId: "clara", turnId: "anna", passed: ["ben"], excluded: [] },
      secs: 12, log: ["Ben passed", "Clara bid 120"],
    }),
    mybid: scene(now, {
      me: { herd: [["horse", 2], ["sheep", 1], ["donkey", 1]], money: HAND }, opps: MID({ offline: true }),
      deck: 19, donkeys: 2, active: "ben",
      phase: { kind: "bidding", card: "donkey", auctioneerId: "ben", topBid: 90, topBidderId: "anna", turnId: "me", passed: ["clara"], excluded: [] },
      secs: 14, log: ["Ben is auctioning", "Donkey! Everyone receives 100"],
    }),
    pay: scene(now, {
      me: { herd: [["horse", 2], ["sheep", 1], ["donkey", 1]], money: HAND }, opps: MID(), deck: 18, donkeys: 2, active: "ben",
      phase: { kind: "payment", card: "pig", payerId: "me", receiverId: "ben", amount: 160 }, secs: 9, log: ["Ben sold you the Pig for 160"],
    }),
    setup: scene(now, {
      me: { herd: [["horse", 2], ["sheep", 2], ["pig", 1]], money: [0, 0, 10, 50, 100, 200] }, opps: MID({}, [["rooster", 4], ["cow", 1], ["sheep", 2]]),
      deck: 0, donkeys: 4, active: "me",
      phase: { kind: "tradeSetup", challengerId: "me", terms: null, ties: 0 }, secs: 15, log: ["You chose a cow trade"],
    }),
    respond: scene(now, {
      me: { herd: [["horse", 2], ["sheep", 1], ["pig", 2]], money: HAND },
      opps: MID({}, undefined, { name: "Anna", herd: [["goose", 2], ["pig", 2]], money: 3 }), deck: 0, donkeys: 4, active: "anna",
      phase: { kind: "tradeResponse", challengerId: "anna", terms: { defenderId: "me", animal: "pig", count: 2 }, ties: 0, offerCount: 3 },
      secs: 11, log: ["Anna challenged you for 2 Pigs"],
    }),
    late: scene(now, {
      me: { herd: LATE_ME, money: HAND }, opps: LATE, deck: 7, donkeys: 4, active: "anna",
      phase: { kind: "action", playerId: "anna" }, secs: 9, log: ["Dan bought the Donkey for 230", "Anna is choosing an action"],
    }),
    board: scene(now, {
      me: { herd: LATE_ME, money: HAND }, opps: LATE, deck: 7, donkeys: 4, active: "anna",
      phase: { kind: "action", playerId: "anna" }, secs: 9, log: ["Anna is choosing an action"],
    }),
    long: long(now),
  };
}

/** Built when the dev page loads, so countdown rings show live seconds. */
export const SCENES: Record<string, View> = /* @__PURE__ */ buildScenes(Date.now());
