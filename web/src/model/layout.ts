import type { PublicPlayer } from "../../../src/protocol";

/** Opponents clockwise by seat, starting after you; you are excluded. */
export function railOrder(players: readonly PublicPlayer[], meId: string): PublicPlayer[] {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const at = sorted.findIndex((p) => p.id === meId);
  if (at < 0) return sorted;
  return [...sorted.slice(at + 1), ...sorted.slice(0, at)];
}
