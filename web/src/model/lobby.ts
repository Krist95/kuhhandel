import type { PublicPlayer } from "../../../src/protocol";
import { ERROR_TEXT } from "../../../src/rules/errors";

export interface RoomFormValues { roomName: string; playerName: string; moneyRule: "swap" | "loserTakesBoth"; decisionSeconds: number }

const len = (s: string): number => [...s].length;
const within = (s: string, min: number, max: number): boolean => len(s) >= min && len(s) <= max;

export function normalizeRoomId(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function formProblems(f: RoomFormValues, mode: "create"): string[] {
  const out: string[] = [];
  if (mode === "create" && !within(f.roomName.trim(), 1, 24)) out.push(ERROR_TEXT.badRoomName);
  if (!within(f.playerName.trim(), 1, 24)) out.push(ERROR_TEXT.badName);
  return out;
}

export function nameProblem(playerName: string): string | null {
  return within(playerName.trim(), 1, 24) ? null : ERROR_TEXT.badName;
}

export function shareText(roomId: string, url: string): string {
  return `Join my Kuhhandel game: ${url}\nRoom ID: ${roomId}`;
}

export function lobbySeats(players: readonly PublicPlayer[]): (PublicPlayer | null)[] {
  const seats: (PublicPlayer | null)[] = [null, null, null, null, null];
  for (const p of players) if (p.seat >= 1 && p.seat <= 5) seats[p.seat - 1] = p;
  return seats;
}
