import type { PublicPlayer } from "../../../src/protocol";

export type Pos = "bottom" | "left" | "topLeft" | "top" | "topRight" | "right";

const POSITIONS: Record<number, Pos[]> = {
  3: ["bottom", "topLeft", "topRight"],
  4: ["bottom", "left", "top", "right"],
  5: ["bottom", "left", "topLeft", "topRight", "right"],
};

export function seatPositions(players: readonly { id: string; seat: number }[], meId: string): { id: string; pos: Pos }[] {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const at = Math.max(0, sorted.findIndex((p) => p.id === meId));
  const ordered = [...sorted.slice(at), ...sorted.slice(0, at)];
  const pos = POSITIONS[ordered.length] ?? POSITIONS[5];
  return ordered.map((p, i) => ({ id: p.id, pos: pos[i] }));
}

/** Opponents clockwise by seat, starting after you; you are excluded. */
export function railOrder(players: readonly PublicPlayer[], meId: string): PublicPlayer[] {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const at = sorted.findIndex((p) => p.id === meId);
  if (at < 0) return sorted;
  return [...sorted.slice(at + 1), ...sorted.slice(0, at)];
}
