import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { publicIdentity } from '@/domain/profile';
export const publicNameSelect = {
  slug: true,
  displayName: true,
  showUsername: true,
  showWallets: true,
  claimedAt: true,
  wallets: {
    where: { status: 'ACTIVE', revokedAt: null },
    select: { walletAddress: true, isPrimary: true, chainId: true },
  },
  identities: {
    where: { authenticatedAt: { not: null } },
    select: { username: true },
  },
  discoveredWallets: { select: { walletAddress: true } },
} as const satisfies Prisma.CollectorSelect;
export function publicCollectorName(
  c: Prisma.CollectorGetPayload<{ select: typeof publicNameSelect }>,
) {
  return (
    publicIdentity({
      ...c,
      bio: null,
      avatar: null,
      showDiscord: false,
      identities: c.identities,
    }).displayName || 'Collector'
  );
}
