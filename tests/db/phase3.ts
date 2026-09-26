import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { db } from '../../src/server/db';
import { feeds, normalizeRow } from '../../src/sync/normalize';
import {
  importRecord,
  reattributeActivity,
  reattributePending,
} from '../../src/sync/import-event';
import { fixtures, discord, other, at } from '../fixtures/activity';
import {
  activityPage,
  ecosystemSummary,
  creationPage,
} from '../../src/server/activity';
import { runActivityFeed } from '../../src/sync/activity';
import { validateIntegrations } from '../../src/integrations/validate';
import { markWalletDirty } from '../../src/sync/provenance';
export async function phase3DatabaseTests(
  check: (v: unknown, message: string) => void,
  external: Client,
) {
  for (const feed of feeds) {
    const events = normalizeRow(feed, fixtures[feed]),
      id = events[0].sourceId;
    const a = await importRecord(feed, id, events),
      b = await importRecord(feed, id, events);
    check(a.inserted === events.length, `${feed} first import`);
    check(
      b.inserted === 0 && b.skipped === events.length,
      `${feed} replay idempotent`,
    );
    const corrected = events.map((e) => ({
      ...e,
      metadata: { ...e.metadata, correctionObserved: true },
    }));
    check(
      (await importRecord(feed, id, corrected)).updated === events.length,
      `${feed} source correction`,
    );
    check(
      (await db().activityCorrection.count({
        where: { activity: { sourceType: feed, sourceId: id } },
      })) >= events.length,
      `${feed} audited correction`,
    );
  }
  const identity = await db().externalIdentity.findUniqueOrThrow({
      where: {
        provider_externalId: { provider: 'DISCORD', externalId: discord },
      },
    }),
    collectorId = identity.collectorId;
  const privatePage = await activityPage({ collectorId });
  check(privatePage.entries.length > 0, 'authenticated imported history');
  check(
    (await activityPage({ collectorId, public: true })).entries.length === 0,
    'private profile has no public activity',
  );
  await db().collector.update({
    where: { id: collectorId },
    data: {
      slug: 'activity-collector',
      isPublic: true,
      showDiscord: false,
      showWallets: false,
    },
  });
  check(
    (await activityPage({ collectorId, public: true })).entries.length === 0,
    'hidden identity associations withheld',
  );
  await db().collector.update({
    where: { id: collectorId },
    data: { showDiscord: true },
  });
  const publicPage = await activityPage({ collectorId, public: true });
  check(publicPage.entries.length > 0, 'public opted-in activity visible');
  check(!JSON.stringify(publicPage).includes(discord), 'DTO hides Discord IDs');
  const stats = await ecosystemSummary({ collectorId });
  check(
    stats.duels.played === 1 && stats.duels.wins === 1,
    'completed duel aggregate',
  );
  check(
    stats.survival.games === 1 &&
      stats.survival.firsts === 1 &&
      stats.survival.eliminations === '2',
    'Survival aggregate',
  );
  check(
    stats.marketplace.purchases === 2 &&
      Number(stats.marketplace.spent) === 7000,
    'distinct canonical marketplaces',
  );
  check(
    stats.charm.find((c) => c.direction === 'PAYOUT')?.amount ===
      '27600.00000000',
    'confirmed payouts only',
  );
  const gallery = await creationPage({ collectorId, public: true }, {});
  check(gallery.entries.length === 1, 'submission and live image deduplicated');
  await importRecord(
    'submissions',
    'phase3',
    normalizeRow('submissions', {
      ...fixtures.submissions,
      status: 'declined',
    }),
  );
  check(
    (await creationPage({ collectorId, public: true }, {})).entries.length ===
      0,
    'decline retracts approved gallery and matching live duplicate',
  );
  await importRecord(
    'submissions',
    'phase3',
    normalizeRow('submissions', fixtures.submissions),
  );
  await importRecord(
    'submissions',
    'phase3',
    normalizeRow('submissions', {
      ...fixtures.submissions,
      live_image_id: null,
      status: 'declined',
    }),
  );
  check(
    (await creationPage({ collectorId, public: true }, {})).entries.length ===
      0,
    'declined image deduplication survives absent live ID',
  );
  await importRecord(
    'submissions',
    'phase3',
    normalizeRow('submissions', fixtures.submissions),
  );
  const cancelled = normalizeRow('duels', {
    ...fixtures.duels,
    status: 'cancelled',
  });
  await importRecord('duels', 'phase3', cancelled);
  check(
    (await ecosystemSummary({ collectorId })).duels.played === 0,
    'cancelled correction removed from completed stats',
  );
  check(
    (await db().collectorActivity.count({
      where: { sourceType: 'duels', sourceId: 'phase3' },
    })) === 2,
    'outcome corrections keep stable participant slots',
  );
  await importRecord('duels', 'phase3', normalizeRow('duels', fixtures.duels));
  const burn = normalizeRow('maw', {
    ...fixtures.maw,
    squig_disposition: 'swallowed',
    digestion_status: 'digested',
    burn_confirmed_at: at,
    burn_transaction_hash: '0x' + 'f'.repeat(64),
  });
  await importRecord('maw', 'phase3', burn);
  const squig = await db().squig.findFirstOrThrow({ where: { tokenId: 3157 } });
  check(
    (
      await activityPage(
        { squigId: squig.id, public: true },
        { category: 'MAW' },
      )
    ).entries.some((e) => e.eventType === 'MAW_DIGESTED'),
    'burn in Squig passport',
  );
  await importRecord('maw', 'phase3', normalizeRow('maw', fixtures.maw));
  check(
    (await db().collectorActivity.count({
      where: {
        sourceType: 'maw',
        eventType: 'MAW_DIGESTED',
        recordStatus: 'RETRACTED',
      },
    })) === 1,
    'removed source burn slot retained as retracted',
  );
  check(
    !(
      await activityPage(
        { squigId: squig.id, public: true },
        { category: 'MAW' },
      )
    ).entries.some((e) => e.eventType === 'MAW_DIGESTED'),
    'retracted burn hidden',
  );
  const wallet = '0x' + '8'.repeat(40),
    unresolved = normalizeRow('bountyResults', {
      ...fixtures.bountyResults,
      id: 'wallet-winner',
      winner_discord_id: null,
      winner_wallet: wallet,
    });
  check(
    (await importRecord('bountyResults', 'wallet-winner', unresolved))
      .unresolved === 1,
    'wallet event preserved unresolved',
  );
  const ev = await db().historicalIdentityAttribution.create({
    data: {
      sourceKey: 'phase3-attribution',
      collectorId,
      walletAddress: wallet,
      source: 'FIXTURE',
      status: 'UNCONFIRMED',
      confidence: 'UNKNOWN',
      effectiveFrom: new Date('2026-01-01'),
      evidence: {},
    },
  });
  await reattributeActivity({ walletAddress: wallet });
  check(
    (
      await db().collectorActivity.findFirstOrThrow({
        where: { sourceId: 'wallet-winner' },
      })
    ).collectorId === null,
    'unconfirmed evidence cannot claim history',
  );
  await db().historicalIdentityAttribution.update({
    where: { id: ev.id },
    data: { status: 'REVIEWED' },
  });
  await db().$transaction((tx) => markWalletDirty(tx, wallet));
  await reattributePending();
  check(
    (
      await db().collectorActivity.findFirstOrThrow({
        where: { sourceId: 'wallet-winner' },
      })
    ).collectorId === collectorId,
    'review queue resolves old event without legacy reimport',
  );
  const otherId = (
    await db().externalIdentity.findUniqueOrThrow({
      where: {
        provider_externalId: { provider: 'DISCORD', externalId: other },
      },
    })
  ).collectorId;
  const conflict = await db().historicalIdentityAttribution.create({
    data: {
      sourceKey: 'phase3-conflict',
      collectorId: otherId,
      walletAddress: wallet,
      source: 'FIXTURE',
      status: 'UNCONFIRMED',
      confidence: 'UNKNOWN',
      effectiveFrom: new Date('2026-01-01'),
      evidence: {},
    },
  });
  await reattributeActivity({ walletAddress: wallet });
  check(
    (
      await db().collectorActivity.findFirstOrThrow({
        where: { sourceId: 'wallet-winner' },
      })
    ).attributionStatus === 'CONFLICT',
    'conflicting evidence removes attribution',
  );
  await db().historicalIdentityAttribution.update({
    where: { id: conflict.id },
    data: { status: 'REJECTED' },
  });
  await reattributeActivity({ walletAddress: wallet });
  check(
    (
      await db().collectorActivity.findFirstOrThrow({
        where: { sourceId: 'wallet-winner' },
      })
    ).collectorId === collectorId,
    'rejection restores trustworthy evidence',
  );
  for (let i = 0; i < 30; i++)
    await importRecord(
      'purchases',
      `page-${i}`,
      normalizeRow('purchases', { ...fixtures.purchases, id: `page-${i}` }),
    );
  const first = await activityPage(
      { collectorId },
      { category: 'MARKETPLACE' },
    ),
    second = await activityPage(
      { collectorId },
      { category: 'MARKETPLACE', after: first.next! },
    );
  check(
    first.entries.length === 24 && !!first.next,
    'bounded cursor first page',
  );
  check(
    !first.entries.some((a) => second.entries.some((b) => a.id === b.id)),
    'no pagination duplicates at equal timestamps',
  );
  check(
    (await activityPage({ collectorId }, { category: 'DUELS' })).entries.every(
      (e) => e.category === 'DUELS',
    ),
    'server category filter',
  );
  await assert.rejects(() =>
    activityPage({ collectorId }, { after: 'injection' }),
  );
  check(true, 'malformed cursor rejected');
  // Real isolated external fixture: role cannot write, paging resumes, correction is visible.
  await external.query(
    'ALTER TABLE squig_duels ADD COLUMN updated_at timestamptz, ADD COLUMN completed_at timestamptz, ADD COLUMN winner_id text',
  );
  await external.query(
    "UPDATE squig_duels SET updated_at=now(),completed_at=now(),winner_id=challenger_id,status='completed'",
  );
  await db().integrationSource.delete({ where: { id: 'duels' } });
  await external.query(
    "INSERT INTO squig_duels (id,challenger_id,status,created_at,updated_at,completed_at,winner_id) SELECT 'bulk-'||n,'888888888888888888','completed',now(),now(),now(),'888888888888888888' FROM generate_series(1,205) n",
  );
  const partial = await runActivityFeed('duels', { maxPages: 1 });
  check(partial.scanned === 200, 'pilot page bound');
  const resumed = await runActivityFeed('duels', { maxPages: 2 });
  check(resumed.scanned === 6, 'durable cursor resumes after interruption');
  check(
    (await runActivityFeed('duels', { maxPages: 1 })).scanned === 0,
    'incremental update cursor avoids full rescan',
  );
  await external.query(
    "UPDATE squig_duels SET status='cancelled',updated_at=clock_timestamp() WHERE id='bulk-1'",
  );
  check(
    (await runActivityFeed('duels', { maxPages: 1 })).updated === 1,
    'changed legacy row reimports once',
  );
  await external.query("DELETE FROM squig_duels WHERE id='bulk-1'");
  await runActivityFeed('duels', { maxPages: 1 });
  check(
    (await db().collectorActivity.count({
      where: { sourceType: 'duels', sourceId: 'bulk-1' },
    })) === 1,
    'source deletion does not blindly erase ledger',
  );
  await validateIntegrations();
  check(
    (await db().integrationSource.findUniqueOrThrow({ where: { id: 'maw' } }))
      .state === 'NOT_CONFIGURED',
    'unconfigured source explicit',
  );
  check(
    (await db().integrationSource.findUniqueOrThrow({ where: { id: 'duels' } }))
      .state === 'PARTIAL',
    'exhausted available source never claims lifetime complete',
  );
  await external.query(
    "INSERT INTO squig_duels VALUES ('bad-row','invalid',NULL,'completed',now(),clock_timestamp(),now(),'invalid')",
  );
  // A non-Discord bot participant with no token is retained unresolved, not matched by username.
  const result = await runActivityFeed('duels', { maxPages: 1 });
  check(result.unresolved === 1, 'non-Discord subject remains unresolved');
  await external.query(
    "INSERT INTO squig_duels VALUES ('invalid-token','888888888888888888',NULL,'completed',NULL,clock_timestamp(),NULL,'888888888888888888')",
  );
  const bad = await runActivityFeed('duels', { maxPages: 1 });
  check(bad.failed === 1, 'malformed source timestamp isolated');
  check(
    (
      await db().importRejection.findUniqueOrThrow({
        where: {
          source_sourceRecordId: {
            source: 'duels',
            sourceRecordId: 'invalid-token',
          },
        },
      })
    ).resolvedAt === null,
    'rejection persisted safely',
  );
  await external.query(
    "UPDATE squig_duels SET created_at=now(),completed_at=now() WHERE id='invalid-token'",
  );
  await runActivityFeed('duels', { maxPages: 2, reconcile: true });
  await runActivityFeed('duels', { maxPages: 2, reconcile: true });
  check(
    (
      await db().importRejection.findUniqueOrThrow({
        where: {
          source_sourceRecordId: {
            source: 'duels',
            sourceRecordId: 'invalid-token',
          },
        },
      })
    ).resolvedAt !== null,
    'rolling reconciliation retries row without updated timestamp change',
  );
  const noConfig = await runActivityFeed('maw', { maxPages: 1 });
  check(
    noConfig.failed === 0,
    'unconfigured integration degrades independently',
  );
}
