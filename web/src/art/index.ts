import type { Animal, MoneyValue } from "../../../src/rules/types";
import cat from "./animals/cat.svg";
import cow from "./animals/cow.svg";
import dog from "./animals/dog.svg";
import donkey from "./animals/donkey.svg";
import goat from "./animals/goat.svg";
import goose from "./animals/goose.svg";
import horse from "./animals/horse.svg";
import pig from "./animals/pig.svg";
import rooster from "./animals/rooster.svg";
import sheep from "./animals/sheep.svg";
import cardBack from "./card-back.svg";
import note0 from "./money/note-0.svg";
import note10 from "./money/note-10.svg";
import note50 from "./money/note-50.svg";
import note100 from "./money/note-100.svg";
import note200 from "./money/note-200.svg";
import note500 from "./money/note-500.svg";

export const ANIMAL_COLOR: Record<Animal, string> = {
  rooster: "#D7443E", goose: "#4A9BE0", cat: "#8A56B8", dog: "#9C6B3F", sheep: "#E6DFCB",
  goat: "#7A9A2E", donkey: "#6E7B8B", pig: "#EC8DB4", cow: "#1F9E8F", horse: "#E8B230",
};

// Vite asset URLs for the original artwork (head-and-shoulders portraits drawn on the ANIMAL_COLOR frame).
export const ANIMAL_ART: Record<Animal, string> = { rooster, goose, cat, dog, sheep, goat, donkey, pig, cow, horse };
export const NOTE_ART: Record<MoneyValue, string> = { 0: note0, 10: note10, 50: note50, 100: note100, 200: note200, 500: note500 };
// Face-down money card, shown for offers whose values are hidden.
export const CARD_BACK: string = cardBack;
