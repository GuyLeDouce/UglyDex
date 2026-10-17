import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { packageMigrations } from '../scripts/package-migrations.mjs';
import manifest from '../prisma/migration-bytes.json';

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'uglydex-migration-bytes-'));
  roots.push(root);
  await mkdir(join(root, 'prisma'));
  await cp('prisma/migrations', join(root, 'prisma/migrations'), {
    recursive: true,
  });
  await cp(
    'prisma/migration-bytes.json',
    join(root, 'prisma/migration-bytes.json'),
  );
  // Model a fresh Linux checkout, independent of this machine's core.autocrlf.
  for (const name of Object.keys(manifest)) {
    const path = join(root, 'prisma/migrations', name, 'migration.sql');
    await writeFile(
      path,
      (await readFile(path, 'utf8')).replaceAll('\r\n', '\n'),
    );
  }
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
describe('historical migration byte packaging', () => {
  it.each(['production', 'staging'] as const)(
    'reproduces every reviewed %s checksum from LF source, idempotently',
    async (profile) => {
      const root = await fixture();
      const expected = Object.entries(manifest).map(([name, hashes]) => ({
        name,
        sha256: hashes[profile],
      }));
      expect(await packageMigrations(root, profile)).toEqual(expected);
      expect(await packageMigrations(root, profile)).toEqual(expected);
      for (const [name, hashes] of Object.entries(manifest)) {
        const bytes = await readFile(
          join(root, 'prisma/migrations', name, 'migration.sql'),
        );
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          hashes[profile],
        );
        expect(
          createHash('sha256')
            .update(bytes.toString().replaceAll('\r\n', '\n'))
            .digest('hex'),
        ).toBe(hashes.source);
      }
    },
  );
  it('rejects changed SQL before changing any files', async () => {
    const root = await fixture();
    const names = Object.keys(manifest);
    const first = join(root, 'prisma/migrations', names[0], 'migration.sql');
    const original = await readFile(first);
    await writeFile(
      join(root, 'prisma/migrations', names.at(-1)!, 'migration.sql'),
      'SELECT 1;\n',
    );
    await expect(packageMigrations(root, 'staging')).rejects.toThrow(
      'MIGRATION_BYTES_UNREVIEWED',
    );
    expect(await readFile(first)).toEqual(original);
  });
  it('rejects unknown profiles and unreviewed migrations', async () => {
    const root = await fixture();
    await expect(packageMigrations(root, 'other')).rejects.toThrow(
      'MIGRATION_BYTE_PROFILE_REQUIRED',
    );
    await mkdir(join(root, 'prisma/migrations/unreviewed'));
    await expect(packageMigrations(root, 'staging')).rejects.toThrow(
      'MIGRATION_BYTE_MANIFEST_INCOMPLETE',
    );
  });
});
