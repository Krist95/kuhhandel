import type { PublicPlayer } from "../../../src/protocol";
import { tradeableAnimals } from "../../../src/rules/herd";
import { ANIMALS, type Animal, type Herd } from "../../../src/rules/types";
import { railOrder } from "./layout";

export interface LedgerEntry { animal: Animal; count: number; set: boolean }
export interface BoardRow { player: PublicPlayer; me: boolean; sets: number; tradeable: Animal[] }

export function ledger(herd: Herd): LedgerEntry[] {
  return ANIMALS.map((animal) => ({ animal, count: herd[animal], set: herd[animal] === 4 }));
}

export function podBadge(p: PublicPlayer, isHost: boolean): "Offline" | "Away" | "Out" | "Host" | null {
  if (!p.connected) return "Offline";
  if (p.away) return "Away";
  if (p.out) return "Out";
  return isHost ? "Host" : null;
}

export function deckLeft(players: readonly PublicPlayer[]): Record<Animal, number> {
  const left = {} as Record<Animal, number>;
  for (const a of ANIMALS) left[a] = 4 - players.reduce((n, p) => n + p.herd[a], 0);
  return left;
}

export function boardRows(players: readonly PublicPlayer[], meId: string): BoardRow[] {
  const me = players.find((p) => p.id === meId);
  const row = (player: PublicPlayer, isMe: boolean): BoardRow => ({
    player,
    me: isMe,
    sets: ANIMALS.filter((a) => player.herd[a] === 4).length,
    tradeable: !isMe && me && !player.out ? tradeableAnimals(me.herd, player.herd) : [],
  });
  return [...(me ? [row(me, true)] : []), ...railOrder(players, meId).map((p) => row(p, false))];
}
