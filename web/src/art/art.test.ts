import { expect, it } from "vitest";
import { ANIMALS } from "../../../src/rules/types";
import { ANIMAL_COLOR } from "./index";

const animals = import.meta.glob("./animals/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const notes = import.meta.glob("./money/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const VALUES = [0, 10, 50, 100, 200, 500];
it("has one SVG per animal and per money value", () => {
  expect(Object.keys(animals).sort()).toEqual(ANIMALS.map((a) => `./animals/${a}.svg`).sort());
  expect(Object.keys(notes).sort()).toEqual(VALUES.map((v) => `./money/note-${v}.svg`).sort());
});
it("keeps every animal flat, outlined, self-contained and small", () => {
  for (const [file, svg] of Object.entries(animals)) {
    expect(svg, file).toContain('viewBox="0 0 100 100"');
    expect(svg, file).toMatch(/stroke="#1E1E1E"/i);
    expect(svg, file).not.toMatch(/<(image|script|text|linearGradient|radialGradient|filter)\b|href="http/i);
    expect(svg.length, file).toBeLessThan(6_000);
  }
});
it("gives every animal a distinct colour", () => expect(new Set(Object.values(ANIMAL_COLOR)).size).toBe(10));
it("prints each value on its note", () => { for (const v of VALUES) expect(notes[`./money/note-${v}.svg`]).toContain(`>${v}<`); });
