import 'dotenv/config';
import { readEnv } from '../src/server/env';
import { db } from '../src/server/db';
import { closeExternalPools } from '../src/integrations/read-only';
import { runFeed, syncIdentities } from '../src/sync/run';
import { syncSquigs } from '../src/sync/squigs';
import { syncOwnership, syncTransfers } from '../src/sync/blockchain';
import { log } from '../src/server/log';
const jobs: Record<string, (() => Promise<{ failed: number }>)[]> = {
  identities: [syncIdentities],
  squigs: [syncSquigs],
  uglybot: [
    'duels',
    'marketplace',
    'purchases',
    'bounty',
    'maw',
    'claimEvents',
  ].map((feed) => () => runFeed(feed as Parameters<typeof runFeed>[0])),
  gauntlet: [() => runFeed('runs'), () => runFeed('survival')],
  images: [() => runFeed('submissions')],
  ownership: [syncOwnership],
  transfers: [syncTransfers],
};
// Explicit blockchain opt-in: never unexpectedly start a full-chain scan.
jobs.all = [
  ...jobs.identities,
  ...jobs.squigs,
  ...jobs.uglybot,
  ...jobs.gauntlet,
  ...jobs.images,
];
try {
  readEnv();
  const selected = jobs[process.argv[2]];
  if (!selected) throw new Error('UNKNOWN_SYNC');
  for (const job of selected) {
    try {
      const result = await job();
      if (result.failed) process.exitCode = 1;
    } catch {
      log('sync.failed');
      process.exitCode = 1;
    }
  }
} catch {
  log('sync.configuration_failed');
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db()
    .$disconnect()
    .catch(() => undefined);
}
