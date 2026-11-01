import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { SQUIGS_CONTRACT } from '@/domain/validation';

export type WalletEvidence = {
  collectorId: string;
  currentIds: number[];
  historyIds: number[];
};
/** Read canonical address evidence without attributing it to a person. Public only. */
export async function publicWalletEvidence(
  tx: Prisma.TransactionClient,
  ids?: string[],
) {
  if (ids && !ids.length) return [];
  const scope = ids
    ? Prisma.sql`AND c.id::text IN (${Prisma.join(ids)})`
    : Prisma.empty;
  return tx.$queryRaw<WalletEvidence[]>(Prisma.sql`
    WITH visible AS (
      SELECT c.id, c."claimedAt" FROM "Collector" c
      WHERE c."isPublic" AND c."mergedIntoCollectorId" IS NULL ${scope}
    ), addresses AS (
      SELECT c.id AS "collectorId", w."walletAddress" FROM visible c
      JOIN "CollectorWallet" w ON w."collectorId"=c.id
      WHERE w."chainId"=1 AND w.status='ACTIVE' AND w."revokedAt" IS NULL
      UNION
      SELECT c.id, w."walletAddress" FROM visible c
      JOIN "DiscoveredWallet" w ON w."collectorId"=c.id AND w."chainId"=1
      WHERE c."claimedAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "CollectorWallet" v WHERE v."collectorId"=c.id)
        AND NOT EXISTS (SELECT 1 FROM "ExternalIdentity" i WHERE i."collectorId"=c.id AND i."authenticatedAt" IS NOT NULL)
    ), observations AS (
      SELECT a."collectorId", s."tokenId", true AS current
      FROM addresses a JOIN "SquigOwnership" o ON o."walletAddress"=a."walletAddress" AND o."isCurrent"
      JOIN "Squig" s ON s.id=o."squigId" AND s."chainId"=1 AND s."contractAddress"=${SQUIGS_CONTRACT}
      WHERE NOT EXISTS (SELECT 1 FROM "CollectorActivity" e WHERE e."squigId"=s.id AND e."sourceType"='maw' AND e."eventType"='MAW_DIGESTED' AND e."recordStatus"='ACTIVE')
      UNION ALL
      SELECT a."collectorId", s."tokenId", false AS current
      FROM addresses a JOIN "WalletOwnershipPeriod" p ON p."walletAddress"=a."walletAddress"
      JOIN "Squig" s ON s.id=p."squigId" AND s."chainId"=1 AND s."contractAddress"=${SQUIGS_CONTRACT}
      JOIN "SquigProvenance" v ON v."squigId"=s.id AND v.complete AND NOT v.dirty
    )
    SELECT "collectorId",
      COALESCE(array_agg(DISTINCT "tokenId") FILTER (WHERE current), ARRAY[]::integer[]) AS "currentIds",
      array_agg(DISTINCT "tokenId") AS "historyIds"
    FROM observations GROUP BY "collectorId"
  `);
}
