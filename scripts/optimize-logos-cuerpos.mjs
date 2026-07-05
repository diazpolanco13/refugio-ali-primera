/**
 * Redimensiona logos de cuerpos a 96×96 WebP (~2× retina para marcadores de 32–48 px).
 * Uso: node scripts/optimize-logos-cuerpos.mjs
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve("public/logos-cuerpos");
const SIZE = 96;
const QUALITY = 82;

const files = (await readdir(DIR)).filter((f) => /\.(png|jpe?g)$/i.test(f));

let before = 0;
let after = 0;

for (const file of files) {
  const input = path.join(DIR, file);
  const base = file.replace(/\.(png|jpe?g)$/i, "");
  const output = path.join(DIR, `${base}.webp`);

  const inputStat = await stat(input);
  before += inputStat.size;

  await sharp(input)
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(output);

  const outputStat = await stat(output);
  after += outputStat.size;
  console.log(`${file} → ${base}.webp  ${(inputStat.size / 1024).toFixed(1)} KB → ${(outputStat.size / 1024).toFixed(1)} KB`);
}

console.log(`\nTotal: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (−${Math.round((1 - after / before) * 100)}%)`);
