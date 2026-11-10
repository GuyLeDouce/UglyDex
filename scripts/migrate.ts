import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { safeOperationalCode } from '../src/domain/operations';
import { readEnv } from '../src/server/env';
import { db } from '../src/server/db';
import { migrateMasteryScores } from '../src/server/mastery-migration';
import { importInitialCustoms } from '../src/server/customs-bootstrap';
// Validates own-vs-external database separation before invoking Prisma.
readEnv();
const result = spawnSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  { stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;

if (process.exitCode === 0) {
  try {
    console.log(
      JSON.stringify({
        event: 'collections.mastery_migration',
        ...(await migrateMasteryScores()),
      }),
    );
    console.log(
      JSON.stringify({
        event: 'customs.initial_import',
        ...(await importInitialCustoms()),
      }),
    );
  } catch (error) {
    console.error(
      'POST_MIGRATION_BOOTSTRAP_FAILED',
      safeOperationalCode(error),
    );
    process.exitCode = 1;
  } finally {
    await db().$disconnect();
  }
}
