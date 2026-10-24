// Minimal ambient typing so tokens.test.ts can read the stylesheet from disk
// (vitest blanks `.css?raw`, and web/tsconfig has no @types/node).
declare module "node:fs" {
  export function readFileSync(path: URL, encoding: "utf8"): string;
}
