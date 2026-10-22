import { ANIMAL_VALUE, type Animal, type Herd, type ScoreRow } from "./types";
import { completeSets } from "./herd";

export function scoreHerd(h: Herd): { sets: Animal[]; setValue: number; multiplier: number; score: number } {
  const sets = completeSets(h);
  const setValue = sets.reduce((n, a) => n + ANIMAL_VALUE[a], 0);
  return { sets, setValue, multiplier: sets.length, score: setValue * sets.length };
}

export function rankPlayers(rows: readonly { playerId: string; herd: Herd }[]): ScoreRow[] {
  const scored = rows
    .map((r) => ({ playerId: r.playerId, ...scoreHerd(r.herd) }))
    .sort((x, y) => y.score - x.score || y.sets.length - x.sets.length);
  return scored.map((r) => {
    const first = scored.findIndex((o) => o.score === r.score && o.sets.length === r.sets.length);
    const rank = first + 1;
    return { ...r, rank, winner: rank === 1 };
  });
}
