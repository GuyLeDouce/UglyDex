import { setFavorite, favoriteTokenIds } from '../../src/server/favorites';
import { collectorProfile } from '../../src/server/profiles';
import { shareCard } from '../../src/server/sharing';
import {
  progressionFacts,
  seedProgression,
  rebuildSubject,
} from '../../src/server/progression-engine';
import { evaluate } from '../../src/domain/progression';
import { db } from '../../src/server/db';
import {
  collectionEvidence,
  rebuildCollection,
  seedCollections,
  queueCollections,
} from '../../src/server/dex-engine';
import { collectionSummary } from '../../src/server/collections';
import { dexView } from '../../src/server/dex';
import { canonicalTokens } from '../../src/domain/dex-catalog';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
export async function fieldGuidePossessionTests(
  check: (v: unknown, m: string) => void,
) {
  const c = await db().collector.create({
    data: { slug: 'possession-regression', claimedAt: new Date('2026-01-01') },
  });
  const wallet = '0x' + 'cb'.repeat(20);
  const credential = await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      walletAddress: wallet,
      chainId: 1,
      source: 'SIWE',
      verifiedAt: new Date('2026-01-01'),
    },
  });
  const at = new Date('2026-02-01');
  const ids: string[] = [];
  // Reproduce the reported shape: 274 current, 315 proven observations, unfinished transfer history.
  for (const token of canonicalTokens.slice(0, 315)) {
    const s = await db().squig.upsert({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: token.tokenId,
        },
      },
      create: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: token.tokenId,
        og: token.og,
        legendary: token.legendary,
        rarityTier: token.rarityTier,
      },
      update: {},
    });
    ids.push(s.id);
    await db().squigTrait.createMany({
      data: Object.entries(token.traits).map(([traitType, value]) => ({
        squigId: s.id,
        traitType,
        value,
      })),
      skipDuplicates: true,
    });
    await db().squigProvenance.upsert({
      where: { squigId: s.id },
      create: { squigId: s.id, dirty: true, complete: false },
      update: { dirty: true, complete: false },
    });
    const key = `possession:${s.id}`;
    await db().squigOwnership.create({
      data: {
        squigId: s.id,
        walletAddress: wallet,
        source: 'ownerOf',
        sourceKey: key,
        blockNumber: 99n,
        blockHash: 'fixture',
        observedAt: at,
        isCurrent: ids.length <= 274,
      },
    });
    await db().squigDiscovery.create({
      data: {
        collectorId: c.id,
        squigId: s.id,
        sourceKey: key,
        discoveredAt: at,
        everOwned: true,
      },
    });
  }
  // Existing attributed history must not be re-filtered by full provenance joins.
  await db().squigDiscovery.updateMany({
    where: { collectorId: c.id, squigId: ids[1] },
    data: { attributionStatus: 'CONFIRMED', firstOwnershipPeriod: null },
  });
  // A current holding is a discovery even before its discovery row is materialized.
  await db().squigDiscovery.deleteMany({
    where: { collectorId: c.id, squigId: ids[0] },
  });
  check(
    (await collectionSummary(c.id)).discovered === 315,
    'current union fills missing discovery without duplicate counting',
  );
  await seedCollections();
  await rebuildCollection(c.id);
  const summary = await collectionSummary(c.id),
    view = await dexView(c.id);
  check(
    summary.owned === 274,
    'ownerOf holdings survive pending transfer history',
  );
  check(
    summary.discovered === 315,
    'verified point observations count after sales',
  );
  check(
    view?.status === 'ready' && view.discovered === summary.discovered,
    'profile and completion share discovery evidence',
  );
  check(
    view?.status === 'ready' && view.currentSets > 0 && view.traits > 0,
    'possession contributes current sets and discovery traits',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: true, collectionVisibility: 'FULL' },
  });
  const selected = canonicalTokens.slice(0, 7).map((s) => s.tokenId);
  for (const tokenId of selected.slice(0, 5))
    await setFavorite(c.id, { tokenId, favorite: true });
  const concurrent = await Promise.allSettled(
    selected
      .slice(5)
      .map((tokenId) => setFavorite(c.id, { tokenId, favorite: true })),
  );
  check(
    concurrent.filter((r) => r.status === 'fulfilled').length === 1,
    'concurrent favorites cannot exceed six',
  );
  const favorites = await favoriteTokenIds(c.id);
  check(favorites.length === 6, 'six currently owned favorites retained');
  await setFavorite(c.id, { tokenId: favorites[0], favorite: true });
  check(
    (await favoriteTokenIds(c.id)).length === 6,
    'repeated favorite selection is idempotent',
  );
  let notOwned = false;
  try {
    await setFavorite(c.id, {
      tokenId: canonicalTokens[300].tokenId,
      favorite: true,
    });
  } catch {
    notOwned = true;
  }
  check(
    notOwned,
    'previously owned Squigs cannot be added as current favorites',
  );
  const publicProfile = await collectorProfile(c.slug);
  check(
    publicProfile.status === 'ready' && publicProfile.featured.length === 6,
    'public favorites include current holdings with incomplete provenance',
  );
  const publicCard = await shareCard({ kind: 'collector', entity: c.slug });
  check(
    publicCard?.collectorLayout?.squigs === summary.owned &&
      summary.owned === 274,
    'share card and Squigs Owned count identical current holdings despite incomplete provenance',
  );
  check(
    publicCard?.tokens.length === 6 &&
      publicCard.tokens.every((id) => favorites.includes(id)),
    'collector share card uses all six favorites',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'HIDDEN' },
  });
  const hiddenProfile = await collectorProfile(c.slug);
  check(
    hiddenProfile.status === 'ready' && hiddenProfile.featured.length === 0,
    'hidden collection does not expose favorites',
  );
  check(
    (await shareCard({ kind: 'collector', entity: c.slug }))?.tokens.length ===
      0,
    'public share card respects hidden collection',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'FULL' },
  });
  await db().squigOwnership.updateMany({
    where: { squigId: ids[0], walletAddress: wallet },
    data: { isCurrent: false },
  });
  check(
    (await collectionSummary(c.id)).discovered === 315,
    'sale retains the discovery materialized from current possession',
  );
  check(
    !(await favoriteTokenIds(c.id)).includes(selected[0]),
    'sold Squig is removed from visible favorites',
  );
  await setFavorite(c.id, { tokenId: selected[0], favorite: false });
  check(
    (await favoriteTokenIds(c.id)).length === 5,
    'a sold favorite can be safely removed',
  );
  check(
    (await shareCard({ kind: 'collector', entity: c.slug }))?.collectorLayout
      ?.squigs === (await collectionSummary(c.id)).owned,
    'share owned count follows sales',
  );
  const linked = '0x' + 'ca'.repeat(20);
  await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      chainId: 1,
      walletAddress: linked,
      verifiedAt: at,
      source: 'SIWE',
    },
  });
  await db().squigOwnership.create({
    data: {
      squigId: ids[0],
      walletAddress: linked,
      source: 'ownerOf',
      sourceKey: 'possession-rebuy',
      blockNumber: 100n,
      blockHash: 'fixture',
      observedAt: at,
      isCurrent: true,
    },
  });
  check(
    (await collectionSummary(c.id)).discovered === 315,
    'rebuy into another linked wallet does not duplicate discovery',
  );
  await db().squigOwnership.updateMany({
    where: { walletAddress: linked },
    data: { isCurrent: false },
  });
  // Old wallet observations with no collector attribution are not silently imported.
  await db().squigOwnership.create({
    data: {
      squigId: ids[0],
      walletAddress: linked,
      source: 'ownerOf',
      sourceKey: 'unattributed-past',
      blockNumber: 1n,
      blockHash: 'fixture',
      observedAt: new Date('2020-01-01'),
      isCurrent: false,
    },
  });
  check(
    (await collectionSummary(c.id)).discovered === 315,
    'linking does not manufacture additional historical identities',
  );
  await db().collectorWallet.update({
    where: { id: credential.id },
    data: { verifiedAt: new Date('2026-03-01') },
  });
  check(
    (await collectionEvidence(db(), c.id)).historical.length === 315,
    'credential changes do not erase already attributed collector history',
  );
  await db().collectorWallet.update({
    where: { id: credential.id },
    data: {
      verifiedAt: new Date('2026-01-01'),
      revokedAt: new Date('2026-03-01'),
      status: 'REVOKED',
    },
  });
  const revoked = await collectionEvidence(db(), c.id);
  check(
    revoked.historical.length === 315 && revoked.current.length === 0,
    'unlink retains valid historical possession but removes current holdings',
  );
  const evidence = await progressionFacts(db(), 'COLLECTOR', c.id);
  check(
    evidence.facts.filter((f) => f.type === 'DISCOVERY').length === 315,
    'achievement discoveries match lifetime Field Guide total after sale and unlink',
  );
  const awards = evaluate('COLLECTOR', evidence.facts, evidence.gates).awards;
  check(
    awards.find((a) => a.definition.name === 'Walking Encyclopedia')?.unlocked,
    '315 discoveries unlock the 250 discovery achievement',
  );
  check(
    !awards.find((a) => a.definition.name === 'The Living Dex')?.unlocked,
    '315 discoveries do not unlock the 500 discovery achievement',
  );
  await seedProgression();
  await rebuildSubject('COLLECTOR', c.id);
  const xp = (
    await db().collectorProgress.findUniqueOrThrow({
      where: { collectorId: c.id },
    })
  ).xp;
  await rebuildSubject('COLLECTOR', c.id);
  check(
    (
      await db().collectorProgress.findUniqueOrThrow({
        where: { collectorId: c.id },
      })
    ).xp === xp,
    'repeated achievement recalculation never duplicates discovery XP',
  );
  // Canonical rewind invalidates the attributed discovery when removing its source.
  await db().squigDiscovery.updateMany({
    where: { collectorId: c.id, squigId: ids[0] },
    data: { everOwned: false, attributionStatus: 'INVALIDATED' },
  });
  await db().squigOwnership.deleteMany({
    where: { sourceKey: `possession:${ids[0]}` },
  });
  check(
    (await collectionEvidence(db(), c.id)).historical.length === 314,
    'canonical retraction removes historical discovery',
  );
  await db().squigDiscovery.updateMany({
    where: { collectorId: c.id, squigId: ids[1] },
    data: { attributionStatus: 'INVALIDATED' },
  });
  check(
    (await collectionEvidence(db(), c.id)).historical.length === 313,
    'explicitly invalidated evidence cannot qualify',
  );
  await db().squigOwnership.updateMany({
    where: { walletAddress: wallet },
    data: { isCurrent: false },
  });
  check(
    (await progressionFacts(db(), 'COLLECTOR', c.id)).facts.filter(
      (f) => f.type === 'DISCOVERY',
    ).length === 313,
    'achievement discovery evidence follows explicit retractions',
  );
  const unclaimed = await db().collector.create({
    data: { slug: 'startup-unclaimed' },
  });
  const publicWallet = '0x' + 'dc'.repeat(20);
  await db().discoveredWallet.create({
    data: {
      collectorId: unclaimed.id,
      chainId: 1,
      walletAddress: publicWallet,
    },
  });
  await db().squigOwnership.create({
    data: {
      squigId: ids[0],
      walletAddress: publicWallet,
      source: 'ownerOf',
      sourceKey: 'startup-unclaimed-current',
      blockNumber: 100n,
      blockHash: 'fixture',
      observedAt: new Date(),
      isCurrent: true,
    },
  });
  await rebuildCollection(unclaimed.id);
  check(
    (await collectionEvidence(db(), unclaimed.id)).historical.length === 1,
    'unclaimed discovered wallet gets a Field Guide from current ownership',
  );
  check(
    (await db().collectorWallet.count({
      where: { collectorId: unclaimed.id },
    })) === 0,
    'startup never fabricates a credential for a discovered wallet',
  );
  const replayId = 'test-startup-deployment';
  while (!(await queueCollections(false, replayId))) {}
  check(
    !!(await db().collectionJob.findUnique({
      where: { collectorId: unclaimed.id },
    })),
    'startup queue includes unclaimed profiles',
  );
  check(
    !!(await db().collectionJob.findUnique({ where: { collectorId: c.id } })),
    'startup queue includes former holders',
  );
  await db().collectionJob.delete({ where: { collectorId: unclaimed.id } });
  await queueCollections(false, replayId);
  check(
    !(await db().collectionJob.findUnique({
      where: { collectorId: unclaimed.id },
    })),
    'same deployment restart does not requeue completed profiles',
  );
  while (!(await queueCollections(false, 'test-next-deployment'))) {}
  check(
    !!(await db().collectionJob.findUnique({
      where: { collectorId: unclaimed.id },
    })),
    'next deployment queues profiles again',
  );
  await db().squigOwnership.updateMany({
    where: { sourceKey: 'startup-unclaimed-current' },
    data: { isCurrent: false },
  });
}
