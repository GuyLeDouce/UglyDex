import { db } from '../../src/server/db';
import {
  seedProgression,
  rebuildSubject,
  queueReplay,
  processProgression,
} from '../../src/server/progression-engine';
import { progressionView } from '../../src/server/progression';
import { importRecord } from '../../src/sync/import-event';
import { duelEvents } from '../../src/integrations/uglybot/duels';
import { RULESET } from '../../src/domain/progression';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import { updateProgressionPresentation } from '../../src/server/progression-preferences';
import { fixtures } from '../fixtures/activity';
import { feeds, normalizeRow } from '../../src/sync/normalize';
export async function phase4DatabaseTests(
  check: (v: unknown, message: string) => void,
) {
  await seedProgression();
  await seedProgression();
  check(
    (await db().progressionRuleset.count({ where: { id: RULESET } })) === 1,
    'progression seed idempotency',
  );
  check(
    (await db().achievementDefinition.count({
      where: { ruleset: RULESET },
    })) === 65,
    'versioned achievement catalog seeded',
  );
  const c = await db().collector.create({
      data: { slug: 'progression-test', isPublic: true },
    }),
    b = await db().collector.create({
      data: { slug: 'progression-recipient' },
    });
  await db().externalIdentity.create({
    data: {
      collectorId: c.id,
      provider: 'DISCORD',
      externalId: '744444444444444444',
    },
  });
  const s = await db().squig.upsert({
    where: {
      chainId_contractAddress_tokenId: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: 4401,
      },
    },
    create: { chainId: 1, contractAddress: SQUIGS_CONTRACT, tokenId: 4401 },
    update: {},
  });
  const row = (i: number) => ({
    id: `p4-${i}`,
    challenger_id: '744444444444444444',
    challenger_squig_token_id: 4401,
    status: 'completed',
    winner_id: '744444444444444444',
    completed_at: new Date(Date.UTC(2026, 0, 1 + i)),
    created_at: new Date(Date.UTC(2026, 0, 1 + i)),
    wager_amount: '1000',
  });
  for (let i = 0; i < 10; i++)
    await importRecord('duels', `p4-${i}`, duelEvents(row(i)));
  check(
    (await db().progressionJob.count({ where: { subjectId: c.id } })) === 1,
    'transactional outbox coalesces subject work',
  );
  await rebuildSubject('COLLECTOR', c.id);
  await rebuildSubject('SQUIG', s.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 250n,
    'Collector evidence-backed XP',
  );
  check(
    (await db().squigProgress.findUniqueOrThrow({ where: { squigId: s.id } }))
      .xp === 250n,
    'explicit Squig evidence-backed XP',
  );
  const replay = await rebuildSubject('COLLECTOR', c.id);
  check(
    replay.created === 0 && replay.revoked === 0 && replay.unlocked === 0,
    'replay produces no duplicate grants',
  );
  const audits = await db().progressionAudit.count({
    where: { subjectId: c.id },
  });
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (await db().progressionAudit.count({ where: { subjectId: c.id } })) ===
      audits,
    'identical replay produces no correction audit noise',
  );
  const progress = await progressionView('COLLECTOR', c.id, true);
  check(
    progress?.status === 'ready' && progress.xp === '250',
    'public progression summary from materialized state',
  );
  const serialized = JSON.stringify(progress);
  check(
    !serialized.includes('744444444444444444') &&
      !serialized.includes('p4-') &&
      !serialized.includes('activityId') &&
      !serialized.includes('evidence'),
    'public DTO excludes source identities and evidence',
  );
  check(
    progress?.status === 'ready' &&
      progress.cards.some(
        (a) =>
          a.name === '???' && a.description === 'A little mystery remains.',
      ),
    'locked hidden achievements stay hidden',
  );
  check(
    (await progressionView('COLLECTOR', b.id, true)) === null,
    'private collector progression protected',
  );
  const winId = `${RULESET}:collector-wins-10`;
  const unlocked = await db().collectorAchievement.findUniqueOrThrow({
    where: {
      collectorId_achievementId: { collectorId: c.id, achievementId: winId },
    },
  });
  check(
    unlocked.awardedAt!.toISOString() ===
      new Date(Date.UTC(2026, 0, 10)).toISOString(),
    'retroactive unlock uses qualifying historical timestamp',
  );
  await importRecord(
    'duels',
    'p4-9',
    duelEvents({
      ...row(9),
      opponent_id: '999999999999999999',
      winner_id: '999999999999999999',
    }),
  );
  check(
    (await progressionView('COLLECTOR', c.id, true))?.status === 'pending',
    'pending corrections withhold stale public progression',
  );
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 240n,
    'corrected Duel reverses win XP',
  );
  check(
    !!(
      await db().collectorAchievement.findUniqueOrThrow({
        where: {
          collectorId_achievementId: {
            collectorId: c.id,
            achievementId: winId,
          },
        },
      })
    ).revokedAt,
    'threshold achievement revoked',
  );
  await importRecord('duels', 'p4-9', duelEvents(row(9)));
  await rebuildSubject('COLLECTOR', c.id);
  check(
    !(
      await db().collectorAchievement.findUniqueOrThrow({
        where: {
          collectorId_achievementId: {
            collectorId: c.id,
            achievementId: winId,
          },
        },
      })
    ).revokedAt,
    'restored evidence re-unlocks achievement',
  );
  const restored = await db().xpLedgerEntry.count({
    where: { subjectId: c.id, revokedAt: null },
  });
  check(restored === 20, 'restored grants never duplicate');
  await updateProgressionPresentation(c.id, {
    title: 'collector-wins-10',
    badges: ['collector-wins-10', 'collector-duels-1'],
  });
  const display = await progressionView('COLLECTOR', c.id, true);
  check(
    display?.status === 'ready' &&
      display.title === 'Duel Freak' &&
      display.featured.length === 2,
    'unlocked title and featured badges projected',
  );
  for (const input of [
    { title: 'Admin', badges: [] },
    { title: '', badges: ['collector-wins-50'] },
    { title: '', badges: Array(5).fill('collector-wins-10') },
  ]) {
    let blocked = false;
    try {
      await updateProgressionPresentation(c.id, input);
    } catch {
      blocked = true;
    }
    check(blocked, 'unearned or excessive presentation rejected');
  }
  await db().collectorActivity.updateMany({
    where: { sourceId: 'p4-9', collectorId: c.id },
    data: { collectorId: b.id },
  });
  check(
    (await db().progressionJob.count({
      where: { subjectId: { in: [c.id, b.id] } },
    })) === 2,
    'reattribution queues both old/new collectors',
  );
  await rebuildSubject('COLLECTOR', c.id);
  await rebuildSubject('COLLECTOR', b.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 225n,
    'old attribution revoked',
  );
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: b.id },
      })
    ).xp === 25n,
    'new attribution rewarded',
  );
  await db().collectorActivity.updateMany({
    where: { sourceId: 'p4-9', collectorId: b.id },
    data: { attributionStatus: 'CONFLICT' },
  });
  await rebuildSubject('COLLECTOR', b.id);
  await rebuildSubject('SQUIG', s.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: b.id },
      })
    ).xp === 0n,
    'unresolved attribution no Collector XP',
  );
  check(
    (await db().squigProgress.findUniqueOrThrow({ where: { squigId: s.id } }))
      .xp === 250n,
    'Squig XP independent of owner identity',
  );
  for (let i = 0; i < 10; i++) await importRecord('duels', `p4-${i}`, []);
  await rebuildSubject('COLLECTOR', c.id);
  await rebuildSubject('SQUIG', s.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).level === 1,
    'retraction recalculates level downward',
  );
  check(
    (await db().progressionMilestone.count({ where: { subjectId: c.id } })) ===
      0,
    'invalidated level milestones removed',
  );
  check(
    (await db().xpLedgerEntry.count({
      where: { subjectId: s.id, revokedAt: null },
    })) === 0,
    'retracted Squig XP revoked',
  );
  await db().squig.update({
    where: { id: s.id },
    data: { og: true, legendary: true },
  });
  await db().squigProvenance.upsert({
    where: { squigId: s.id },
    create: {
      squigId: s.id,
      dirty: false,
      complete: true,
      mintAt: new Date('2026-01-01'),
      mintTransaction: '0x' + 'a'.repeat(64),
    },
    update: {
      dirty: false,
      complete: true,
      mintAt: new Date('2026-01-01'),
      mintTransaction: '0x' + 'a'.repeat(64),
    },
  });
  await db().collectorOwnershipPeriod.create({
    data: {
      id: 'test-confirmed-period',
      collectorId: c.id,
      squigId: s.id,
      acquiredAt: new Date('2026-01-01'),
      evidenceIds: ['reviewed-fixture'],
      walletAddresses: ['0x' + '1'.repeat(40)],
      acquisitionEvent: 'fixture-mint',
    },
  });
  await db().squigDiscovery.create({
    data: {
      collectorId: c.id,
      squigId: s.id,
      discoveredAt: new Date('2026-01-01'),
      sourceKey: 'provenance',
      everOwned: true,
      attributionStatus: 'CONFIRMED',
      firstOwnershipPeriod: 'test-confirmed-period',
    },
  });
  await rebuildSubject('COLLECTOR', c.id);
  await rebuildSubject('SQUIG', s.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 100n,
    'confirmed discovery plus canonical OG/Legendary XP',
  );
  check(
    (await db().squigProgress.findUniqueOrThrow({ where: { squigId: s.id } }))
      .xp === 20n,
    'verified mint grants one-time Squig XP',
  );
  await db().collectorOwnershipPeriod.update({
    where: { id: 'test-confirmed-period' },
    data: { lostAt: new Date('2026-02-01'), lossEvent: 'fixture-sale' },
  });
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 100n,
    'sale preserves legitimate discovery XP and historical achievements',
  );
  await db().squigProvenance.update({
    where: { squigId: s.id },
    data: { dirty: true },
  });
  await rebuildSubject('SQUIG', s.id);
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (await db().squigProgress.findUniqueOrThrow({ where: { squigId: s.id } }))
      .xp === 0n,
    'dirty provenance gates Squig mint',
  );
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 0n,
    'dirty provenance gates discoveries',
  );
  await db().squigProvenance.update({
    where: { squigId: s.id },
    data: { dirty: false },
  });
  await db().squigDiscovery.updateMany({
    where: { collectorId: c.id, squigId: s.id },
    data: { attributionStatus: 'INVALIDATED', everOwned: false },
  });
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 0n,
    'invalidated discovery revokes XP',
  );
  await db().xpLedgerEntry.create({
    data: {
      id: 'future-version-test',
      ruleset: 'test-other-ruleset',
      subjectType: 'COLLECTOR',
      subjectId: c.id,
      ruleId: 'other',
      grantKey: 'other',
      xp: 999,
      earnedAt: new Date('2026-01-01'),
      evidence: {},
    },
  });
  await rebuildSubject('COLLECTOR', c.id);
  check(
    !(
      await db().xpLedgerEntry.findUniqueOrThrow({
        where: { id: 'future-version-test' },
      })
    ).revokedAt,
    'ruleset isolation preserves separate ledger',
  );
  await importRecord('duels', 'p4-0', duelEvents(row(0)));
  const concurrent = await Promise.allSettled([
    rebuildSubject('COLLECTOR', c.id),
    rebuildSubject('COLLECTOR', c.id),
  ]);
  check(
    concurrent.some((r) => r.status === 'fulfilled'),
    'concurrent evaluation completes one transaction',
  );
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (await db().xpLedgerEntry.count({
      where: { ruleset: RULESET, subjectId: c.id, revokedAt: null },
    })) === 2,
    'concurrency cannot duplicate grants',
  );
  const wallet = '0x' + '4'.repeat(40);
  await db().collectorActivity.updateMany({
    where: { sourceType: 'duels', sourceId: 'p4-0', collectorId: c.id },
    data: {
      discordId: null,
      walletAddress: wallet,
      attributionStatus: 'WALLET',
    },
  });
  await db().activityAttributionJob.upsert({
    where: { walletAddress: wallet },
    create: { walletAddress: wallet },
    update: { generation: { increment: 1 } },
  });
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 0n,
    'pending wallet attribution withholds stale Collector grants',
  );
  await db().activityAttributionJob.delete({
    where: { walletAddress: wallet },
  });
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === 25n,
    'resolved wallet job queues and restores qualifying grants',
  );
  await db().progressionJob.deleteMany(); // This entire suite uses a guarded disposable database.
  await queueReplay(true);
  const cursor1 = await db().progressionReplay.findUniqueOrThrow({
    where: { id: RULESET },
  });
  await queueReplay();
  check(!!cursor1, 'durable replay checkpoint');
  while (!(await queueReplay())) {
    /* Resume bounded enqueue transactions. */
  }
  const subjects = (await db().collector.count()) + (await db().squig.count());
  check(
    (await db().progressionJob.count()) === subjects,
    'global replay enqueues every subject across resumable pages',
  );
  await queueReplay();
  check(
    (await db().progressionJob.count()) === subjects,
    'completed replay does not duplicate queued jobs',
  );
  const batch = await processProgression(1);
  check(
    batch.processed === 1 && batch.failed === 0,
    'incremental worker processes a bounded subject batch',
  );
  check(
    (await db().progressionJob.count()) === subjects - 1,
    'worker acknowledges the successfully evaluated generation',
  );
  await db().progressionRuleset.update({
    where: { id: RULESET },
    data: { fingerprint: 'tampered' },
  });
  let rejected = false;
  try {
    await seedProgression();
  } catch {
    rejected = true;
  }
  check(rejected, 'same ruleset cannot silently change');
  await db().progressionRuleset.delete({ where: { id: RULESET } });
  await seedProgression();
  const ec = await db().collector.create({
    data: { slug: 'progression-ecosystem' },
  });
  await db().externalIdentity.create({
    data: {
      collectorId: ec.id,
      provider: 'DISCORD',
      externalId: '755555555555555555',
    },
  });
  const ecosystemRows = Object.fromEntries(
    feeds.map((feed) => [
      feed,
      {
        ...fixtures[feed],
        id: 'p4-ecosystem',
        user_id: '755555555555555555',
        discord_user_id: '755555555555555555',
        discord_id: '755555555555555555',
        challenger_id: '755555555555555555',
        winner_id: '755555555555555555',
        winner_discord_id: '755555555555555555',
        sender_discord_id: '755555555555555555',
        delivered_to_discord_id: '755555555555555555',
        image_url: 'https://example.org/phase4-approved.png',
        live_image_id: 'p4-ecosystem',
      },
    ]),
  );
  for (const feed of feeds)
    await importRecord(
      feed,
      'p4-ecosystem',
      normalizeRow(feed, ecosystemRows[feed]),
    );
  await rebuildSubject('COLLECTOR', ec.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: ec.id },
      })
    ).xp === 250n,
    'canonical ecosystem fixtures award fixed participation with image deduplication',
  );
  const unlockedCategories = await db().collectorAchievement.findMany({
    where: { collectorId: ec.id, revokedAt: null },
    include: { achievement: true },
  });
  for (const category of [
    'Duels',
    'Survival',
    'Creator',
    'Bounty',
    'Maw',
    'Marketplace',
    'Ecosystem',
  ])
    check(
      unlockedCategories.some((a) => a.achievement.category === category),
      category + ' achievements backed by canonical imported fixtures',
    );
  for (const [feed, row] of [
    ['submissions', { ...ecosystemRows.submissions, status: 'declined' }],
    [
      'madlibPublications',
      { ...ecosystemRows.madlibPublications, status: 'draft' },
    ],
    ['survival', { ...ecosystemRows.survival, placement: null }],
  ] as const)
    await importRecord(feed, 'p4-ecosystem', normalizeRow(feed, row));
  await rebuildSubject('COLLECTOR', ec.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: ec.id },
      })
    ).xp === 135n,
    'declined/private/pending sources remove participation and never expose private content',
  );
  // Leave a real evaluated fixture available to the production HTTP/browser assertions.
  await rebuildSubject('COLLECTOR', c.id);
  await rebuildSubject('SQUIG', s.id);
}
