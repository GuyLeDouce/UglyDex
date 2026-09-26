import 'dotenv/config';
import { z } from 'zod';
import { setTimeout as delay } from 'node:timers/promises';
import { db } from '../src/server/db';
import {
  seedProgression,
  rebuildSubject,
  processProgression,
  queueReplay,
} from '../src/server/progression-engine';
import { SQUIGS_CONTRACT } from '../src/domain/validation';
import { RULESET } from '../src/domain/progression';
const args = process.argv.slice(2),
  command = args.shift();
const value = (key: string) =>
  args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
try {
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--collector' || flag === '--squig') {
      if (command !== 'rebuild' || !args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error('INVALID_ARGUMENT');
      i++;
    } else if (!(
      (flag === '--restart' && command === 'rebuild') ||
      (flag === '--once' && command === 'worker')
    ))
      throw new Error('INVALID_ARGUMENT');
  }
  await seedProgression();
  if (command === 'seed')
    console.log(JSON.stringify({ event: 'progression.seeded' }));
  else if (command === 'worker') {
    const stop = new AbortController();
    process.once('SIGTERM', () => stop.abort());
    process.once('SIGINT', () => stop.abort());
    do {
      const result = await processProgression(50, () => stop.signal.aborted);
      console.log(JSON.stringify({ event: 'progression.cycle', ...result }));
      if (args.includes('--once') || stop.signal.aborted) break;
      await delay(15000, undefined, { signal: stop.signal }).catch(() => {});
      if (stop.signal.aborted) break;
    } while (true);
  } else if (command === 'rebuild') {
    const collector = value('--collector'),
      token = value('--squig');
    if (collector && token) throw new Error('SELECT_ONE_SUBJECT');
    if (collector)
      console.log(
        JSON.stringify(
          await rebuildSubject('COLLECTOR', z.uuid().parse(collector)),
        ),
      );
    else if (token) {
      const s = await db().squig.findUniqueOrThrow({
        where: {
          chainId_contractAddress_tokenId: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: z.coerce.number().int().min(1).max(4444).parse(token),
          },
        },
      });
      console.log(JSON.stringify(await rebuildSubject('SQUIG', s.id)));
    } else {
      const prior = await db().progressionReplay.findUnique({
        where: { id: RULESET },
      });
      if (args.includes('--restart') || prior?.completedAt)
        await queueReplay(true);
      while (!(await queueReplay()))
        console.log(JSON.stringify({ event: 'progression.replay_queued' }));
      // One failed subject must not spin forever or prevent other jobs being attempted.
      while (await db().progressionJob.count({ where: { errorCode: null } })) {
        const result = await processProgression(50);
        console.log(JSON.stringify({ event: 'progression.batch', ...result }));
        if (result.failed) break;
      }
      if (await db().progressionJob.count())
        throw new Error('PROGRESSION_JOBS_REMAIN_RETRY_WORKER');
    }
  } else throw new Error('UNKNOWN_COMMAND');
} catch {
  console.error(
    JSON.stringify({
      event: 'progression.failed',
      code: 'CHECK_RUNS_AND_PENDING_JOBS',
    }),
  );
  process.exitCode = 1;
} finally {
  await db().$disconnect();
}
