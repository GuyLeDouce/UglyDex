import 'server-only';
import { db } from './db';
import { assertOperation } from './deployment';
import { feeds, type Feed } from '@/sync/normalize';
import { runActivityFeed } from '@/sync/activity';
import { recordGate } from './launch';
import { hash } from '@/domain/events';
export async function handoffProof(feed: Feed) {
  await assertOperation('pilot');
  if (!feeds.includes(feed)) throw new Error('INVALID_FEED');
  if (
    await db().workerControl.count({
      where: { service: 'ecosystem', mode: { not: 'DISABLED' } },
    })
  )
    throw new Error('DISABLE_ECOSYSTEM_BEFORE_HANDOFF');
  const before = await db().integrationSource.findUniqueOrThrow({
    where: { id: feed },
  });
  const approval = await db().operationalAudit.findFirst({
    where: { action: 'PILOT_APPROVED', subject: feed },
    orderBy: { createdAt: 'desc' },
  });
  const approved = approval?.detail as
    { schemaFingerprint?: string } | undefined;
  if (
    !before.schemaValid ||
    !before.backfillFinishedAt ||
    approved?.schemaFingerprint !== before.schemaFingerprint
  )
    throw new Error('REVIEWED_BACKFILL_REQUIRED');
  // Bounded cursor + rotating reconciliation, then another cursor pass captures concurrent arrivals.
  const first = await runActivityFeed(feed, { maxPages: 1 });
  const reconcile = await runActivityFeed(feed, {
    maxPages: 1,
    reconcile: true,
  });
  const second = await runActivityFeed(feed, { maxPages: 1 });
  const after = await db().integrationSource.findUniqueOrThrow({
    where: { id: feed },
  });
  const rejected = await db().importRejection.count({
    where: { source: feed, resolvedAt: null },
  });
  const evidence = {
    feed,
    beforeCursorHash: hash(before.cursor),
    afterCursorHash: hash(after.cursor),
    first,
    reconcile,
    second,
    rejected,
    reconciliationSweepComplete:
      Array.isArray(after.reconcileCursor) &&
      after.reconcileCursor.length === 0,
  };
  const failed = first.failed + reconcile.failed + second.failed + rejected;
  await db().operationalAudit.create({
    data: {
      actor: 'launch:operator',
      action: 'HANDOFF_PROBE',
      subject: feed,
      detail: evidence,
    },
  });
  await recordGate(
    'HANDOFF',
    failed ? 'FAILED' : 'PARTIAL',
    'Bounded handoff probe recorded; review all configured feeds and cursor coverage before enabling LIVE',
    evidence,
  );
  if (failed) throw new Error('HANDOFF_PROBE_FAILED');
  return evidence;
}
