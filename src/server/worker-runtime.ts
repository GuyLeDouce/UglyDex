import 'server-only';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { db } from './db';
import { readEnv } from './env';
import { log } from './log';
import {
  safeOperationalCode,
  workerControlSchema,
  type Service,
  type WorkerMode,
} from '@/domain/operations';

export async function setWorkerControl(input: unknown, actor: string) {
  const data = workerControlSchema.parse(input);
  await db().$transaction(async (tx) => {
    if (data.mode !== 'DISABLED') {
      const lock = await tx.$queryRaw<
        { acquired: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtextextended('production:backfill',0)) AS acquired`;
      if (!lock[0].acquired) throw new Error('BACKFILL_RUNNING');
    }
    await tx.workerControl.upsert({
      where: { service: data.service },
      create: { ...data, updatedBy: actor },
      update: { mode: data.mode, updatedBy: actor },
    });
    await tx.operationalAudit.create({
      data: {
        actor,
        action: 'WORKER_MODE',
        subject: data.service,
        detail: { mode: data.mode },
      },
    });
  });
}

// LIVE cannot bootstrap historical cursors. An operator must finish each source backfill first.
export async function workerReadiness(service: Service, mode: WorkerMode) {
  if (mode === 'DISABLED') return 'DISABLED';
  if (service === 'blockchain') {
    const env = readEnv();
    if (!env.ETH_RPC_URL || env.SQUIGS_START_BLOCK === undefined)
      return 'WAITING_CONFIGURATION';
    if (
      mode === 'LIVE' &&
      !(
        await db().productionStage.findUnique({ where: { stage: 'transfers' } })
      )?.completedAt
    )
      return 'WAITING_BACKFILL';
  }
  if (service === 'ecosystem') {
    const { integrationEnv, tables } = await import('@/integrations/registry');
    const { feeds } = await import('@/sync/normalize');
    const configured = feeds.filter(
      (f) => !!process.env[integrationEnv[tables[f].integration]],
    );
    if (!configured.length) return 'WAITING_CONFIGURATION';
    const sources = await db().integrationSource.findMany({
      where: { id: { in: configured } },
    });
    if (
      configured.some(
        (f) =>
          !sources.find((s) => s.id === f)?.schemaValid ||
          sources.find((s) => s.id === f)?.warning ===
            'ROLE_HAS_WRITE_PRIVILEGES',
      )
    )
      return 'WAITING_SOURCE_VALIDATION';
    if (
      mode === 'LIVE' &&
      configured.some(
        (f) => !sources.find((s) => s.id === f)?.backfillFinishedAt,
      )
    )
      return 'WAITING_BACKFILL';
  }
  return 'READY';
}

export async function runWorker(
  service: Service,
  task: (
    signal: AbortSignal,
  ) => Promise<Record<string, number | string | boolean | null>>,
  options: { once?: boolean; intervalMs?: number } = {},
) {
  const instanceId = randomUUID(),
    stop = new AbortController();
  const shutdown = () => stop.abort();
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  const pool = new Pool({
    connectionString: readEnv().DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', shutdown);
  const key = { service, instanceId };
  let state = 'STARTING',
    mode: WorkerMode = 'DISABLED',
    lockHeld = false;
  let runId: string | null = null,
    errorCode: string | null = null,
    lastSuccessAt: Date | undefined;
  const heartbeat = () =>
    db().workerHeartbeat.upsert({
      where: { service_instanceId: key },
      create: {
        ...key,
        state,
        mode,
        lockHeld,
        runId,
        errorCode,
        lastSuccessAt,
      },
      update: {
        state,
        mode,
        lockHeld,
        runId,
        errorCode,
        lastSuccessAt,
        lastHeartbeat: new Date(),
      },
    });
  // Bounded retention, without retaining task evidence or private source details.
  await db().workerHeartbeat.deleteMany({
    where: { lastHeartbeat: { lt: new Date(Date.now() - 7 * 86400000) } },
  });
  const timer = setInterval(() => {
    void heartbeat().catch(() => stop.abort());
  }, 15000);
  timer.unref();
  try {
    do {
      const configured = await db().workerControl.findUnique({
        where: { service },
      });
      mode = workerControlSchema.shape.mode.parse(
        configured?.mode ?? 'DISABLED',
      );
      state = await workerReadiness(service, mode);
      await heartbeat();
      if (state === 'READY') {
        const client = await pool.connect();
        client.on('error', shutdown);
        const started = Date.now();
        try {
          lockHeld = (
            await client.query<{ acquired: boolean }>(
              'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',
              [`worker:${service}`],
            )
          ).rows[0].acquired;
          if (lockHeld) {
            runId = randomUUID();
            state = 'RUNNING';
            await heartbeat();
            const counts = await task(stop.signal);
            if (typeof counts.failed === 'number' && counts.failed > 0)
              throw new Error('TASK_REPORTED_FAILURE');
            lastSuccessAt = new Date();
            errorCode = null;
            state = 'IDLE';
            log('worker.task', {
              runId,
              service,
              stage: mode,
              durationMs: Date.now() - started,
              success: true,
              ...counts,
            });
          } else state = 'LOCKED_BY_PEER';
        } catch (error) {
          errorCode = safeOperationalCode(error);
          state = 'ERROR';
          log('worker.task', {
            runId,
            service,
            stage: mode,
            durationMs: Date.now() - started,
            success: false,
            code: errorCode,
          });
          if (options.once) process.exitCode = 1;
        } finally {
          await client.query('SELECT pg_advisory_unlock_all()').catch(shutdown);
          client.removeListener('error', shutdown);
          client.release();
          lockHeld = false;
        }
        await heartbeat();
      }
      if (options.once || stop.signal.aborted) break;
      await delay(options.intervalMs ?? 15000, undefined, {
        signal: stop.signal,
      }).catch(() => {});
    } while (!stop.signal.aborted);
  } finally {
    clearInterval(timer);
    state = 'STOPPED';
    lockHeld = false;
    await heartbeat().catch(() => {});
    await pool.end();
    process.removeListener('SIGTERM', shutdown);
    process.removeListener('SIGINT', shutdown);
  }
}
