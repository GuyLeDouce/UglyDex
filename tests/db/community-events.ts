import { db } from '../../src/server/db';
import { collectorThread } from '../../src/server/community';
import {
  publicationBaseline,
  publishCommunityCard,
} from '../../src/server/community-publication';

export async function communityEventTests(
  check: (v: unknown, m: string) => void,
) {
  const start = new Date('2020-01-01');
  const make = async (slug: string, isPublic = true) =>
    db().collector.create({
      data: {
        slug,
        displayName: slug,
        showUsername: true,
        isPublic,
        showCommunityActivity: true,
        showDiscord: true,
        discordTrackingConsent: true,
        claimedAt: start,
        onboardingCompletedAt: start,
        communityFeedSince: start,
      },
    });
  const [first, second, third] = await Promise.all([
    make('feed-gold'),
    make('feed-silver'),
    make('feed-bronze'),
  ]);
  const eventAt = new Date('2035-01-01');
  const activity = async (
    collectorId: string,
    eventType: string,
    sourceId: string,
    metadata: object,
  ) =>
    db().collectorActivity.create({
      data: {
        collectorId,
        eventKey: `feed-fixture:${eventType}:${sourceId}`,
        sourceSystem:
          eventType === 'MARKETPLACE_PURCHASE' ? 'uglybot' : 'gauntlet',
        sourceType:
          eventType === 'SURVIVAL_PLAYED'
            ? 'survival'
            : eventType === 'MARKETPLACE_PURCHASE'
              ? 'marketplace'
              : 'runs',
        sourceId,
        subjectKey: 'fixture',
        eventType,
        eventAt,
        metadata,
        payloadHash: 'fixture',
        visibility: 'PUBLIC',
        attributionStatus: 'DISCORD',
        updatedAt: eventAt,
      },
    });
  await activity(first.id, 'SURVIVAL_PLAYED', '900001:111111111111111111', {
    placement: 1,
    completed: false,
  });
  await activity(second.id, 'SURVIVAL_PLAYED', '900001:222222222222222222', {
    placement: 2,
    completed: false,
  });
  await activity(third.id, 'SURVIVAL_PLAYED', '900001:333333333333333333', {
    placement: 3,
    completed: false,
  });
  check(
    !(await collectorThread()).cards.some(
      (c) => c.kind === 'survival' && c.key === '900001',
    ),
    'unfinished Survival standings stay out of the feed',
  );
  await db().collectorActivity.updateMany({
    where: { sourceId: { startsWith: '900001:' } },
    data: { metadata: { completed: true, placement: 1 } },
  });
  // Restore distinct placements after finishing the game.
  for (const [i, c] of [first, second, third].entries())
    await db().collectorActivity.updateMany({
      where: { collectorId: c.id, eventType: 'SURVIVAL_PLAYED' },
      data: { metadata: { completed: true, placement: i + 1 } },
    });
  const thread = await collectorThread();
  const podium = thread.cards.find(
    (c) => c.kind === 'survival' && c.key === '900001',
  );
  check(
    podium && 'players' in podium && podium.players?.length === 3,
    'completed Survival appears once with all three public podium players',
  );
  check(
    thread.cards.filter((c) => c.kind === 'survival' && c.key === '900001')
      .length === 1,
    'a game has one feed entry rather than three player posts',
  );
  check(
    (await collectorThread(1, second.slug)).cards.some(
      (c) => c.kind === 'survival' && c.key === '900001',
    ),
    'personal feed includes a podium even when its collector is not the group anchor',
  );
  await db().collector.update({
    where: { id: second.id },
    data: { showCommunityActivity: false },
  });
  const hidden = JSON.stringify(
    (await collectorThread()).cards.filter(
      (c) => c.kind === 'survival' && c.key === '900001',
    ),
  );
  check(
    !hidden.includes(second.slug) && hidden.includes(third.slug),
    'podium visibility changes immediately without exposing private players',
  );
  await activity(first.id, 'MARKETPLACE_PURCHASE', 'purchase-test', {
    confirmed: false,
    item: 'Epic Squig',
    quantity: 1,
    status: 'pending',
  });
  check(
    !(await collectorThread()).cards.some(
      (c) => c.kind === 'marketplace' && c.slug === first.slug,
    ),
    'pending marketplace purchases are not announced',
  );
  await db().collectorActivity.updateMany({
    where: { sourceId: 'purchase-test' },
    data: {
      metadata: {
        confirmed: true,
        item: 'Epic Squig',
        quantity: 1,
        status: 'paid_pending_delivery',
      },
    },
  });
  const purchase = (await collectorThread()).cards.find(
    (c) => c.kind === 'marketplace' && c.slug === first.slug,
  );
  check(
    purchase?.title === 'Purchased Epic Squig' &&
      'detail' in purchase &&
      purchase.detail === 'Purchase confirmed',
    'confirmed marketplace post names the item without claiming delivery',
  );
  await activity(first.id, 'GAUNTLET_COMPLETED', 'run-test', {
    score: 123,
    finalRound: 8,
  });
  check(
    (await collectorThread()).cards.some(
      (c) => c.kind === 'gauntlet' && c.slug === first.slug,
    ),
    'completed Gauntlet runs enter the feed',
  );
  await db().collector.update({
    where: { id: first.id },
    data: { showDiscord: false },
  });
  check(
    !(await collectorThread()).cards.some(
      (c) =>
        c.slug === first.slug && ['gauntlet', 'marketplace'].includes(c.kind),
    ),
    'Discord opt-out hides source activity immediately',
  );
  await db().collector.update({
    where: { id: first.id },
    data: { showDiscord: true, communityFeedSince: new Date('2036-01-01') },
  });
  check(
    !(await collectorThread()).cards.some(
      (c) =>
        c.slug === first.slug && ['gauntlet', 'marketplace'].includes(c.kind),
    ),
    'old imported events do not become fresh posts',
  );
  check(
    (await publicationBaseline(db(), third.id, null)) === null,
    'first calculation is a silent baseline',
  );
  const since = await publicationBaseline(
    db(),
    third.id,
    new Date('2021-01-01'),
  );
  check(
    since?.getTime() === start.getTime(),
    'established accounts can announce genuinely new awards',
  );
  await db().collectorWallet.create({
    data: {
      collectorId: third.id,
      chainId: 1,
      walletAddress: '0x' + 'cd'.repeat(20),
      source: 'SIWE',
      verifiedAt: new Date(),
      firstSeenAt: new Date(),
    },
  });
  check(
    (await publicationBaseline(db(), third.id, new Date('2021-01-01'))) ===
      null,
    'new wallet links force a silent baseline',
  );
  await publishCommunityCard(db(), third.id, 'welcome', 'joined', eventAt);
  await publishCommunityCard(
    db(),
    third.id,
    'welcome',
    'joined',
    new Date('2036-01-01'),
  );
  check(
    (await db().communityFeedEvent.count({
      where: { collectorId: third.id, kind: 'welcome' },
    })) === 1,
    'retries do not duplicate welcome cards',
  );
  // Games/purchases already underway at rollout still publish when completion
  // is observed. Historical imports/corrections without that transition stay silent.
  await db().collector.update({
    where: { id: first.id },
    data: { communityFeedSince: new Date('2034-01-01') },
  });
  const ongoing = await activity(
    first.id,
    'SURVIVAL_PLAYED',
    '900002:111111111111111111',
    { completed: true, placement: 1 },
  );
  await db().collectorActivity.update({
    where: { id: ongoing.id },
    data: { eventAt: new Date('2030-01-01'), updatedAt: eventAt },
  });
  check(
    !(await collectorThread(1, first.slug)).cards.some(
      (c) => c.kind === 'survival' && c.key === '900002',
    ),
    'an old completed game import stays silent',
  );
  await db().activityCorrection.create({
    data: {
      activityId: ongoing.id,
      reason: 'SOURCE_CORRECTION',
      before: { collectorId: first.id, metadata: { completed: false } },
      afterHash: 'fixture',
      createdAt: eventAt,
    },
  });
  check(
    (await collectorThread(1, first.slug)).cards.some(
      (c) => c.kind === 'survival' && c.key === '900002',
    ),
    'a game started before rollout publishes when it newly finishes',
  );
  const pendingPurchase = await db().collectorActivity.findFirstOrThrow({
    where: { sourceId: 'purchase-test' },
  });
  await db().collectorActivity.update({
    where: { id: pendingPurchase.id },
    data: { eventAt: new Date('2030-01-01'), updatedAt: eventAt },
  });
  await db().activityCorrection.create({
    data: {
      activityId: pendingPurchase.id,
      reason: 'SOURCE_CORRECTION',
      before: { collectorId: first.id, metadata: { confirmed: false } },
      afterHash: 'fixture',
      createdAt: eventAt,
    },
  });
  check(
    (await collectorThread(1, first.slug)).cards.some(
      (c) => c.kind === 'marketplace' && c.key === pendingPurchase.id,
    ),
    'an existing pending purchase publishes on a fresh confirmation',
  );
  // Keep the original integration/browser fixture isolated from these records.
  await db().collector.updateMany({
    where: { id: { in: [first.id, second.id, third.id] } },
    data: { showCommunityActivity: false },
  });
}
