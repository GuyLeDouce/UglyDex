import { db } from '../../src/server/db';
import {
  collectionEvidence,
  rebuildCollection,
  seedCollections,
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
  await db().squigOwnership.updateMany({
    where: { squigId: ids[0], walletAddress: wallet },
    data: { isCurrent: false },
  });
  check(
    (await collectionSummary(c.id)).discovered === 315,
    'sale retains the discovery materialized from current possession',
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
}
