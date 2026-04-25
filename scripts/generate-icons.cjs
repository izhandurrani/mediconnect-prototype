/**
 * Generate MediConnect PWA icons using sharp.
 * Run: node scripts/generate-icons.js
 */
const sharp = require("sharp");
const path = require("path");

function svgIcon(size) {
  const r = Math.round(size * 0.18); // corner radius
  const crossW = Math.round(size * 0.13); // cross bar thickness
  const crossL = Math.round(size * 0.48); // cross bar length
  const crossR = Math.round(crossW / 2);  // cross bar corner radius
  const cx = size / 2;
  const cy = size / 2;

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#1A3C6E"/>
  <rect x="${cx - crossL / 2}" y="${cy - crossW / 2}" width="${crossL}" height="${crossW}" rx="${crossR}" ry="${crossR}" fill="white"/>
  <rect x="${cx - crossW / 2}" y="${cy - crossL / 2}" width="${crossW}" height="${crossL}" rx="${crossR}" ry="${crossR}" fill="white"/>
</svg>`;
}

async function generate(size, outputName) {
  const outPath = path.join(__dirname, "..", "public", "icons", outputName);
  await sharp(Buffer.from(svgIcon(size))).png().toFile(outPath);
  console.log(`✓ ${outPath} (${size}x${size})`);
}

(async () => {
  await generate(192, "icon-192.png");
  await generate(512, "icon-512.png");
  console.log("Done!");
})();
