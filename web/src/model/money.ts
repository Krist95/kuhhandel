import { ANIMALS, type Animal, type Herd } from "../../../src/rules/types";

export function herdChips(herd: Herd): { animal: Animal; count: number; complete: boolean }[] {
  return ANIMALS.filter((a) => herd[a] > 0).map((animal) => ({ animal, count: herd[animal], complete: herd[animal] === 4 }));
}
