import 'server-only';
import { inspectIntegrations } from './inspect';
import { readExternal } from './read-only';
import { tables } from './registry';
import { db } from '@/server/db';
import { hash } from '@/domain/events';
import { feeds } from '@/sync/normalize';
export async function validateIntegrations() {
  const reports = await inspectIntegrations();
  const validations = [];
  for (const report of reports) {
    const permissions = await readExternal<{
      read_only: string;
      superuser: boolean;
      can_write: boolean;
    }>(
      report.integration,
      `SELECT current_setting('transaction_read_only') AS read_only, (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND (has_table_privilege(quote_ident(table_schema)||'.'||quote_ident(table_name),'INSERT,UPDATE,DELETE,TRUNCATE'))) AS can_write`,
    );
    validations.push({
      ...report,
      permissions: permissions.ok
        ? permissions.data[0]
        : { status: 'unavailable' },
    });
    for (const feed of feeds.filter(
      (f) => tables[f].integration === report.integration,
    )) {
      const table = report.tables.find((t) => t.table === tables[feed].table),
        valid = !!table?.present && !table.missingRequired.length;
      const old = await db().integrationSource.findUnique({
        where: { id: feed },
      });
      const rejected = await db().importRejection.count({
        where: { source: feed, resolvedAt: null },
      });
      const state = !report.configured
        ? 'NOT_CONFIGURED'
        : report.status !== 'connected'
          ? 'ERROR'
          : !valid
            ? 'UNVALIDATED'
            : rejected
              ? 'DEGRADED'
              : old?.backfillFinishedAt
                ? 'PARTIAL'
                : 'READY';
      const warning = !permissions.ok
        ? 'PERMISSIONS_UNAVAILABLE'
        : permissions.data[0]?.superuser || permissions.data[0]?.can_write
          ? 'ROLE_HAS_WRITE_PRIVILEGES'
          : !valid
            ? 'SCHEMA_MISMATCH'
            : null;
      await db().integrationSource.upsert({
        where: { id: feed },
        create: {
          id: feed,
          state,
          schemaValid: valid,
          warning,
          schemaFingerprint: hash(table ?? null),
        },
        update: {
          state,
          schemaValid: valid,
          warning,
          schemaFingerprint: hash(table ?? null),
        },
      });
    }
  }
  return validations;
}
