import 'server-only';
import { z } from 'zod';
import { db } from './db';
import type { Prisma } from '@/generated/prisma/client';
import { catalogScope, ownedScope } from './collections';

type Reader = Pick<
  Prisma.TransactionClient,
  'collector' | 'collectorWallet' | 'squig'
>;
export const favoriteSchema = z
  .object({
    tokenId: z.number().int().min(1).max(4444),
    favorite: z.boolean(),
  })
  .strict();

async function ownedIds(collectorId: string, ids: number[], tx: Reader) {
  const wallets = await tx.collectorWallet.findMany({
    where: { collectorId, chainId: 1, status: 'ACTIVE', revokedAt: null },
    select: { walletAddress: true },
  });
  const rows = await tx.squig.findMany({
    where: {
      AND: [
        catalogScope,
        ownedScope(wallets.map((w) => w.walletAddress)),
        { tokenId: { in: ids } },
      ],
    },
    select: { tokenId: true },
  });
  const owned = new Set(rows.map((s) => s.tokenId));
  return [...new Set(ids)].filter((id) => owned.has(id));
}
export async function favoriteTokenIds(collectorId: string, tx: Reader = db()) {
  const collector = await tx.collector.findUniqueOrThrow({
    where: { id: collectorId },
    select: { featuredTokenIds: true },
  });
  return ownedIds(collectorId, collector.featuredTokenIds, tx);
}
export async function setFavorite(collectorId: string, input: unknown) {
  const { tokenId, favorite } = favoriteSchema.parse(input);
  return db().$transaction(async (tx) => {
    // Shared with profile/wallet edits. Concurrent additions cannot exceed six.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    const current = await favoriteTokenIds(collectorId, tx);
    if (favorite && !(await ownedIds(collectorId, [tokenId], tx)).length)
      throw new Error('FAVORITE_NOT_OWNED');
    const next = favorite
      ? [...new Set([...current, tokenId])]
      : current.filter((id) => id !== tokenId);
    if (next.length > 6) throw new Error('FAVORITE_LIMIT');
    await tx.collector.update({
      where: { id: collectorId },
      data: { featuredTokenIds: next },
    });
    return { favorites: next };
  });
}
