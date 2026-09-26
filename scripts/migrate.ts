import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { readEnv } from '../src/server/env';
// Validates own-vs-external database separation before invoking Prisma.
readEnv();
const result = spawnSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  { stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;
