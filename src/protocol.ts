import type { ErrorCode } from "./rules/errors";
import { ANIMALS } from "./rules/types";
import type {
  Animal, CloseReason, Herd, Intent, LogEntry, MoneyCard, MoneyValue, PaymentRecord, RoomStatus, ScoreRow, Seat, Settings, TradeTerms,
} from "./rules/types";

export type ClientMessage =
  | { type: "hello"; clientToken: string }
  | { type: "createRoom"; roomName: string; playerName: string }
  | { type: "joinRoom"; roomId: string; playerName: string }
  | Intent;
export type ServerMessage =
  | { type: "view"; view: View } | { type: "error"; code: ErrorCode; message: string }
  | { type: "roomClosed"; reason: CloseReason } | { type: "removed" };
export interface PublicPlayer { id: string; name: string; seat: Seat; connected: boolean; away: boolean; out: boolean; moneyCount: number; herd: Herd }
export type PublicPhase =
  | { kind: "action"; playerId: string }
  | { kind: "bidding" | "decision"; card: Animal; auctioneerId: string; topBid: number; topBidderId: string | null; turnId: string | null; passed: string[]; excluded: string[] }
  | { kind: "bluff"; card: Animal; auctioneerId: string; blufferId: string; bid: number; cards: MoneyValue[]; excluded: string[] }
  | { kind: "payment"; card: Animal; payerId: string; receiverId: string; amount: number }
  | { kind: "tradeSetup"; challengerId: string; terms: TradeTerms | null; ties: number }
  | { kind: "tradeResponse"; challengerId: string; terms: TradeTerms; ties: number; offerCount: number };
export interface PublicTrade { id: number; challengerId: string; defenderId: string; animal: Animal; count: 1 | 2; ties: number;
  challengerCards: number; defenderCards: number | null; winnerId: string | null }
export interface TradeReveal { id: number; challengerId: string; defenderId: string; animal: Animal; count: 1 | 2; ties: number;
  challengerValues: MoneyValue[]; defenderValues: MoneyValue[]; challengerTotal: number; defenderTotal: number; winnerId: string | null }
export interface GameView { deckCount: number; donkeysRevealed: number; nextDonkeyPayout: MoneyValue | null; activePlayerId: string;
  phase: PublicPhase; deadline: number | null; lastTrade: PublicTrade | null }
export interface RoomView { status: RoomStatus; roomId: string; roomName: string; hostId: string; settings: Settings; players: PublicPlayer[];
  game: GameView | null; log: LogEntry[]; scores: ScoreRow[] | null; closeAt: number | null }
export interface MeView { id: string; money: MoneyCard[]; offer: MoneyCard[] | null; buyEnabled: boolean | null;
  tradeReveal: TradeReveal | null; payment: PaymentRecord | null }
export interface View { serverTime: number; me: MeView | null; room: RoomView | null }

const MAX_RAW = 4096;
type Obj = Record<string, unknown>;

const str = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.length >= min && v.length <= max;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const idList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 60 && v.every((x) => str(x, 0, 64));

export function parseClientMessage(raw: string): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_RAW) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const m = v as Obj;
  switch (m.type) {
    case "hello":
      return str(m.clientToken, 1, 64) ? { type: "hello", clientToken: m.clientToken } : null;
    case "createRoom":
      return str(m.roomName, 0, 100) && str(m.playerName, 0, 100)
        ? { type: "createRoom", roomName: m.roomName, playerName: m.playerName } : null;
    case "updateSettings":
      return (m.moneyRule === undefined || oneOf(m.moneyRule, ["swap", "loserTakesBoth"] as const))
          && (m.decisionSeconds === undefined || num(m.decisionSeconds))
        ? { type: "updateSettings", moneyRule: m.moneyRule as Settings["moneyRule"] | undefined, decisionSeconds: m.decisionSeconds as Settings["decisionSeconds"] | undefined }
        : null;
    case "joinRoom":
      return str(m.roomId, 0, 20) && str(m.playerName, 0, 100)
        ? { type: "joinRoom", roomId: m.roomId, playerName: m.playerName } : null;
    case "leaveSeat": case "startGame": case "pass": case "pause": case "resume": case "closeRoom": case "playAgain": case "imBack":
      return { type: m.type };
    case "removePlayer":
      return str(m.playerId, 0, 64) ? { type: "removePlayer", playerId: m.playerId } : null;
    case "chooseAction":
      return oneOf(m.action, ["auction", "cowTrade"] as const) ? { type: "chooseAction", action: m.action } : null;
    case "bid":
      return num(m.amount) ? { type: "bid", amount: m.amount } : null;
    case "auctioneerDecision":
      return oneOf(m.decision, ["sell", "buy"] as const) ? { type: "auctioneerDecision", decision: m.decision } : null;
    case "pay": case "cowTradeResponse":
      return idList(m.cardIds) ? { type: m.type, cardIds: [...m.cardIds] } : null;
    case "cowTradeOffer":
      return str(m.targetId, 0, 64) && oneOf(m.animal, ANIMALS) && num(m.count) && idList(m.cardIds)
        ? { type: "cowTradeOffer", targetId: m.targetId, animal: m.animal, count: m.count, cardIds: [...m.cardIds] } : null;
    default:
      return null;
  }
}
