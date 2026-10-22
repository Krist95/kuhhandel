import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";

const svg = readFileSync("web/src/art/icon.svg");
const out = "web/public/icons";
mkdirSync(out, { recursive: true });
const render = (size) => sharp(svg, { density: Math.ceil((72 * size) / 512) * 4 }).resize(size, size).png();

await render(192).toFile(`${out}/icon-192.png`);
await render(512).toFile(`${out}/icon-512.png`);
await render(180).toFile(`${out}/apple-touch-icon.png`);
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#16352A" } })
  .composite([{ input: await render(410).toBuffer(), gravity: "centre" }])
  .png().toFile(`${out}/maskable-512.png`);
console.log("icons written to", out);
