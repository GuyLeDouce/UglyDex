import 'server-only';
import { Client } from 'pg';
import { log } from './log';
import { databaseFingerprint } from '@/domain/deployment';

// Opt-in, bounded aggregate diagnostics on the existing app connection. No
// external DB access, collector identifiers, credentials or record payloads.
export const runtimeDiagnosticQueries = [
  [
    'binding',
    `SELECT environment, "databaseFingerprint" FROM "DeploymentIdentity" WHERE id='instance'`,
  ],
  [
    'catalog',
    `SELECT count(*)::int AS tokens, (SELECT count(DISTINCT "squigId")::int FROM "SquigOwnership" WHERE "isCurrent") AS owned FROM "Squig"`,
  ],
  [
    'transfers',
    `SELECT count(*)::int AS events, max("eventAt") AS latest_event, max("indexedAt") AS latest_import FROM "NftTransfer"`,
  ],
  [
    'cursor',
    `SELECT "blockNumber"::text, "startBlock"::text, "finalizedBlock"::text, "lastSuccessAt", ("lastError" IS NOT NULL) AS has_error FROM "ChainCursor" LIMIT 5`,
  ],
  [
    'workers',
    `SELECT service, mode, "updatedAt" FROM "WorkerControl" ORDER BY service`,
  ],
  [
    'heartbeats',
    `SELECT service, max("lastHeartbeat") AS heartbeat, max("lastSuccessAt") AS success FROM "WorkerHeartbeat" GROUP BY service`,
  ],
  [
    'collection_queue',
    `SELECT count(*)::int AS pending, min("queuedAt") AS oldest, max(attempts) AS attempts, count(*) FILTER (WHERE "errorCode" IS NOT NULL)::int AS failed FROM "CollectionJob"`,
  ],
  [
    'progression_queue',
    `SELECT count(*)::int AS pending, min("queuedAt") AS oldest, max(attempts) AS attempts, count(*) FILTER (WHERE "errorCode" IS NOT NULL)::int AS failed FROM "ProgressionJob"`,
  ],
  [
    'snapshots',
    `SELECT ruleset, count(*)::int AS collectors, max("calculatedAt") AS latest FROM "CollectionSnapshot" GROUP BY ruleset`,
  ],
  [
    'activity',
    `SELECT count(*)::int AS events, max("eventAt") AS latest FROM "CollectorActivity"`,
  ],
] as const;

export async function reportRuntimeDiagnostics() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 3000,
    query_timeout: 4000,
    application_name: 'uglydex-read-only-diagnostics',
  });
  let stage = 'connect';
  try {
    await client.connect();
    await client.query(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    for (const [name, sql] of runtimeDiagnosticQueries) {
      stage = name;
      const result = await client.query(sql);
      if (name === 'binding') {
        const row = result.rows[0];
        log('runtime.diagnostics', {
          stage,
          environmentMatches: !!row && row.environment === process.env.APP_ENV,
          databaseMatches:
            !!row &&
            row.databaseFingerprint ===
              databaseFingerprint(process.env.DATABASE_URL!),
        });
      } else {
        log('runtime.diagnostics', {
          stage,
          summary: JSON.stringify(result.rows),
        });
      }
    }
    await client.query('ROLLBACK');
  } catch (error) {
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      /^[A-Z0-9]{5}$/.test(error.code)
        ? error.code
        : 'DIAGNOSTIC_FAILED';
    log('runtime.diagnostics_failed', { stage, code });
  } finally {
    await client.end().catch(() => {});
  }
}
