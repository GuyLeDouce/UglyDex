import 'server-only';
import { db } from '@/server/db';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { hash } from '@/domain/events';
import { readEnv } from '@/server/env';
import { emptyCounts } from './run';
import { log } from '@/server/log';
import snapshot from '../../data/squigs.json';
import { squigArtwork } from '@/domain/assets';
export async function syncSquigs() {
  const counts = emptyCounts();
  const sourceHash = hash(snapshot.hashes);
  const imageBase = readEnv().SQUIG_IMAGE_BASE_URL;
  const run = await db().syncRun.create({ data: { source: 'squigs', counts } });
  for (const item of snapshot.records) {
    counts.scanned++;
    try {
      const result = await db().$transaction(async (tx) => {
        const where = {
          chainId_contractAddress_tokenId: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: item.tokenId,
          },
        };
        const old = await tx.squig.findUnique({ where });
        const metadata = {
          description: item.description,
          fileName: item.fileName,
          sourceRevision: snapshot.sourceRevision,
          rulesVersion: snapshot.rulesVersion,
        };
        const imageUrl = imageBase
          ? new URL(
              item.fileName,
              imageBase.endsWith('/') ? imageBase : `${imageBase}/`,
            ).href
          : (old?.imageUrl ?? squigArtwork(item.tokenId));
        if (old?.metadataSourceHash === sourceHash && old.imageUrl === imageUrl)
          return 'skipped';
        const data = {
          name: item.name,
          uglyPoints: item.uglyPoints,
          mawRank: item.mawRank,
          rarityTier: item.rarityTier,
          legendary: item.legendary,
          og: item.og,
          metadata,
          metadataSourceHash: sourceHash,
          metadataUpdatedAt: new Date(),
          imageUrl,
        };
        const squig = await tx.squig.upsert({
          where,
          create: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: item.tokenId,
            ...data,
          },
          update: data,
        });
        const traits = Object.entries(item.traits);
        await tx.squigTrait.deleteMany({
          where: {
            squigId: squig.id,
            traitType: { notIn: traits.map(([key]) => key) },
          },
        });
        for (const [traitType, value] of traits)
          await tx.squigTrait.upsert({
            where: { squigId_traitType: { squigId: squig.id, traitType } },
            create: { squigId: squig.id, traitType, value },
            update: { value },
          });
        return old ? 'updated' : 'inserted';
      });
      counts[result]++;
    } catch {
      counts.failed++;
    }
    if (counts.scanned % 200 === 0)
      log('sync.page', { source: 'squigs', ...counts });
  }
  await db().syncRun.update({
    where: { id: run.id },
    data: {
      counts,
      status: counts.failed ? 'PARTIAL' : 'COMPLETED',
      finishedAt: new Date(),
    },
  });
  log('sync.finished', { source: 'squigs', ...counts });
  return counts;
}
