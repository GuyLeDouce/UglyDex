import 'server-only';
import { inspectIntegrations } from './inspect';
import { sourcePermissions, safeSourceRole } from './permissions';
import { tables } from './registry';
import { db } from '@/server/db';
import { hash } from '@/domain/events';
import { feeds } from '@/sync/normalize';
export async function validateIntegrations() {
  const reports = await inspectIntegrations();
  const validations = [];
  for (const report of reports) {
    const permissions = await sourcePermissions(report.integration);
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
            ? feed === 'onlineRewards' && !table?.present
              ? 'UNAVAILABLE'
              : 'UNVALIDATED'
            : rejected
              ? 'DEGRADED'
              : old?.backfillFinishedAt
                ? 'PARTIAL'
                : 'READY';
      const warning = !permissions.ok
        ? 'PERMISSIONS_UNAVAILABLE'
        : !safeSourceRole(permissions.data[0])
          ? 'ROLE_HAS_WRITE_PRIVILEGES'
          : !valid
            ? feed === 'onlineRewards' && !table?.present
              ? 'FEED_UNAVAILABLE'
              : 'SCHEMA_MISMATCH'
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
