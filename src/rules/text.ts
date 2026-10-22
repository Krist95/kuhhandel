import { ANIMAL_NAME, type Animal } from "./types";

export function animalsText(count: number, animal: Animal): string {
  return `${count} ${ANIMAL_NAME[animal][count === 1 ? 0 : 1]}`;
}

export function cardsText(n: number): string {
  return `${n} ${n === 1 ? "card" : "cards"}`;
}
