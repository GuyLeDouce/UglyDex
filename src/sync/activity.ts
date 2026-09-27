import { integrationConfigured } from '@/integrations/bridge-config';
import { unavailableSource } from '@/integrations/availability';
import 'server-only';
import { Pool } from 'pg';
import { db } from '@/server/db';
import { readEnv } from '@/server/env';
import { readPage, tableColumns, type ExternalRow } from '@/integrations/table';
import { tables, sourceTimestamp } from '@/integrations/registry';
import { sourceSchemaFingerprint } from '@/integrations/source-schema';
import { readSourceQuery } from '@/integrations/queries';
import { eventKey } from '@/domain/events';
import { log } from '@/server/log';
import { feeds, normalizeRow, type Feed } from './normalize';
import { importRecord, reattributePending } from './import-event';
const mutable = new Set<Feed>([
  'duels',
  'marketplace',
  'bounty',
  'maw',
  'mawPrizes',
  'madlibPublications',
  'madlibOperations',
]);
export type ImportOptions = {
  maxPages?: number;
  since?: Date;
  replay?: boolean;
  reconcile?: boolean;
};
export async function enrich(feed: Feed, rows: ExternalRow[]) {
  if (feed === 'bountyResults') {
    const ids = rows
      .map((r) => r.bounty_submission_id)
      .filter((v) => v != null);
    if (ids.length) {
      const prizes = await readSourceQuery<{
        id: string;
        project_name: string;
        token_id: string;
      }>('bountyParents', [ids]);
      if (prizes.ok)
        for (const row of rows) {
          const prize = prizes.data.find(
            (p) => String(p.id) === String(row.bounty_submission_id),
          );
          if (prize) {
            row.prize_project = prize.project_name;
            row.prize_token = prize.token_id;
          }
        }
    }
  }
  if (feed === 'survival') {
    const games = await readSourceQuery<{ id: string; started_at: Date }>(
      'survivalParents',
      [rows.map((r) => r.game_id)],
    );
    if (!games.ok) throw new Error('PARENT_UNAVAILABLE');
    for (const r of rows)
      r.started_at = games.data.find(
        (g) => String(g.id) === String(r.game_id),
      )?.started_at;
  }
  if (feed === 'duels') {
    const rounds = await readSourceQuery<{ duel_id: string; rounds: number }>(
      'duelRounds',
      [rows.map((r) => r.id)],
    );
    if (rounds.ok)
      for (const r of rows)
        r.rounds = rounds.data.find((g) => g.duel_id === r.id)?.rounds ?? 0;
  }
}
export async function runActivityFeed(feed: Feed, options: ImportOptions = {}) {
  const started = Date.now();
  const counts = {
    scanned: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    unresolved: 0,
    failed: 0,
    eligible: 0,
    normalized: 0,
    collectorLinked: 0,
    squigLinked: 0,
    duplicates: 0,
    ignoredRows: 0,
  };
  const maxPages = options.maxPages ?? 25;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10000)
    throw new Error('INVALID_LIMIT');
  const pool = new Pool({
      connectionString: readEnv().DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
    }),
    lock = await pool.connect();
  let runId: string | undefined;
  try {
    const locked = await lock.query(
      'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
      [`activity:${feed}`],
    );
    if (!locked.rows[0].locked) {
      log('activity.busy', {
        service: 'ecosystem',
        stage: feed,
        success: false,
      });
      return { ...counts, failed: 1 };
    }
    await db().syncRun.updateMany({
      where: { source: feed, status: 'RUNNING' },
      data: {
        status: 'INTERRUPTED',
        finishedAt: new Date(),
        errorCode: 'WORKER_RESTART',
      },
    });
    const spec = tables[feed],
      state = await db().integrationSource.upsert({
        where: { id: feed },
        create: { id: feed, lastAttemptAt: new Date() },
        update: { lastAttemptAt: new Date() },
      });
    const run = await db().syncRun.create({
      data: { source: feed, counts, cursorStart: state.cursor ?? undefined },
    });
    runId = run.id;
    const columns = await tableColumns(spec);
    if (
      !columns.ok ||
      spec.required.some((c) => !columns.data.some((d) => d.column_name === c))
    ) {
      const reason = !columns.ok ? columns.reason : 'schema_mismatch';
      if (reason !== 'unconfigured') counts.failed++;
      await db().integrationSource.update({
        where: { id: feed },
        data: {
          state: reason === 'unconfigured' ? 'NOT_CONFIGURED' : 'ERROR',
          schemaValid: false,
          warning: reason,
        },
      });
      await db().syncRun.update({
        where: { id: run.id },
        data: {
          status: reason.toUpperCase(),
          finishedAt: new Date(),
          errorCode: reason,
          counts,
        },
      });
      return counts;
    }
    const timestamp =
      !options.reconcile &&
      mutable.has(feed) &&
      columns.data.some((c) => c.column_name === 'updated_at')
        ? 'updated_at'
        : undefined;
    const effective = timestamp
      ? {
          ...spec,
          keys: [timestamp, ...spec.keys],
          required: [...new Set([...spec.required, timestamp])],
          optional: spec.optional.filter((c) => c !== timestamp),
        }
      : spec;
    let after =
      options.replay || options.since
        ? undefined
        : ((state.cursor as unknown[] | null) ?? undefined);
    const rotating =
      options.reconcile || (!timestamp && !!state.backfillFinishedAt);
    if (rotating && !options.replay && !options.since)
      after = (state.reconcileCursor as unknown[] | null) ?? undefined;
    if (after?.length === 0) after = undefined;
    const timeColumn = timestamp ?? sourceTimestamp(spec);
    let exhausted = false,
      earliest: Date | undefined,
      latest: Date | undefined;
    for (let page = 0; page < maxPages; page++) {
      const result = await readPage(
        effective,
        after,
        {},
        200,
        options.since && timeColumn
          ? { column: timeColumn, value: options.since }
          : undefined,
      );
      if (!result.ok) throw new Error(result.reason);
      if (!result.data.length) {
        exhausted = true;
        break;
      }
      await enrich(feed, result.data);
      const pageKeys: string[] = [];
      for (const row of result.data) {
        counts.scanned++;
        // Parent-dated Survival rows are still bounded by this source page.
        // Exclude out-of-range rows without retracting previously imported slots.
        if (
          options.since &&
          !timeColumn &&
          row.started_at &&
          new Date(String(row.started_at)) < options.since
        ) {
          counts.skipped++;
          counts.ignoredRows++;
          continue;
        }
        const recordId = String(
          row.id ?? row.event_id ?? `${row.game_id}:${row.user_id}`,
        );
        try {
          const events = normalizeRow(feed, row),
            c = await importRecord(feed, recordId, events);
          if (events.length) counts.eligible++;
          counts.normalized += events.length;
          counts.duplicates += c.skipped;
          if (!events.length) counts.ignoredRows++;
          pageKeys.push(...events.map(eventKey));
          for (const key of [
            'inserted',
            'updated',
            'skipped',
            'unresolved',
          ] as const)
            counts[key] += c[key];
          if (!events.length) counts.skipped++;
          for (const e of events) {
            if (!earliest || e.eventAt < earliest) earliest = e.eventAt;
            if (!latest || e.eventAt > latest) latest = e.eventAt;
          }
          await db().importRejection.updateMany({
            where: { source: feed, sourceRecordId: recordId, resolvedAt: null },
            data: { resolvedAt: new Date() },
          });
        } catch {
          counts.failed++;
          await db().importRejection.upsert({
            where: {
              source_sourceRecordId: { source: feed, sourceRecordId: recordId },
            },
            create: {
              source: feed,
              sourceRecordId: recordId,
              code: 'INVALID_SOURCE_RECORD',
              runId: run.id,
            },
            update: {
              code: 'INVALID_SOURCE_RECORD',
              runId: run.id,
              attempts: { increment: 1 },
              resolvedAt: null,
            },
          });
        }
      }
      if (pageKeys.length) {
        const linked = await db().collectorActivity.findMany({
          where: { eventKey: { in: pageKeys } },
          select: { collectorId: true, squigId: true },
        });
        counts.collectorLinked += linked.filter((e) => e.collectorId).length;
        counts.squigLinked += linked.filter((e) => e.squigId).length;
      }
      after = effective.keys.map((k) => {
        const v = result.data.at(-1)![k];
        return v instanceof Date ? v.toISOString() : v;
      });
      if (!options.since)
        await db().integrationSource.update({
          where: { id: feed },
          data: rotating
            ? { reconcileCursor: after as string[] }
            : { cursor: after as string[] },
        });
      await db().syncRun.update({
        where: { id: run.id },
        data: { counts, cursorEnd: after as string[] },
      });
      log('activity.page', {
        runId: run.id,
        service: 'ecosystem',
        stage: feed,
        source: feed,
        ...counts,
      });
    }
    const failed = await db().importRejection.count({
      where: { source: feed, resolvedAt: null },
    });
    await db().integrationSource.update({
      where: { id: feed },
      data: {
        state: failed ? 'DEGRADED' : 'PARTIAL',
        schemaValid: true,
        schemaFingerprint: sourceSchemaFingerprint(
          spec,
          columns.data.map((c) => c.column_name),
        ),
        lastSuccessAt: new Date(),
        warning: options.since
          ? 'PILOT_RANGE'
          : failed
            ? 'REJECTED_RECORDS'
            : 'TRACKED_AVAILABLE_HISTORY_NOT_LIFETIME',
        firstAvailableAt:
          earliest &&
          (!state.firstAvailableAt || earliest < state.firstAvailableAt)
            ? earliest
            : state.firstAvailableAt,
        lastAvailableAt:
          latest && (!state.lastAvailableAt || latest > state.lastAvailableAt)
            ? latest
            : state.lastAvailableAt,
        importedThrough:
          latest && (!state.importedThrough || latest > state.importedThrough)
            ? latest
            : state.importedThrough,
        ...(exhausted && !options.since
          ? { backfillFinishedAt: new Date() }
          : {}),
        ...(exhausted && rotating ? { reconcileCursor: [] } : {}),
      },
    });
    // An empty keyset denotes the next bounded reconciliation sweep.
    if (exhausted && rotating)
      await db().integrationSource.update({
        where: { id: feed },
        data: { reconcileCursor: [] },
      });
    await db().syncRun.update({
      where: { id: run.id },
      data: {
        counts,
        status: failed ? 'PARTIAL' : exhausted ? 'COMPLETED' : 'PARTIAL',
        finishedAt: new Date(),
      },
    });
  } catch {
    counts.failed++;
    await db().integrationSource.updateMany({
      where: { id: feed },
      data: { state: 'ERROR', warning: 'IMPORT_FAILED' },
    });
    if (runId)
      await db().syncRun.update({
        where: { id: runId },
        data: {
          counts,
          status: 'FAILED',
          errorCode: 'IMPORT_FAILED',
          finishedAt: new Date(),
        },
      });
  } finally {
    await lock.query('SELECT pg_advisory_unlock_all()').catch(() => undefined);
    lock.release();
    await pool.end();
  }
  log('activity.finished', {
    runId: runId ?? null,
    service: 'ecosystem',
    stage: feed,
    source: feed,
    durationMs: Date.now() - started,
    success: counts.failed === 0,
    ...counts,
  });
  return counts;
}
export async function activityCycle(
  options: ImportOptions = { maxPages: 2 },
  stopped = () => false,
) {
  await reattributePending();
  for (const feed of feeds)
    if (!stopped() && integrationConfigured(tables[feed].integration)) {
      try {
        const source = await db().integrationSource.findUnique({
          where: { id: feed },
        });
        if (unavailableSource(source)) continue;
        await runActivityFeed(feed, options);
        if (mutable.has(feed))
          await runActivityFeed(feed, { maxPages: 1, reconcile: true });
      } catch {
        log('activity.source_failed', { source: feed });
      }
    }
}
