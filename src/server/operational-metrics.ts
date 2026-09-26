import 'server-only';
import { db } from './db';
const local = { databaseFailures: 0, webErrors: 0, healthSuccessAt: 0 };
export function localHealth() {
  return { ...local };
}
export function observedHealth() {
  local.healthSuccessAt = Date.now();
}
export async function operationalFailure(
  kind: 'WEB_ERROR' | 'DATABASE_FAILURE',
) {
  if (kind === 'WEB_ERROR') local.webErrors++;
  else local.databaseFailures++;
  console.error(
    JSON.stringify({
      event: 'operational.failure',
      kind,
      time: new Date().toISOString(),
    }),
  );
  try {
    const bucket = new Date(Math.floor(Date.now() / 3600000) * 3600000);
    await db().operationalMetric.upsert({
      where: { bucket_kind: { bucket, kind } },
      create: { bucket, kind, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    /* DB outage cannot be durably recorded in the failed DB; local counter and platform log survive until restart. */
  }
}
