import type { ErrorCode } from "./errors";

export const ANIMALS = ["rooster", "goose", "cat", "dog", "sheep", "goat", "donkey", "pig", "cow", "horse"] as const;
export type Animal = (typeof ANIMALS)[number];
export const ANIMAL_VALUE: Record<Animal, number> = { rooster: 10, goose: 40, cat: 90, dog: 160, sheep: 250, goat: 350, donkey: 500, pig: 650, cow: 800, horse: 1000 };
export const ANIMAL_NAME: Record<Animal, readonly [singular: string, plural: string]> = {
  rooster: ["Rooster", "Roosters"], goose: ["Goose", "Geese"], cat: ["Cat", "Cats"], dog: ["Dog", "Dogs"], sheep: ["Sheep", "Sheep"],
  goat: ["Goat", "Goats"], donkey: ["Donkey", "Donkeys"], pig: ["Pig", "Pigs"], cow: ["Cow", "Cows"], horse: ["Horse", "Horses"] };
export type MoneyValue = 0 | 10 | 50 | 100 | 200 | 500;
export const STARTING_MONEY: readonly MoneyValue[] = [0, 0, 10, 10, 10, 10, 50];
export const DONKEY_PAYOUTS: readonly MoneyValue[] = [50, 100, 200, 500];
export const ROOM_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const DECISION_SECONDS = [10, 20, 30, 60, 120] as const;
export const HOST_TRANSFER_MS = 120_000, NOBODY_CONNECTED_MS = 600_000, FINISHED_CLOSE_MS = 300_000, BLUFF_REVEAL_MS = 5_000;
export const AWAY_AFTER = 3, MAX_TIES = 3, LOG_LIMIT = 100, MAX_BID = 100_000;

export type Seat = 1 | 2 | 3 | 4 | 5;
export type Herd = Record<Animal, number>;
export interface MoneyCard { id: string; value: MoneyValue }
export interface Settings { moneyRule: "swap" | "loserTakesBoth"; decisionSeconds: (typeof DECISION_SECONDS)[number] }
export interface Player {
  id: string; token: string; name: string; seat: Seat; connected: boolean; disconnectedAt: number | null;
  money: MoneyCard[]; herd: Herd; out: boolean; away: boolean; timeouts: number; // consecutive timeouts
}
export interface Auction {
  card: Animal; auctioneerId: string; bidders: string[]; // eligible ids, clockwise from the auctioneer's left
  excluded: string[]; passed: string[]; topBid: number; topBidderId: string | null; turnId: string | null;
}
export interface TradeTerms { defenderId: string; animal: Animal; count: 1 | 2 }
export type Phase =
  | { kind: "action"; playerId: string }
  | { kind: "bidding"; auction: Auction }
  | { kind: "decision"; auction: Auction }
  | { kind: "bluff"; auction: Auction; blufferId: string; bid: number; cards: MoneyValue[] }
  | { kind: "payment"; card: Animal; payerId: string; receiverId: string; amount: number }
  | { kind: "tradeSetup"; challengerId: string; terms: TradeTerms | null; ties: number }
  | { kind: "tradeResponse"; challengerId: string; terms: TradeTerms; ties: number; offer: MoneyCard[] };
export interface PaymentRecord { id: number; payerId: string; receiverId: string; amount: number; cards: MoneyValue[] }
export interface TradeRecord {
  id: number; challengerId: string; defenderId: string; animal: Animal; count: 1 | 2; ties: number;
  challengerCards: MoneyValue[]; defenderCards: MoneyValue[] | null; // null = defender put nothing
  winnerId: string | null;                                          // null = tie, trade repeats
}
export interface Game {
  deck: Animal[]; donkeysRevealed: number; activePlayerId: string; phase: Phase; // deck[0] is the top card
  deadline: number | null; // null while paused or finished
  lastPayment: PaymentRecord | null; lastTrade: TradeRecord | null; recordSeq: number;
}
export interface ScoreRow { playerId: string; sets: Animal[]; setValue: number; multiplier: number; score: number; rank: number; winner: boolean }
export interface LogEntry { seq: number; text: string }
export type RoomStatus = "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED";
export interface Room { // the EMPTY state is `null`
  status: RoomStatus; roomId: string; roomName: string;
  hostId: string; players: Player[]; blockedTokens: string[]; settings: Settings;
  game: Game | null; scores: ScoreRow[] | null; log: LogEntry[]; logSeq: number;
  finishedAt: number | null; nobodySince: number | null;
}
export type Intent =
  | { type: "leaveSeat" } | { type: "removePlayer"; playerId: string }
  | { type: "startGame" } | { type: "chooseAction"; action: "auction" | "cowTrade" }
  | { type: "bid"; amount: number } | { type: "pass" }
  | { type: "auctioneerDecision"; decision: "sell" | "buy" } | { type: "pay"; cardIds: string[] }
  | { type: "cowTradeOffer"; targetId: string; animal: Animal; count: number; cardIds: string[] }
  | { type: "cowTradeResponse"; cardIds: string[] }
  | { type: "pause" } | { type: "resume" } | { type: "closeRoom" } | { type: "playAgain" } | { type: "imBack" };
export type Action =
  | { type: "create"; token: string; roomId: string; roomName: string; playerName: string; moneyRule: Settings["moneyRule"]; decisionSeconds: Settings["decisionSeconds"] }
  | { type: "join"; token: string; playerName: string }
  | { type: "connect"; token: string } | { type: "disconnect"; token: string }
  | { type: "intent"; token: string; intent: Intent } | { type: "tick" };
export type CloseReason = "hostClosed" | "finished" | "inactive";
export type RoomEvent = { kind: "closed"; reason: CloseReason } | { kind: "removed"; token: string };
export interface Ctx { now: number; rng: () => number }
export type Outcome = { ok: true; state: Room | null; events: RoomEvent[] } | { ok: false; error: { code: ErrorCode; message: string } };
