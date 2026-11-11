import { publishCommunityCard } from './community-publication';
import { squigAvatarUrl } from './collector-avatar';
import 'server-only';
import { db } from './db';
import { profileSchema, hasCollectorUsername } from '@/domain/profile';
import { catalogScope, ownedScope, activeAddresses } from './collections';
import { markWalletDirty } from '@/sync/provenance';
export async function saveProfile(collectorId: string, input: unknown) {
  const data = profileSchema.parse(input);
  const addresses = await activeAddresses(collectorId);
  const { avatarSquigId, avatar: legacyAvatar, ...profileData } = data;
  if (
    avatarSquigId != null &&
    !(await db().squig.count({
      where: {
        AND: [catalogScope, ownedScope(addresses), { tokenId: avatarSquigId }],
      },
    }))
  )
    throw new Error('AVATAR_NOT_OWNED');
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
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    const current = await tx.collector.findUniqueOrThrow({
      where: { id: collectorId },
    });
    const slug = data.slug || current.slug;
    if (
      (data.showUsername ||
        (await tx.collectorWallet.count({
          where: { collectorId, status: 'ACTIVE' },
        })) > 1) &&
      !hasCollectorUsername(slug)
    )
      throw new Error('USERNAME_REQUIRED');
    const welcome =
      !current.communityWelcomeAt &&
      !!current.onboardingCompletedAt &&
      !!current.claimedAt &&
      data.isPublic &&
      data.showCommunityActivity;
    if (welcome)
      await publishCommunityCard(
        tx,
        collectorId,
        'welcome',
        'joined',
        new Date(),
      );
    return tx.collector.update({
      where: { id: collectorId },
      data: {
        ...profileData,
        ...(welcome ? { communityWelcomeAt: new Date() } : {}),
        slug,
        avatar:
          avatarSquigId === undefined
            ? legacyAvatar || null
            : avatarSquigId === null
              ? null
              : squigAvatarUrl(avatarSquigId),
      },
      select: { slug: true },
    });
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
