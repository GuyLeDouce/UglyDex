import 'server-only';
import { Pool, type QueryResultRow } from 'pg';
import { integrationEnv, type Integration } from './registry';
import { errorCode, log } from '@/server/log';
export type Failure =
  'unconfigured' | 'unavailable' | 'schema_mismatch' | 'invalid_data';
export type IntegrationResult<T> =
  { ok: true; data: T } | { ok: false; reason: Failure };
export function classifyExternalError(error: unknown): Failure {
  return ['42P01', '42703', '3F000'].includes(errorCode(error))
    ? 'schema_mismatch'
    : 'unavailable';
}
const pools = new Map<Integration, Pool>();
export async function readExternal<T extends QueryResultRow>(
  integration: Integration,
  sql: string,
  values: unknown[] = [],
): Promise<IntegrationResult<T[]>> {
  const url = process.env[integrationEnv[integration]];
  if (!url) return { ok: false, reason: 'unconfigured' };
  // Defense in depth; queries are static or composed exclusively from registry identifiers.
  if (!/^\s*SELECT\b/i.test(sql) || /;/.test(sql))
    throw new Error('EXTERNAL_SELECT_ONLY');
  let client;
  try {
    let pool = pools.get(integration);
    if (!pool) {
      pool = new Pool({
        connectionString: url,
        max: 2,
        connectionTimeoutMillis: 4000,
        idleTimeoutMillis: 10000,
        statement_timeout: 5000,
        query_timeout: 6000,
        options: '-c default_transaction_read_only=on',
        application_name: 'uglydex_readonly',
      });
      pool.on('error', () => log('integration.pool_error', { integration }));
      pools.set(integration, pool);
    }
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5s'");
    const result = await client.query<T>(sql, values);
    await client.query('COMMIT');
    return { ok: true, data: result.rows };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    const reason = classifyExternalError(error);
    log('integration.read_failed', {
      integration,
      reason,
      code: errorCode(error),
    });
    return { ok: false, reason };
  } finally {
    client?.release();
  }
}
export async function closeExternalPools() {
  await Promise.all([...pools.values()].map((p) => p.end()));
  pools.clear();
}
