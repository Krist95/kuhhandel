import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import tokensJson from "../../../docs/design/kuhhandel-table/tokens.json?raw";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

type Tok = { name: string; value: string };
const t = JSON.parse(tokensJson) as {
  color: { tokens: Tok[] }; spacing: { tokens: Tok[] }; radius: { tokens: Tok[] }; shadow: { tokens: Tok[] };
  type: { families: { sans: string } };
};

describe("tokens.css", () => {
  for (const group of ["color", "spacing", "radius", "shadow"] as const) {
    for (const { name, value } of t[group].tokens) {
      it(`defines --${name}`, () => expect(css).toContain(`--${name}:${value};`));
    }
  }
  it("defines --font-sans", () => expect(css).toContain(`--font-sans:${t.type.families.sans};`));
});
