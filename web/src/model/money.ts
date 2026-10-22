import { ANIMALS, type Animal, type Herd } from "../../../src/rules/types";

export function moneySummary(values: readonly number[]): string {
  if (values.length === 0) return "No money";
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const parts = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([v, n]) => `${v}×${n}`);
  return `${parts.join(" · ")} · Total ${values.reduce((a, b) => a + b, 0)}`;
}

export function herdChips(herd: Herd): { animal: Animal; count: number; complete: boolean }[] {
  return ANIMALS.filter((a) => herd[a] > 0).map((animal) => ({ animal, count: herd[animal], complete: herd[animal] === 4 }));
}
