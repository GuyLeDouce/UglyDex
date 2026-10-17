import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Reproduce reviewed historical bytes, never change a migration ledger or SQL.
export async function packageMigrations(root, profile) {
  if (!['production', 'staging'].includes(profile))
    throw new Error('MIGRATION_BYTE_PROFILE_REQUIRED');
  const manifest = JSON.parse(
    await readFile(resolve(root, 'prisma/migration-bytes.json'), 'utf8'),
  );
  const directory = resolve(root, 'prisma/migrations');
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(manifest).sort()))
    throw new Error('MIGRATION_BYTE_MANIFEST_INCOMPLETE');
  const prepared = await Promise.all(
    names.map(async (name) => {
      const file = resolve(directory, name, 'migration.sql');
      const bytes = await readFile(file);
      const expected = manifest[name];
      if (
        ![expected.source, expected.production, expected.staging].includes(
          digest(bytes),
        )
      )
        throw new Error(`MIGRATION_BYTES_UNREVIEWED: ${name}`);
      const lf = bytes.toString('utf8').replaceAll('\r\n', '\n');
      if (digest(lf) !== expected.source)
        throw new Error(`MIGRATION_SOURCE_MISMATCH: ${name}`);
      const output = Buffer.from(
        expected[profile] === expected.source
          ? lf
          : lf.replaceAll('\n', '\r\n'),
      );
      if (digest(output) !== expected[profile])
        throw new Error(`MIGRATION_PROFILE_MISMATCH: ${name}`);
      return { file, output, name, sha256: digest(output) };
    }),
  );
  // Validate every input before writing any output. Repeated packaging is safe.
  for (const item of prepared) await writeFile(item.file, item.output);
  return prepared.map(({ name, sha256 }) => ({ name, sha256 }));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const profile = process.argv[process.argv.indexOf('--profile') + 1];
  const migrations = await packageMigrations(process.cwd(), profile);
  const commit =
    process.env.APP_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';
  await writeFile(
    'release-manifest.json',
    JSON.stringify(
      { commit, migrationByteProfile: profile, migrations },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Packaged ${migrations.length} migrations using reviewed ${profile} bytes`,
  );
}
