import { Client } from 'pg';
import { setTimeout as delay } from 'node:timers/promises';
import { db } from '../../src/server/db';
import {
  seedProgression,
  rebuildSubject,
} from '../../src/server/progression-engine';

// Runs only in the disposable identity-test database. Pause the real evaluator
// immediately before saving its projection while another connection enqueues.
export async function progressionQueueRaceTests(
  check: (value: unknown, message: string) => void,
) {
  await seedProgression();
  const collector = await db().collector.create({
    data: { slug: 'queue-race-fixture' },
  });
  const blocker = new Client({ connectionString: process.env.DATABASE_URL });
  const writer = new Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  await writer.connect();
  let evaluation: Promise<unknown> | undefined;
  let enqueue: Promise<unknown> | undefined;
  try {
    await db().$executeRawUnsafe(
      `CREATE FUNCTION test_pause_progression() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(734481); RETURN NEW; END $$`,
    );
    await db().$executeRawUnsafe(
      `CREATE TRIGGER test_pause_progression BEFORE INSERT OR UPDATE ON "CollectorProgress" FOR EACH ROW EXECUTE FUNCTION test_pause_progression()`,
    );
    await blocker.query('SELECT pg_advisory_lock(734481)');
    evaluation = rebuildSubject('COLLECTOR', collector.id);
    // Attach a rejection handler immediately; assertions below still await it.
    void evaluation.catch(() => {});
    let waiting = false;
    for (let i = 0; i < 150; i++) {
      const rows = await blocker.query(
        "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=734481 AND NOT granted",
      );
      if (rows.rowCount) {
        waiting = true;
        break;
      }
      await delay(20);
    }
    check(
      waiting,
      'real progression evaluator reached paused projection write',
    );
    const writerPid = (await writer.query('SELECT pg_backend_pid() AS pid'))
      .rows[0].pid;
    enqueue = writer.query("SELECT progression_enqueue('COLLECTOR',$1::uuid)", [
      collector.id,
    ]);
    void enqueue.catch(() => {});
    let contending = false;
    for (let i = 0; i < 150; i++) {
      const rows = await blocker.query(
        "SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",
        [writerPid],
      );
      if (rows.rowCount) {
        contending = true;
        break;
      }
      await delay(20);
    }
    check(contending, 'incoming enqueue waits on evaluator queue lock');
    await blocker.query('SELECT pg_advisory_unlock(734481)');
    await evaluation;
    await enqueue;
    check(
      !!(await db().collectorProgress.findUnique({
        where: { collectorId: collector.id },
      })),
      'evaluation commits despite a concurrent enqueue',
    );
    check(
      !!(await db().progressionJob.findUnique({
        where: {
          subjectType_subjectId: {
            subjectType: 'COLLECTOR',
            subjectId: collector.id,
          },
        },
      })),
      'new evidence remains queued after evaluation commits',
    );
    await db().$executeRawUnsafe(
      'DROP TRIGGER test_pause_progression ON "CollectorProgress"',
    );
    await db().$executeRawUnsafe('DROP FUNCTION test_pause_progression()');
    await rebuildSubject('COLLECTOR', collector.id);
    check(
      !(await db().progressionJob.findUnique({
        where: {
          subjectType_subjectId: {
            subjectType: 'COLLECTOR',
            subjectId: collector.id,
          },
        },
      })),
      'follow-up evaluation drains preserved generation',
    );
  } finally {
    await blocker.query('SELECT pg_advisory_unlock(734481)').catch(() => {});
    await Promise.allSettled([evaluation, enqueue]);
    await db().$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS test_pause_progression ON "CollectorProgress"',
    );
    await db().$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS test_pause_progression()',
    );
    await writer.end();
    await blocker.end();
  }
}
