import 'dotenv/config';
import { spawn } from 'node:child_process';
if (!process.env.DATABASE_URL) {
  console.error(
    'UglyDex startup failed: DATABASE_URL is required (UglyDex-owned PostgreSQL).',
  );
  process.exit(1);
}
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid PORT');
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '-H',
    '0.0.0.0',
    '-p',
    String(port),
  ],
  { stdio: 'inherit', env: process.env },
);
// Opt-in background import; serving and readiness do not wait for 4,444 images.
const artwork =
  process.env.ARTWORK_WARM_ON_START === 'true'
    ? spawn(
        process.execPath,
        [
          'node_modules/tsx/dist/cli.mjs',
          '--conditions=react-server',
          'scripts/warm-artwork.ts',
        ],
        { stdio: 'inherit', env: process.env },
      )
    : null;
artwork?.on('error', () => console.error('Artwork importer could not start.'));
// Derived Field Guides only: no upstream imports, profile creation or migrations.
const collectionsEnabled =
  process.env.COLLECTIONS_RECALCULATE_ON_START === 'true' ||
  (process.env.APP_ENV === 'staging' &&
    process.env.COLLECTIONS_RECALCULATE_ON_START !== 'false');
const collections = collectionsEnabled
  ? spawn(
      process.execPath,
      [
        'node_modules/tsx/dist/cli.mjs',
        '--conditions=react-server',
        'scripts/collection-startup.ts',
      ],
      { stdio: 'inherit', env: process.env },
    )
  : null;
collections?.on('error', () =>
  console.error('Field Guide recalculation could not start.'),
);
collections?.on('exit', (code) => {
  if (code)
    console.error(
      'Field Guide recalculation paused; inspect collection diagnostics.',
    );
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    artwork?.kill(signal);
    collections?.kill(signal);
    child.kill(signal);
  });
child.on('exit', (code) => {
  artwork?.kill('SIGTERM');
  collections?.kill('SIGTERM');
  process.exit(code ?? 1);
});
