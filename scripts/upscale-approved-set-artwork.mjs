import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const artworkDirectory = fileURLToPath(new URL('../public/icons/sets/', import.meta.url));
const files = (await readdir(artworkDirectory)).filter((name) => name.endsWith('.png')).sort();

if (files.length !== 52) {
  throw new Error(`Expected 52 approved set icons, found ${files.length}; refusing a partial or mismapped conversion.`);
}

let updated = 0;
for (const name of files) {
  const imagePath = path.join(artworkDirectory, name);
  const original = await readFile(imagePath);
  const before = await sharp(original).metadata();
  if (before.format !== 'png' || before.width !== before.height) {
    throw new Error(`Unexpected source artwork for ${name}: ${before.width}x${before.height} ${before.format}`);
  }

  if (before.width === 1500 && before.height === 1500) continue;
  if (before.width > 1500 || before.height > 1500) {
    throw new Error(`Refusing to shrink approved artwork ${name}`);
  }

  const enlarged = await sharp(original)
    .resize({ width: 1500, height: 1500, fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  const after = await sharp(enlarged).metadata();
  if (after.width !== 1500 || after.height !== 1500 || after.format !== 'png') {
    throw new Error(`Invalid generated art for ${name}`);
  }
  await writeFile(imagePath, enlarged);
  updated += 1;
  console.log(`${name}: ${before.width}x${before.height} -> 1500x1500`);
}
console.log(`Approved collection-set artwork checked: ${files.length}; upscaled: ${updated}`);
