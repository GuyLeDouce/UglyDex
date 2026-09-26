import { Prisma } from '../../src/generated/prisma/client';
import { db } from '../../src/server/db';
import {
  seedCollections,
  rebuildCollection,
  processCollections,
  queueCollections,
} from '../../src/server/dex-engine';
import {
  dexView,
  saveFeaturedSets,
  personalizedCandidates,
  traitView,
} from '../../src/server/dex';
import { COLLECTION_RULESET as R } from '../../src/domain/dex';
import { canonicalTokens } from '../../src/domain/dex-catalog';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import { collectionPage } from '../../src/server/collections';
export async function phase5DatabaseTests(
  check: (v: unknown, m: string) => void,
) {
  await seedCollections();
  await seedCollections();
  check(
    (await db().collectionRuleset.count({ where: { id: R } })) === 1,
    'collection seed idempotent',
  );
  check(
    (await db().canonicalTrait.count({ where: { ruleset: R } })) === 345,
    'versioned canonical trait catalog',
  );
  check(
    (await db().collectionSetDefinition.count({ where: { ruleset: R } })) ===
      52,
    '52 versioned sets',
  );
  const c = await db().collector.create({
      data: { slug: 'dex-test', isPublic: true },
    }),
    privateC = await db().collector.create({ data: { slug: 'dex-private' } });
  const wallet = '0x00000000000000000000000000000000000de555';
  await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      walletAddress: wallet,
      chainId: 1,
      verifiedAt: new Date('2026-01-01'),
      source: 'SIGNATURE',
    },
  });
  const sample = canonicalTokens.find((t) => t.tokenId === 4300)!;
  const squig = await db().squig.upsert({
    where: {
      chainId_contractAddress_tokenId: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: 4300,
      },
    },
    create: {
      chainId: 1,
      contractAddress: SQUIGS_CONTRACT,
      tokenId: 4300,
      og: sample.og,
      legendary: sample.legendary,
      rarityTier: sample.rarityTier,
    },
    update: {
      og: sample.og,
      legendary: sample.legendary,
      rarityTier: sample.rarityTier,
    },
  });
  for (const [traitType, value] of Object.entries(sample.traits))
    await db().squigTrait.upsert({
      where: { squigId_traitType: { squigId: squig.id, traitType } },
      create: { squigId: squig.id, traitType, value },
      update: { value },
    });
  const at = new Date('2026-02-01');
  await db().squigProvenance.upsert({
    where: { squigId: squig.id },
    create: { squigId: squig.id, complete: true, dirty: false },
    update: { complete: true, dirty: false },
  });
  await db().collectorOwnershipPeriod.create({
    data: {
      id: 'dex-period',
      collectorId: c.id,
      squigId: squig.id,
      acquiredAt: at,
      acquisitionEvent: 'dex-mint',
      evidenceIds: ['admin-private-evidence'],
      walletAddresses: [wallet],
    },
  });
  await db().squigDiscovery.create({
    data: {
      collectorId: c.id,
      squigId: squig.id,
      discoveredAt: at,
      sourceKey: 'dex-fixture',
      everOwned: true,
      attributionStatus: 'CONFIRMED',
      firstOwnershipPeriod: 'dex-period',
    },
  });
  const own = await db().squigOwnership.create({
    data: {
      squigId: squig.id,
      walletAddress: wallet,
      sourceKey: 'dex-current',
      source: 'chain',
      blockNumber: 1n,
      blockHash: 'fixture',
      isCurrent: true,
    },
  });
  check(
    (await dexView(c.id))?.status === 'pending',
    'pending state withholds completion',
  );
  const first = await rebuildCollection(c.id);
  check(
    first.traits > 0 && first.discovered === 1,
    'confirmed historical evidence discovers traits',
  );
  let view = await dexView(c.id);
  check(
    view?.status === 'ready' && view.discovered === 1,
    'materialized collection completion',
  );
  check(
    view?.status === 'ready' &&
      view.cards.find((s) => s.key === 'room-for-one')?.complete,
    'current ownership completes set',
  );
  const auditCount = await db().collectionAudit.count({
    where: { collectorId: c.id },
  });
  const repeat = await rebuildCollection(c.id);
  check(
    repeat.changed === 0 &&
      (await db().collectionAudit.count({ where: { collectorId: c.id } })) ===
        auditCount,
    'identical replay has zero new audit transitions',
  );
  await saveFeaturedSets(c.id, ['first-specimen', 'room-for-one']);
  view = await dexView(c.id, true);
  check(
    view?.status === 'ready' &&
      view.cards.filter((s) => s.featured).length === 2,
    'completed sets can be featured',
  );
  check(
    !JSON.stringify(view).includes(wallet) &&
      !JSON.stringify(view).includes('admin-private-evidence'),
    'public DTO excludes identity evidence',
  );
  check(
    view?.status === 'ready' &&
      view.cards.every((s) =>
        s.requirements.every((r) => r.tokens.length === 0),
      ),
    'hidden wallets suppress public qualifying token evidence',
  );
  check(
    (await dexView(privateC.id, true)) === null,
    'private collector has no public Dex',
  );
  check(
    (await traitView(c.id)).traits.some(
      (t) => t.first?.tokenId === 4300 && t.owned === 1,
    ),
    'batched trait count and first token',
  );
  let rejected = false;
  try {
    await saveFeaturedSets(c.id, ['living-library']);
  } catch {
    rejected = true;
  }
  check(rejected, 'cannot feature unearned set');
  rejected = false;
  try {
    await saveFeaturedSets(c.id, ['first-specimen', 'first-specimen']);
  } catch {
    rejected = true;
  }
  check(rejected, 'duplicate showcase keys rejected');
  const before = await dexView(c.id);
  await db().squigOwnership.update({
    where: { id: own.id },
    data: { isCurrent: false },
  });
  await db().collectorOwnershipPeriod.update({
    where: { id: 'dex-period' },
    data: { lostAt: new Date('2026-03-01') },
  });
  check(
    (await db().collectionJob.count({ where: { collectorId: c.id } })) === 1,
    'ownership loss enqueues collection',
  );
  await rebuildCollection(c.id);
  view = await dexView(c.id);
  check(
    view?.status === 'ready' &&
      !view.cards.find((s) => s.key === 'room-for-one')?.complete,
    'current set loses completion on sale',
  );
  check(
    view?.status === 'ready' &&
      view.cards.find((s) => s.key === 'first-specimen')?.complete,
    'historical set survives sale',
  );
  check(
    view?.status === 'ready' &&
      before?.status === 'ready' &&
      view.score.overall === before.score.overall,
    'sale does not reduce permanent completion',
  );
  check(
    view?.status === 'ready' &&
      !!view.cards.find((s) => s.key === 'room-for-one')?.firstCompletedAt,
    'first current completion survives loss',
  );
  check(
    view?.status === 'ready' &&
      !view.cards.find((s) => s.key === 'room-for-one')?.featured,
    'lost current set removed from showcase',
  );
  const hints = await personalizedCandidates(c.id);
  check(
    hints?.['4300']?.discovered && !hints['4300'].owned,
    'current versus discovered hints',
  );
  const excluded = await collectionPage(
    { q: '4300', dex: 'undiscovered' },
    undefined,
    false,
    c.id,
  );
  check(
    excluded.total === 0,
    'undiscovered personalized filter excludes known token',
  );
  check(
    (await collectionPage({ dex: 'advances' })).total === 0,
    'unauthenticated personalized query has no private data',
  );
  check(
    (await collectionPage({}, undefined, false, c.id)).items.length <= 24,
    'personalization preserves server pagination',
  );
  await db().squigDiscovery.update({
    where: { collectorId_squigId: { collectorId: c.id, squigId: squig.id } },
    data: { attributionStatus: 'UNRESOLVED' },
  });
  await rebuildCollection(c.id);
  view = await dexView(c.id);
  check(
    view?.status === 'ready' && view.traits === 0 && view.discovered === 0,
    'invalidated attribution removes trait and Squig discovery',
  );
  check(
    view?.status === 'ready' &&
      !view.cards.find((s) => s.key === 'first-specimen')?.complete,
    'historical set invalidates with evidence',
  );
  check(
    (await db().collectionAudit.count({
      where: { collectorId: c.id, kind: 'TRAIT_INVALIDATED' },
    })) > 0,
    'trait invalidation is audited',
  );
  check(
    (await db().collectorTraitDiscovery.count({
      where: { collectorId: c.id, revokedAt: { not: null } },
    })) > 0,
    'revoked trait evidence retained',
  );
  await db().squigDiscovery.update({
    where: { collectorId_squigId: { collectorId: c.id, squigId: squig.id } },
    data: { attributionStatus: 'CONFIRMED' },
  });
  await rebuildCollection(c.id);
  view = await dexView(c.id);
  check(
    view?.status === 'ready' &&
      view.cards.find((s) => s.key === 'first-specimen')?.completedAt ===
        at.toISOString(),
    'restoration uses historical qualifying timestamp',
  );
  check(
    (await db().collectionMilestone.count({
      where: { collectorId: c.id, revokedAt: null },
    })) > 0,
    'derived milestones are separate records',
  );
  await db().squigProvenance.update({
    where: { squigId: squig.id },
    data: { dirty: true },
  });
  await rebuildCollection(c.id);
  view = await dexView(c.id);
  check(
    view?.status === 'ready' && view.discovered === 0,
    'dirty provenance blocks discovery',
  );
  await db().squigProvenance.update({
    where: { squigId: squig.id },
    data: { dirty: false },
  });
  await rebuildCollection(c.id);
  await db().squigOwnership.update({
    where: { id: own.id },
    data: { isCurrent: true },
  });
  await rebuildCollection(c.id);
  await db().collectorWallet.update({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: wallet } },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  await rebuildCollection(c.id);
  view = await dexView(c.id);
  check(
    view?.status === 'ready' &&
      view.currentIds.length === 0 &&
      view.discovered === 1,
    'wallet revocation removes current association but preserves valid history',
  );
  const state = await db().collectionSnapshot.findUniqueOrThrow({
    where: { ruleset_collectorId: { ruleset: R, collectorId: c.id } },
  });
  await db().collectionSnapshot.create({
    data: {
      ...state,
      candidates: state.candidates as Prisma.InputJsonValue,
      traitCounts: state.traitCounts as Prisma.InputJsonValue,
      ruleset: 'future-test',
      overall: 99,
    },
  });
  check(
    (await dexView(c.id))?.status === 'ready',
    'another ruleset does not replace active collection state',
  );
  await queueCollections(true);
  while (!(await queueCollections())) {}
  check(
    !!(await db().collectionReplay.findUnique({ where: { id: R } }))
      ?.completedAt,
    'global collection replay checkpoints',
  );
  const result = await processCollections(1);
  check(
    result.processed + result.failed === 1,
    'worker processes bounded batch',
  );
  await rebuildCollection(c.id);
  const concurrent = await Promise.allSettled([
    rebuildCollection(c.id),
    rebuildCollection(c.id),
  ]);
  check(
    concurrent.some((r) => r.status === 'fulfilled'),
    'concurrent evaluation commits complete snapshot',
  );
  await rebuildCollection(c.id);
  check(
    (await db().collectorSetProgress.count({
      where: { collectorId: c.id, set: { ruleset: R } },
    })) === 52,
    'concurrent replay never duplicates set rows',
  );
  const oldSkin = sample.traits.Skin,
    newSkin = oldSkin === 'Purple' ? 'Green' : 'Purple';
  await db().squigTrait.update({
    where: { squigId_traitType: { squigId: squig.id, traitType: 'Skin' } },
    data: { value: newSkin },
  });
  check(
    !!(await db().collectionJob.findUnique({ where: { collectorId: c.id } })),
    'metadata correction queues collector',
  );
  await rebuildCollection(c.id);
  let corrected = await traitView(c.id);
  check(
    corrected.traits.find((t) => t.key === 'Skin:' + newSkin)?.discovered ===
      1 &&
      corrected.traits.find((t) => t.key === 'Skin:' + oldSkin)?.discovered ===
        0,
    'metadata correction moves historical trait evidence',
  );
  await db().squigTrait.update({
    where: { squigId_traitType: { squigId: squig.id, traitType: 'Skin' } },
    data: { value: 'NOT_A_CANONICAL_TRAIT' },
  });
  rejected = false;
  try {
    await rebuildCollection(c.id);
  } catch {
    rejected = true;
  }
  check(
    rejected && (await dexView(c.id))?.status === 'pending',
    'unknown catalog value fails closed without stale completion claim',
  );
  await db().squigTrait.update({
    where: { squigId_traitType: { squigId: squig.id, traitType: 'Skin' } },
    data: { value: oldSkin },
  });
  await rebuildCollection(c.id);
  corrected = await traitView(c.id);
  check(
    corrected.traits.find((t) => t.key === 'Skin:' + oldSkin)?.discovered === 1,
    'metadata evidence restores after correction',
  );
  const fingerprint = await db().collectionRuleset.findUniqueOrThrow({
    where: { id: R },
  });
  await db().collectionRuleset.update({
    where: { id: R },
    data: { fingerprint: 'tampered' },
  });
  rejected = false;
  try {
    await seedCollections();
  } catch {
    rejected = true;
  }
  check(rejected, 'same-version catalog mutation rejected');
  await db().collectionRuleset.update({
    where: { id: R },
    data: { fingerprint: fingerprint.fingerprint },
  });
}
