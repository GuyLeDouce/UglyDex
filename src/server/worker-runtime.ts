import { integrationConfigured } from '@/integrations/bridge-config';
import { unavailableSource } from '@/integrations/availability';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { db } from './db';
import { readEnv } from './env';
import { log } from './log';
import { assertOperation, assertDeploymentBinding } from './deployment';
import {
  safeOperationalCode,
  workerControlSchema,
  type Service,
  type WorkerMode,
} from '@/domain/operations';

// A committed Phase 11 staging admission remains valid across the Phase 12A
// derivation-evidence upgrade. It is bound to the same staging database,
// contract, start block and immutable anchor; this allows the existing LIVE
// indexer to finish ordinary forward work that may have made projections dirty.
const reviewedAdmission = {
  environment: 'staging',
  commit: '0c8e5f8fc0d5db8c587c749479922accde723ae3',
  databaseFingerprint:
    'f72c0bb40a9e5946a4d07dc63b5559c253bc85b48af83914aec99cd03fb4bc3a',
  chainKey: 'transfers:1:0x8c9a02c0585200c4c65608df6b8def543d33792a',
  startBlock: '25342921',
};

async function durableAdmissionValid(
  admission: Record<string, unknown> | undefined,
  input: {
    environment: string;
    commit: string;
    databaseFingerprint: string;
    chainKey: string;
    startBlock: string;
    blockNumber: bigint;
  },
) {
  if (
    !admission ||
    admission.environment !== input.environment ||
    admission.databaseFingerprint !== input.databaseFingerprint ||
    admission.chainKey !== input.chainKey ||
    admission.startBlock !== input.startBlock ||
    typeof admission.blockNumber !== 'string' ||
    !/^\d+$/.test(admission.blockNumber) ||
    BigInt(admission.blockNumber) > input.blockNumber
  )
    return false;
  const currentRevision = admission.commit === input.commit,
    reviewedRevision =
      input.environment === reviewedAdmission.environment &&
      admission.commit === reviewedAdmission.commit &&
      input.databaseFingerprint === reviewedAdmission.databaseFingerprint &&
      input.chainKey === reviewedAdmission.chainKey &&
      input.startBlock === reviewedAdmission.startBlock;
  if (!currentRevision && !reviewedRevision) return false;
  const anchor = await db().chainBlock.findUnique({
    where: {
      chainId_number: {
        chainId: 1,
        number: BigInt(admission.blockNumber),
      },
    },
  });
  return !!anchor && anchor.hash === admission.blockHash;
}

async function chainLiveEvidence() {
  const { chainKey } = await import('@/sync/provenance');
  const { launchReport, launchContext } = await import('./launch');
  const cursor = await db().chainCursor.findUnique({
    where: { key: chainKey },
  });
  const report = await launchReport();
  const verified = [
    'MINT_COVERAGE',
    'OWNERSHIP_CONTINUITY',
    'OWNER_OF',
    'START_BLOCK',
    'ARCHIVE_RPC',
  ].every((key) =>
    report.gates.some((gate) => gate.key === key && gate.status === 'VERIFIED'),
  );
  return { cursor, verified, chainKey, context: launchContext() };
}

export async function setWorkerControl(input: unknown, actor: string) {
  const data = workerControlSchema.parse(input);
  if (data.mode !== 'DISABLED') await assertOperation('workers');
  // Record real bootstrap evidence once, so bounded LIVE batches and process
  // restarts can continue beyond that boundary without inventing a backfill run.
  let admission:
    | {
        environment: string;
        commit: string;
        databaseFingerprint: string;
        chainKey: string;
        startBlock: string;
        blockNumber: string;
        blockHash: string;
      }
    | undefined;
  if (data.service === 'blockchain' && data.mode === 'LIVE') {
    const env = readEnv();
    if (env.ETH_RPC_URL && env.SQUIGS_START_BLOCK !== undefined) {
      const evidence = await chainLiveEvidence();
      if (
        evidence.verified &&
        evidence.cursor &&
        !evidence.cursor.lastError &&
        evidence.cursor.finalizedBlock !== null &&
        evidence.cursor.blockNumber === evidence.cursor.finalizedBlock
      ) {
        admission = {
          ...evidence.context,
          chainKey: evidence.chainKey,
          startBlock: String(env.SQUIGS_START_BLOCK),
          blockNumber: evidence.cursor.blockNumber.toString(),
          blockHash: evidence.cursor.blockHash,
        };
      }
    }
  }
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
    if (admission)
      await tx.operationalAudit.create({
        data: {
          actor,
          action: 'BLOCKCHAIN_LIVE_ADMISSION',
          subject: admission.chainKey,
          detail: admission,
        },
      });
  });
}

// LIVE cannot bootstrap historical cursors. An operator must finish each source backfill first.
export async function workerReadiness(service: Service, mode: WorkerMode) {
  if (mode === 'DISABLED') return 'DISABLED';
  await assertDeploymentBinding();
  if (service === 'blockchain') {
    const env = readEnv();
    if (!env.ETH_RPC_URL || env.SQUIGS_START_BLOCK === undefined)
      return 'WAITING_CONFIGURATION';
    if (
      mode === 'LIVE' &&
      !(
        await db().productionStage.findUnique({ where: { stage: 'transfers' } })
      )?.completedAt
    ) {
      const { cursor, verified, chainKey, context } = await chainLiveEvidence();
      if (
        !cursor ||
        cursor.lastError ||
        cursor.finalizedBlock === null ||
        cursor.blockNumber > cursor.finalizedBlock
      )
        return 'WAITING_BACKFILL';
      const audit = await db().operationalAudit.findFirst({
        where: { action: 'BLOCKCHAIN_LIVE_ADMISSION', subject: chainKey },
        orderBy: { createdAt: 'desc' },
      });
      const admission = audit?.detail as Record<string, unknown> | undefined;
      const admissionValid = await durableAdmissionValid(admission, {
        ...context,
        chainKey,
        startBlock: String(env.SQUIGS_START_BLOCK),
        blockNumber: cursor.blockNumber,
      });
      if (!verified && !admissionValid) return 'WAITING_BACKFILL';
      if (cursor.blockNumber !== cursor.finalizedBlock) {
        if (!admissionValid) return 'WAITING_BACKFILL';
      }
    }
  }
  if (service === 'ecosystem') {
    const { tables } = await import('@/integrations/registry');
    const { feeds } = await import('@/sync/normalize');
    const configured = feeds.filter((f) =>
      integrationConfigured(tables[f].integration),
    );
    if (!configured.length) return 'WAITING_CONFIGURATION';
    const sources = await db().integrationSource.findMany({
      where: { id: { in: configured } },
    });
    const available = configured.filter(
      (f) => !unavailableSource(sources.find((s) => s.id === f)),
    );
    if (!available.length) return 'WAITING_CONFIGURATION';
    if (
      available.some((f) => {
        const source = sources.find((s) => s.id === f);
        return (
          !source?.schemaValid ||
          source.state === 'ERROR' ||
          source.warning === 'ROLE_HAS_WRITE_PRIVILEGES' ||
          source.warning === 'PERMISSIONS_UNAVAILABLE'
        );
      })
    )
      return 'WAITING_SOURCE_VALIDATION';
    if (
      mode === 'LIVE' &&
      available.some(
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
  let consecutiveFailures = 0;
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
            consecutiveFailures = 0;
            errorCode = null;
            state = 'IDLE';
            log('worker.task', {
              runId,
              service,
              stage: mode,
              durationMs: Date.now() - started,
              success: true,
              rssBytes: process.memoryUsage().rss,
              ...counts,
            });
          } else state = 'LOCKED_BY_PEER';
        } catch (error) {
          errorCode = safeOperationalCode(error);
          consecutiveFailures++;
          if (consecutiveFailures >= 3) {
            await setWorkerControl(
              { service, mode: 'DISABLED' },
              'automatic:circuit-breaker',
            );
            await db().operationalAudit.create({
              data: {
                actor: 'worker',
                action: 'CIRCUIT_OPEN',
                subject: service,
                detail: { code: errorCode },
              },
            });
          }
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
      await delay(
        Math.min(
          300000,
          (options.intervalMs ?? readEnv().WORKER_INTERVAL_MS) *
            2 ** consecutiveFailures,
        ),
        undefined,
        {
          signal: stop.signal,
        },
      ).catch(() => {});
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
