// Renders the SVG app icons to the PNG sizes that iOS / Android launchers need.
// Run: npm run icons
import sharp from "sharp";
import { readFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "icons");

const jobs = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon-maskable.svg", "icon-maskable-192.png", 192],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
  ["icon.svg", "apple-touch-icon.png", 180],
];

for (const [src, out, size] of jobs) {
  const svg = await readFile(path.join(dir, src));
  await sharp(svg, { density: Math.ceil((72 * size) / 512) * 2 })
    .resize(size, size)
    .flatten({ background: "#F4F4F0" })
    .png()
    .toFile(path.join(dir, out));
  console.log(`✓ ${out} (${size}px)`);
}

// Next.js file conventions: app/icon.svg → favicon, app/apple-icon.png → apple-touch-icon
await copyFile(path.join(dir, "icon.svg"), path.join(root, "src", "app", "icon.svg"));
await copyFile(path.join(dir, "apple-touch-icon.png"), path.join(root, "src", "app", "apple-icon.png"));
console.log("✓ app/icon.svg, app/apple-icon.png");
