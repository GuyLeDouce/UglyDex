import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

// Login timestamps change routinely; first link/claim/setup timestamps do not.
// An existing projection must predate neither setup nor the newest credential.
export async function publicationBaseline(
  tx: Prisma.TransactionClient,
  id: string,
  priorAt?: Date | null,
) {
  const c = await tx.collector.findUniqueOrThrow({
    where: { id },
    include: {
      wallets: { where: { status: 'ACTIVE', revokedAt: null } },
      identities: true,
    },
  });
  if (
    !c.claimedAt ||
    !c.onboardingCompletedAt ||
    !c.isPublic ||
    !c.showCommunityActivity ||
    c.mergedIntoCollectorId
  )
    return null;
  const identitySince = new Date(
    Math.max(
      c.claimedAt.getTime(),
      c.onboardingCompletedAt.getTime(),
      ...c.wallets.map((w) => w.firstSeenAt.getTime()),
      ...c.identities.map((i) => i.linkedAt.getTime()),
    ),
  );
  return priorAt && priorAt > identitySince
    ? new Date(
        Math.max(identitySince.getTime(), c.communityFeedSince.getTime()),
      )
    : null;
}

export async function publishCommunityCard(
  tx: Prisma.TransactionClient,
  collectorId: string,
  kind: 'achievement' | 'set' | 'welcome',
  key: string,
  at: Date,
) {
  await tx.communityFeedEvent.upsert({
    where: { collectorId_kind_key: { collectorId, kind, key } },
    create: { collectorId, kind, key, at },
    update: {},
  });
}
