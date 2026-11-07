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
