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
