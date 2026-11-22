import 'server-only';
import { db } from './db';
import { activeAddresses, catalogScope, ownedScope } from './collections';

// Eligibility belongs to the signed-in viewer, never the profile being browsed.
export async function collectorCardTokenIds(
  collectorId: string | undefined,
  tokenIds: number[],
): Promise<number[]> {
  if (!collectorId || !tokenIds.length) return [];
  const addresses = await activeAddresses(collectorId);
  if (!addresses.length) return [];
  const rows = await db().squig.findMany({
    where: {
      AND: [catalogScope, ownedScope(addresses), { tokenId: { in: tokenIds } }],
    },
    select: { tokenId: true },
  });
  return rows.map((row) => row.tokenId);
}

export async function cardHolder(tokenId: number) {
  const holding = await db().squigOwnership.findFirst({
    where: { isCurrent: true, squig: { ...catalogScope, tokenId } },
    select: { walletAddress: true },
  });
  if (!holding) return null;
  const wallet = { chainId: 1, walletAddress: holding.walletAddress };
  const verified = await db().collectorWallet.findFirst({
    where: { ...wallet, status: 'ACTIVE', revokedAt: null },
    select: { collectorId: true },
  });
  if (verified) return { ...verified, observed: false };
  const discovered = await db().discoveredWallet.findUnique({
    where: { chainId_walletAddress: wallet },
    select: { collectorId: true },
  });
  return discovered ? { ...discovered, observed: true } : null;
}
