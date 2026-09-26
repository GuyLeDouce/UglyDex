import 'dotenv/config';
import { z } from 'zod';
import { runWorker } from '../src/server/worker-runtime';
import { db } from '../src/server/db';
import {
  seedCollections,
  rebuildCollection,
  processCollections,
  queueCollections,
} from '../src/server/dex-engine';
import {
  COLLECTION_RULESET as R,
  evaluateSet,
  completion,
} from '../src/domain/dex';
import {
  collectionSets,
  canonicalTokens,
  traitCatalog,
  verifyCatalog,
} from '../src/domain/dex-catalog';
const [command, ...args] = process.argv.slice(2);
try {
  if (!['seed', 'rebuild', 'worker', 'verify'].includes(command))
    throw new Error('INVALID_COMMAND');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--collector' && command === 'rebuild' && args[i + 1]) {
      z.uuid().parse(args[++i]);
      continue;
    }
    if (
      (args[i] === '--restart' && command === 'rebuild') ||
      (args[i] === '--once' && command === 'worker')
    )
      continue;
    throw new Error('INVALID_ARGUMENT');
  }
  if (command === 'verify') {
    const errors = verifyCatalog();
    for (const s of collectionSets) {
      const a = evaluateSet(s, canonicalTokens),
        b = evaluateSet(s, [...canonicalTokens].reverse());
      if (!a.complete) errors.push(`${s.key}:IMPOSSIBLE`);
      if (JSON.stringify(a) !== JSON.stringify(b))
        errors.push(`${s.key}:NONDETERMINISTIC`);
    }
    if (
      completion(4444, traitCatalog.length, traitCatalog.length, 1, 1)
        .overall !== 100
    )
      errors.push('DENOMINATOR');
    console.log(
      JSON.stringify({
        event: 'collections.verified',
        ruleset: R,
        traits: traitCatalog.length,
        sets: collectionSets.length,
        errors,
      }),
    );
    if (errors.length) process.exitCode = 1;
  } else {
    if (command !== 'worker') await seedCollections();
    if (command === 'seed')
      console.log(JSON.stringify({ event: 'collections.seeded', ruleset: R }));
    if (command === 'rebuild') {
      const i = args.indexOf('--collector');
      if (i >= 0)
        console.log(JSON.stringify(await rebuildCollection(args[i + 1])));
      else {
        const p = await db().collectionReplay.findUnique({ where: { id: R } });
        if (args.includes('--restart') || p?.completedAt)
          await queueCollections(true);
        while (!(await queueCollections()))
          console.log(JSON.stringify({ event: 'collections.enqueue' }));
        while (await db().collectionJob.count({ where: { errorCode: null } })) {
          const result = await processCollections();
          console.log(
            JSON.stringify({ event: 'collections.batch', ...result }),
          );
          if (result.failed) break;
        }
        if (await db().collectionJob.count()) throw new Error('JOBS_REMAIN');
      }
    }
    if (command === 'worker') {
      await runWorker(
        'collections',
        async (signal) => {
          await seedCollections();
          return processCollections(25, () => signal.aborted);
        },
        { once: args.includes('--once') },
      );
    }
  }
} catch {
  console.error(
    JSON.stringify({
      event: 'collections.failed',
      code: 'CHECK_COLLECTION_JOBS_AND_RUNS',
    }),
  );
  process.exitCode = 1;
} finally {
  if (command !== 'verify') await db().$disconnect();
}
