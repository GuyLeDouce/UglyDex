import 'server-only';
import { db } from './db';
import { profileSchema } from '@/domain/profile';
import { catalogScope, ownedScope, activeAddresses } from './collections';
import { markWalletDirty } from '@/sync/provenance';
export async function saveProfile(collectorId: string, input: unknown) {
  const data = profileSchema.parse(input);
  const addresses = await activeAddresses(collectorId);
  if (
    data.featuredTokenIds.length &&
    (await db().squig.count({
      where: {
        AND: [
          catalogScope,
          ownedScope(addresses),
          { tokenId: { in: data.featuredTokenIds } },
        ],
      },
    })) !== data.featuredTokenIds.length
  )
    throw new Error('FEATURED_NOT_OWNED');
  return db().collector.update({
    where: { id: collectorId },
    data: { ...data, avatar: data.avatar || null },
    select: { slug: true },
  });
}
export async function manageWallet(
  collectorId: string,
  walletId: string,
  action: 'primary' | 'revoke',
) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    const wallet = await tx.collectorWallet.findFirst({
      where: { id: walletId, collectorId, status: 'ACTIVE' },
    });
    if (!wallet) throw new Error('WALLET_NOT_FOUND');
    if (action === 'primary') {
      await tx.collectorWallet.updateMany({
        where: { collectorId, chainId: wallet.chainId, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.collectorWallet.update({
        where: { id: walletId },
        data: { isPrimary: true },
      });
      return { signedOut: false };
    }
    const [remaining, discord] = await Promise.all([
      tx.collectorWallet.count({
        where: { collectorId, status: 'ACTIVE', id: { not: walletId } },
      }),
      tx.externalIdentity.count({
        where: { collectorId, authenticatedAt: { not: null } },
      }),
    ]);
    if (!remaining && !discord) throw new Error('LAST_CREDENTIAL');
    if (wallet.source !== 'SIWE') throw new Error('WALLET_REVIEW_REQUIRED');
    const revokedAt = new Date();
    await tx.historicalIdentityAttribution.updateMany({
      where: { sourceKey: `credential:${wallet.id}`, status: 'VERIFIED' },
      data: { status: 'REVOKED', effectiveTo: revokedAt },
    });
    await markWalletDirty(tx, wallet.walletAddress);
    await tx.collectorWallet.update({
      where: { id: walletId },
      data: { status: 'REVOKED', revokedAt, isPrimary: false },
    });
    if (wallet.isPrimary) {
      const next = await tx.collectorWallet.findFirst({
        where: { collectorId, chainId: wallet.chainId, status: 'ACTIVE' },
        orderBy: { firstSeenAt: 'asc' },
      });
      if (next)
        await tx.collectorWallet.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
    }
    // Sessions predate credential provenance tracking: invalidate every session on revocation.
    await tx.authSession.deleteMany({ where: { collectorId } });
    await tx.authChallenge.updateMany({
      where: { collectorId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return { signedOut: true };
  });
}
