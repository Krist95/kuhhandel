import { ANIMALS, type Animal, type Herd } from "./types";

export function emptyHerd(): Herd {
  return Object.fromEntries(ANIMALS.map((a) => [a, 0])) as Herd;
}
export function herdOf(partial: Partial<Herd>): Herd {
  return { ...emptyHerd(), ...partial };
}
export function totalAnimals(h: Herd): number {
  return ANIMALS.reduce((n, a) => n + h[a], 0);
}
export function tradeableAnimals(a: Herd, b: Herd): Animal[] {
  return ANIMALS.filter((x) => a[x] >= 1 && b[x] >= 1 && a[x] !== 4 && b[x] !== 4);
}
export function maxTradeCount(a: Herd, b: Herd, animal: Animal): 1 | 2 {
  return a[animal] >= 2 && b[animal] >= 2 ? 2 : 1;
}
export function completeSets(h: Herd): Animal[] {
  return ANIMALS.filter((a) => h[a] === 4);
}
