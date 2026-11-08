import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const artworkDirectory = fileURLToPath(
  new URL('../public/icons/sets/', import.meta.url),
);
const previewDirectory = fileURLToPath(
  new URL('../public/icons/sets-preview/', import.meta.url),
);
await mkdir(previewDirectory, { recursive: true });
const files = (await readdir(artworkDirectory))
  .filter((name) => name.endsWith('.png'))
  .sort();

if (files.length !== 52) {
  throw new Error(
    `Expected 52 approved set icons, found ${files.length}; refusing partial or mismapped conversion.`,
  );
}

let updated = 0;
for (const name of files) {
  const imagePath = path.join(artworkDirectory, name);
  const original = await readFile(imagePath);
  const before = await sharp(original).metadata();
  if (before.format !== 'png' || before.width !== before.height) {
    throw new Error(
      `Unexpected source artwork for ${name}: ${before.width}x${before.height} ${before.format}`,
    );
  }

  let large = original;
  if (before.width !== 1500 || before.height !== 1500) {
    if (before.width > 1500 || before.height > 1500) {
      throw new Error(`Refusing to shrink approved artwork ${name}`);
    }
    large = await sharp(original)
      .resize({
        width: 1500,
        height: 1500,
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    await writeFile(imagePath, large);
    updated += 1;
  }

  const preview = await sharp(large)
    .resize({
      width: 128,
      height: 128,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(previewDirectory, name), preview);
}

console.log(
  `Approved set artwork: ${files.length} full-size 1500px files; ${files.length} compact previews; newly upscaled: ${updated}`,
);
