import 'server-only';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import { COLLECTION_RULESET } from '@/domain/dex';
import { RULESET } from '@/domain/progression';
import { shareCard } from './sharing';

export const COMMUNITY_PAGE_SIZE = 12;
export async function uglyUsers(page = 1) {
  const where: Prisma.CollectorWhereInput = {
    isPublic: true,
    mergedIntoCollectorId: null,
    OR: [
      { identities: { some: { authenticatedAt: { not: null } } } },
      { wallets: { some: { source: 'SIWE', status: 'ACTIVE' } } },
    ],
  };
  return db().$transaction(
    async (tx) => {
      const total = await tx.collector.count({ where });
      const pages = Math.max(1, Math.ceil(total / 24));
      page = Math.min(
        Math.max(Number.isSafeInteger(page) ? page : 1, 1),
        pages,
      );
      const users = await tx.collector.findMany({
        where,
        select: { slug: true, displayName: true, avatar: true },
        orderBy: { slug: 'asc' },
        take: 24,
        skip: (page - 1) * 24,
      });
      return { users, page, pages };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function communityVisible(slug: string) {
  return !!(await db().collector.findFirst({
    where: {
      slug,
      isPublic: true,
      showCommunityActivity: true,
      mergedIntoCollectorId: null,
    },
    select: { id: true },
  }));
}

// Read earned projections; no event duplication, XP writes or automatic publishing
// to external services. Re-evaluate visibility and eligibility on every request.
export async function collectorThread(page = 1) {
  const rows = await db().$queryRaw<
    {
      slug: string;
      displayName: string | null;
      avatar: string | null;
      kind: 'achievement' | 'set' | 'transfer';
      tokenId: number | null;
      key: string;
      at: Date;
    }[]
  >(Prisma.sql`
    SELECT c.slug, c."displayName", c.avatar, e.kind, e.key, e.at, e."tokenId" FROM (
      SELECT a."collectorId", 'achievement' AS kind, d.id AS key, a."awardedAt" AS at, NULL::integer AS "tokenId"
      FROM "CollectorAchievement" a
      JOIN "AchievementDefinition" d ON d.id=a."achievementId" AND d.ruleset=${RULESET} AND d."subjectType"='COLLECTOR'
      JOIN "CollectorProgress" p ON p."collectorId"=a."collectorId" AND p."rulesVersion"=${RULESET}
      WHERE a."revokedAt" IS NULL AND a."awardedAt" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "ProgressionJob" j WHERE j."subjectType"='COLLECTOR' AND j."subjectId"=a."collectorId")
      UNION ALL
      SELECT s."collectorId", 'set' AS kind, d.id AS key, s."completedAt" AS at, NULL::integer AS "tokenId"
      FROM "CollectorSetProgress" s
      JOIN "CollectionSetDefinition" d ON d.id=s."setId" AND d.ruleset=${COLLECTION_RULESET} AND d.enabled
      JOIN "CollectionSnapshot" p ON p."collectorId"=s."collectorId" AND p.ruleset=${COLLECTION_RULESET}
      WHERE s."currentlyComplete" AND s."completedAt" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "CollectionJob" j WHERE j."collectorId"=s."collectorId")
      UNION ALL
      SELECT NULL::uuid AS "collectorId", 'transfer' AS kind, t.id AS key, t."eventAt" AS at, t."tokenId"
      FROM "NftTransfer" t
      WHERE t.finalized AND t."fromAddress" <> t."toAddress"
        AND t."fromAddress" <> '0x0000000000000000000000000000000000000000'
        AND t."toAddress" <> '0x0000000000000000000000000000000000000000'
    ) e LEFT JOIN "Collector" c ON c.id=e."collectorId"
    WHERE e.kind = 'transfer' OR (c."isPublic" AND c."showCommunityActivity" AND c."mergedIntoCollectorId" IS NULL)
    ORDER BY e.at DESC, c.slug ASC, e.kind ASC, e.key ASC
    LIMIT ${COMMUNITY_PAGE_SIZE + 1} OFFSET ${(page - 1) * COMMUNITY_PAGE_SIZE}
  `);
  const cards = await Promise.all(
    rows.slice(0, COMMUNITY_PAGE_SIZE).map(async (row) => {
      if (row.kind === 'transfer')
        return {
          slug: '',
          name: `Squig #${row.tokenId}`,
          avatar: null,
          kind: row.kind,
          key: row.key,
          at: row.at.toISOString(),
          title: 'Transferred between wallets',
          path: `/squig/${row.tokenId}#ownership`,
          card: null,
        };
      const key = row.key.slice(
        (row.kind === 'achievement' ? RULESET : COLLECTION_RULESET).length + 1,
      );
      const spec = { kind: row.kind, entity: row.slug, key };
      const card = await shareCard(spec);
      if (!card || !(await communityVisible(row.slug))) return null;
      return {
        slug: row.slug,
        name: row.displayName || row.slug,
        avatar: row.avatar,
        kind: row.kind,
        key,
        at: row.at.toISOString(),
        title: card.title,
        path: card.path,
        card,
      };
    }),
  );
  return {
    cards: cards.filter((c) => c !== null),
    hasMore: rows.length > COMMUNITY_PAGE_SIZE,
  };
}

export async function topCollectors(page = 1) {
  return db().$transaction(
    async (tx) => {
      const eligibility = Prisma.sql`FROM "Collector" c JOIN "CollectionSnapshot" s ON s."collectorId"=c.id AND s.ruleset=${COLLECTION_RULESET}
      WHERE c."isPublic" AND c."mergedIntoCollectorId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "CollectionJob" j WHERE j."collectorId"=c.id)`;
      const [{ count }] = await tx.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS count ${eligibility}`,
      );
      const pages = Math.max(1, Math.ceil(Number(count) / 24));
      page = Math.min(Math.max(page, 1), pages);
      const rows = await tx.$queryRaw<
        {
          slug: string;
          displayName: string | null;
          avatar: string | null;
          overall: number;
          discovered: number;
          rank: bigint;
        }[]
      >(Prisma.sql`SELECT c.slug, c."displayName", c.avatar, s.overall, s.discovered,
      DENSE_RANK() OVER (ORDER BY s.overall DESC) AS rank ${eligibility}
      ORDER BY s.overall DESC, c.slug ASC LIMIT 24 OFFSET ${(page - 1) * 24}`);
      return {
        page,
        pages,
        total: Number(count),
        collectors: rows.map((c) => ({ ...c, rank: Number(c.rank) })),
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
