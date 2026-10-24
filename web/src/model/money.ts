import { ANIMALS, type Animal, type Herd } from "../../../src/rules/types";

/** Hand note width and gap, in canvas px (table.css `.kh-hand .kh-note`, `.kh-hand .money`). */
const NOTE_W = 56;
const NOTE_GAP = 4;
/** At least this much of each note stays visible, so each one can still be tapped. */
const MIN_VISIBLE = 22;

/**
 * Negative left margin for every note after the first so that `n` notes fit in `available` px.
 * Capped so `MIN_VISIBLE` px of each note shows; past that the row scrolls.
 */
export function noteOverlap(n: number, available: number): { overlap: number; scroll: boolean } {
  if (n < 2) return { overlap: 0, scroll: false };
  const need = (n * NOTE_W + (n - 1) * NOTE_GAP - available) / (n - 1);
  const max = NOTE_W + NOTE_GAP - MIN_VISIBLE;
  if (need <= 0) return { overlap: 0, scroll: false };
  return need > max ? { overlap: max, scroll: true } : { overlap: need, scroll: false };
}

export function herdChips(herd: Herd): { animal: Animal; count: number; complete: boolean }[] {
  return ANIMALS.filter((a) => herd[a] > 0).map((animal) => ({ animal, count: herd[animal], complete: herd[animal] === 4 }));
}
