import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const artworkDirectory = fileURLToPath(
  new URL('../public/icons/sets/', import.meta.url),
);
const cardDirectory = fileURLToPath(
  new URL('../public/icons/sets-card/', import.meta.url),
);
await mkdir(cardDirectory, { recursive: true });
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

for (const name of files) {
  const imagePath = path.join(artworkDirectory, name);
  const original = await readFile(imagePath);
  const before = await sharp(original).metadata();
  if (before.format !== 'png' || before.width !== before.height) {
    throw new Error(
      `Unexpected source artwork for ${name}: ${before.width}x${before.height} ${before.format}`,
    );
  }

  if (before.width !== 1500 || before.height !== 1500) {
    throw new Error(
      `Expected approved 1500x1500 original for ${name}; originals are never resized or overwritten.`,
    );
  }

  const preview = await sharp(original)
    .resize({
      width: 128,
      height: 128,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(previewDirectory, name), preview);

  const cardPreview = await sharp(original)
    .resize({
      width: 512,
      height: 512,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(cardDirectory, name), cardPreview);
}

console.log(
  `Approved set artwork: ${files.length} untouched 1500px originals; ${files.length} compact previews; ${files.length} album card previews`,
);
