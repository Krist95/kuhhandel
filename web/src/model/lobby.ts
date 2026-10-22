import type { PublicPlayer } from "../../../src/protocol";
import { ERROR_TEXT } from "../../../src/rules/errors";

export interface RoomFormValues { roomName: string; roomId: string; password: string; playerName: string; seat: number | null }

const PASSWORD_KEY = "kuhhandel.password";
const len = (s: string): number => [...s].length;
const within = (s: string, min: number, max: number): boolean => len(s) >= min && len(s) <= max;

export function normalizeRoomId(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function formProblems(f: RoomFormValues, mode: "create" | "join"): string[] {
  const out: string[] = [];
  if (mode === "create") {
    if (!within(f.roomName.trim(), 1, 24)) out.push(ERROR_TEXT.badRoomName);
  } else if (normalizeRoomId(f.roomId) === "") out.push(ERROR_TEXT.badCredentials);
  if (!within(f.password, 1, 64)) out.push(ERROR_TEXT.badPassword);
  if (!within(f.playerName.trim(), 1, 16)) out.push(ERROR_TEXT.badName);
  if (f.seat === null || !Number.isInteger(f.seat) || f.seat < 1 || f.seat > 5) out.push(ERROR_TEXT.badSeat);
  return out;
}

export function shareText(roomId: string, password: string, url: string): string {
  return `Join my Kuhhandel game: ${url}\nRoom ID: ${roomId}\nPassword: ${password}`;
}

export function savePassword(store: Pick<Storage, "setItem"> | null, password: string): void {
  try { store?.setItem(PASSWORD_KEY, password); } catch { /* storage unavailable */ }
}

export function savedPassword(store: Pick<Storage, "getItem"> | null): string | null {
  try { return store?.getItem(PASSWORD_KEY) ?? null; } catch { return null; }
}

export function lobbySeats(players: readonly PublicPlayer[]): (PublicPlayer | null)[] {
  const seats: (PublicPlayer | null)[] = [null, null, null, null, null];
  for (const p of players) if (p.seat >= 1 && p.seat <= 5) seats[p.seat - 1] = p;
  return seats;
}
