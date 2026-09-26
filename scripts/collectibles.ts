import 'dotenv/config';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { db } from '../src/server/db';
import {
  importCollectibles,
  exportCollectibles,
} from '../src/server/collectibles';
import { verifyCollectibles } from '../src/server/collectibles-verify';
import { safeOperationalCode } from '../src/domain/operations';
import { assertOperation } from '../src/server/deployment';
import { collectibleManifest } from '../src/domain/collectibles';
import { inspectCollectibleArtwork } from '../src/server/collectible-art';
const [command, ...args] = process.argv.slice(2);
const value = (flag: string) => args[args.indexOf(flag) + 1];
try {
  for (let i = 0; i < args.length; i++) {
    if (['--reviewed', '--validate-only'].includes(args[i])) continue;
    if (!['--file', '--kind'].includes(args[i]) || !args[++i])
      throw new Error('INVALID_ARGUMENT');
  }
  if (command === 'verify') {
    const checks = await verifyCollectibles({ artwork: true });
    for (const c of checks) console.log(`${c.status} ${c.name}: ${c.detail}`);
    if (checks.some((c) => c.status === 'FAIL')) process.exitCode = 1;
  } else if (command === 'export') {
    const kind = z.enum(['CUSTOM', 'EDITION']).parse(value('--kind'));
    if (!args.includes('--file')) throw new Error('FILE_REQUIRED');
    await writeFile(
      value('--file'),
      JSON.stringify(await exportCollectibles(kind), null, 2) + '\n',
      { flag: 'wx' },
    );
    console.log('Catalog exported; existing files are never overwritten.');
  } else if (command === 'customs' || command === 'editions') {
    if (!args.includes('--file')) throw new Error('FILE_REQUIRED');
    const file = value('--file');
    if ((await stat(file)).size > 1000000)
      throw new Error('MANIFEST_TOO_LARGE');
    const input = JSON.parse(await readFile(file, 'utf8'));
    if (input.kind !== (command === 'customs' ? 'CUSTOM' : 'EDITION'))
      throw new Error('WRONG_MANIFEST_KIND');
    const manifest = collectibleManifest.parse(input);
    if (manifest.records.some((r) => !r.imageSha256))
      throw new Error('MANIFEST_HASH_REQUIRED');
    if (args.includes('--validate-only')) {
      for (const r of manifest.records)
        if (
          (await inspectCollectibleArtwork(r.imageUri)).sha256 !== r.imageSha256
        )
          throw new Error('MANIFEST_ARTWORK_HASH_MISMATCH');
      console.log(
        'PASS schema and artwork hashes; no catalog writes; review references and preview before publication',
      );
    } else {
      await assertOperation('collectibles');
      if (
        manifest.records.some((r) => r.status === 'VERIFIED') &&
        !args.includes('--reviewed')
      )
        throw new Error('OFFICIAL_REVIEW_REQUIRED');
      console.log(
        JSON.stringify(await importCollectibles(input, 'cli:operator')),
      );
    }
  } else throw new Error('UNKNOWN_COMMAND');
} catch (error) {
  console.error(safeOperationalCode(error));
  process.exitCode = 1;
} finally {
  await db().$disconnect();
}
