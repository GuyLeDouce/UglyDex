import { completion } from '@/domain/dex';
import { traitCatalog, collectionSets } from '@/domain/dex-catalog';
import { collectorAvatar } from './collector-avatar';
import { publicWalletEvidence } from './wallet-field-guide';
import {
  walletFieldGuide,
  rankCollectorRows,
} from '@/domain/wallet-field-guide';
import { publicNameSelect, publicCollectorName } from './public-collector-name';
import 'server-only';
import { db } from './db';
import { publicIdentity } from '@/domain/profile';
import { Prisma } from '@/generated/prisma/client';
import { COLLECTION_RULESET } from '@/domain/dex';
import { RULESET } from '@/domain/progression';
import { shareCard } from './sharing';

function podiumPlayers(metadata: Record<string, unknown> | undefined) {
  const values = metadata?.players;
  if (!Array.isArray(values)) return [];
  return values.filter(
    (p): p is { slug: string; placement: number } =>
      !!p && typeof p.slug === 'string' && [1, 2, 3].includes(p.placement),
  );
}
async function collectorAvatarBySlug(slug: string, fallback: string | null) {
  const c = await db().collector.findFirst({
    where: { slug },
    select: { id: true },
  });
  return c ? ((await collectorAvatar(c.id, fallback))?.url ?? null) : null;
}

export const COMMUNITY_PAGE_SIZE = 12;
export async function uglyUsers(page = 1) {
  return collectorListing(page, false);
}
export async function collectorDirectory(page = 1) {
  return collectorListing(page, true);
}
async function collectorListing(page: number, includeDiscovered: boolean) {
  // Discovery and imported verification are not evidence of a visit to UglyDex.
  // Keep past SIWE sign-ins eligible even after a wallet has been unlinked.
  const signedIn: Prisma.CollectorWhereInput[] = [
    { identities: { some: { authenticatedAt: { not: null } } } },
    { wallets: { some: { source: 'SIWE' } } },
    { sessions: { some: {} } },
  ];
  const where: Prisma.CollectorWhereInput = {
    isPublic: true,
    mergedIntoCollectorId: null,
    OR: includeDiscovered
      ? [...signedIn, { discoveredWallets: { some: {} } }]
      : signedIn,
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
        include: {
          wallets: { where: { status: 'ACTIVE', revokedAt: null } },
          identities: { where: { authenticatedAt: { not: null } } },
          discoveredWallets: true,
        },
        orderBy: { slug: 'asc' },
        take: 24,
        skip: (page - 1) * 24,
      });
      return {
        users: await Promise.all(
          users.map(async (c) => {
            const p = publicIdentity(c);
            return {
              slug: p.slug,
              displayName: p.displayName,
              avatar: (await collectorAvatar(c.id, c.avatar))?.url ?? null,
              unclaimed: p.unclaimed,
            };
          }),
        ),
        page,
        pages,
      };
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
export async function collectorThread(page = 1, collectorSlug?: string) {
  page = Number.isSafeInteger(page) && page > 0 ? page : 1;
  // Filter before pagination. A profile must never fall back to the global feed.
  const scope =
    collectorSlug === undefined
      ? Prisma.empty
      : Prisma.sql`
    AND (c.slug = ${collectorSlug} OR (e.kind='survival' AND e.metadata->'players' @> ${JSON.stringify([{ slug: collectorSlug }])}::jsonb) OR (e.kind = 'transfer' AND EXISTS (
      SELECT 1 FROM "Collector" owner
      WHERE owner.slug = ${collectorSlug} AND owner."isPublic"
        AND owner."showCommunityActivity" AND owner."showWallets"
        AND owner."mergedIntoCollectorId" IS NULL
        AND (
          EXISTS (SELECT 1 FROM "CollectorWallet" w
            WHERE w."collectorId" = owner.id AND w.status = 'ACTIVE'
              AND w."revokedAt" IS NULL AND w."chainId" = transfer."chainId"
              AND w."walletAddress" IN (transfer."fromAddress", transfer."toAddress"))
          OR EXISTS (SELECT 1 FROM "DiscoveredWallet" w
            WHERE w."collectorId" = owner.id AND w."chainId" = transfer."chainId"
              AND w."walletAddress" IN (transfer."fromAddress", transfer."toAddress"))
        )
    )))
  `;
  const rows = await db().$queryRaw<
    {
      slug: string;
      displayName: string | null;
      avatar: string | null;
      kind:
        | 'achievement'
        | 'set'
        | 'transfer'
        | 'milestone'
        | 'welcome'
        | 'survival'
        | 'marketplace'
        | 'gauntlet';
      metadata: Record<string, unknown>;
      tokenId: number | null;
      imageUrl: string | null;
      toAddress: string | null;
      chainId: number | null;
      key: string;
      at: Date;
    }[]
  >(Prisma.sql`
    WITH eligible AS (
      SELECT c.*, GREATEST(c."communityFeedSince", c."claimedAt", c."onboardingCompletedAt",
        (SELECT max(w."firstSeenAt") FROM "CollectorWallet" w WHERE w."collectorId"=c.id AND w.status='ACTIVE' AND w."revokedAt" IS NULL),
        (SELECT max(i."linkedAt") FROM "ExternalIdentity" i WHERE i."collectorId"=c.id)) AS since
      FROM "Collector" c
      WHERE c."isPublic" AND c."showCommunityActivity" AND c."mergedIntoCollectorId" IS NULL
        AND c."claimedAt" IS NOT NULL AND c."onboardingCompletedAt" IS NOT NULL
    ), public_activity AS (
      SELECT a.*, c.slug FROM "CollectorActivity" a JOIN eligible c ON c.id=a."collectorId"
      WHERE a."recordStatus"='ACTIVE' AND a.visibility='PUBLIC' AND a."attributionStatus"='DISCORD'
        AND c."showDiscord" AND c."discordTrackingConsent" IS TRUE
        AND (a."eventAt">c.since OR EXISTS (
          SELECT 1 FROM "ActivityCorrection" correction
          WHERE correction."activityId"=a.id AND correction."createdAt">c.since
            AND correction.reason='SOURCE_CORRECTION'
            AND correction.before->>'collectorId'=c.id::text
            AND ((a."eventType"='SURVIVAL_PLAYED' AND a.metadata->>'completed'='true'
              AND correction.before->'metadata'->>'completed'='false')
              OR (a."eventType"='MARKETPLACE_PURCHASE' AND a.metadata->>'confirmed'='true'
                AND correction.before->'metadata'->>'confirmed'='false'))
        ))
        AND a."sourceSystem" IN ('uglybot','gauntlet')
    ), podium AS (
      SELECT a."collectorId", a.slug, split_part(a."sourceId", ':', 1) AS game,
        (a.metadata->>'placement')::integer AS placement, a."eventAt", a."updatedAt"
      FROM public_activity a
      WHERE a."eventType"='SURVIVAL_PLAYED' AND a.metadata->>'completed'='true'
        AND a.metadata->>'placement' IN ('1','2','3')
    ), podium_games AS (
      SELECT game, min("collectorId"::text)::uuid AS "collectorId", max("updatedAt") AS at,
        jsonb_build_object('players', jsonb_agg(jsonb_build_object('slug', slug, 'placement', placement) ORDER BY placement)) AS metadata
      FROM podium p
      -- Do not announce provisional second/third places before a winner exists.
      WHERE EXISTS (SELECT 1 FROM "CollectorActivity" win WHERE win."sourceSystem"='gauntlet'
        AND win."eventType"='SURVIVAL_PLAYED' AND win."recordStatus"='ACTIVE'
        AND split_part(win."sourceId", ':', 1)=p.game AND win.metadata->>'placement'='1'
        AND win.metadata->>'completed'='true')
      GROUP BY game
    )
    SELECT c.slug, c."displayName", c.avatar, e.kind, e.key, e.at, e."tokenId", e.metadata,
      art."imageUrl", transfer."toAddress", transfer."chainId" FROM (
      SELECT a."collectorId", 'achievement' AS kind, d.id AS key, f.at, NULL::integer AS "tokenId", '{}'::jsonb AS metadata
      FROM "CommunityFeedEvent" f
      JOIN "CollectorAchievement" a ON a."collectorId"=f."collectorId" AND a."achievementId"=f.key
      JOIN "AchievementDefinition" d ON d.id=a."achievementId" AND d.ruleset=${RULESET} AND d."subjectType"='COLLECTOR'
      JOIN "CollectorProgress" p ON p."collectorId"=a."collectorId" AND p."rulesVersion"=${RULESET}
      WHERE f.kind='achievement' AND a."revokedAt" IS NULL AND a."awardedAt" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "ProgressionJob" j WHERE j."subjectType"='COLLECTOR' AND j."subjectId"=a."collectorId")
      UNION ALL
      SELECT s."collectorId", 'set', d.id, f.at, NULL::integer, '{}'::jsonb
      FROM "CommunityFeedEvent" f
      JOIN "CollectorSetProgress" s ON s."collectorId"=f."collectorId" AND s."setId"=f.key
      JOIN "CollectionSetDefinition" d ON d.id=s."setId" AND d.ruleset=${COLLECTION_RULESET} AND d.enabled
      JOIN "CollectionSnapshot" p ON p."collectorId"=s."collectorId" AND p.ruleset=${COLLECTION_RULESET}
      WHERE f.kind='set' AND s."currentlyComplete" AND s."completedAt" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "CollectionJob" j WHERE j."collectorId"=s."collectorId")
      UNION ALL
      SELECT f."collectorId", 'welcome', f.key, f.at, NULL::integer, '{}'::jsonb
      FROM "CommunityFeedEvent" f WHERE f.kind='welcome'
      UNION ALL
      SELECT m."subjectId", 'milestone', 'level:' || m.level::text, m."reachedAt", NULL::integer, '{}'::jsonb
      FROM "ProgressionMilestone" m JOIN eligible c ON c.id=m."subjectId" AND m."reachedAt">c.since
      JOIN "CollectorProgress" p ON p."collectorId"=m."subjectId" AND p."rulesVersion"=${RULESET}
      WHERE m.ruleset=${RULESET} AND m."subjectType"='COLLECTOR'
        AND NOT EXISTS (SELECT 1 FROM "ProgressionJob" j WHERE j."subjectType"='COLLECTOR' AND j."subjectId"=m."subjectId")
      UNION ALL
      SELECT m."collectorId", 'milestone', m.key, m."reachedAt", NULL::integer, '{}'::jsonb
      FROM "CollectionMilestone" m
      JOIN eligible c ON c.id=m."collectorId" AND m."reachedAt">c.since
      JOIN "CollectionSnapshot" p ON p."collectorId"=m."collectorId" AND p.ruleset=${COLLECTION_RULESET}
      WHERE m.ruleset=${COLLECTION_RULESET} AND m."revokedAt" IS NULL AND (m.key LIKE 'completion:%' OR m.key LIKE 'mastery:%')
        AND NOT EXISTS (SELECT 1 FROM "CollectionJob" j WHERE j."collectorId"=m."collectorId")
      UNION ALL
      SELECT a."collectorId", 'marketplace', a.id::text,
        COALESCE((SELECT min(correction."createdAt") FROM "ActivityCorrection" correction
          WHERE correction."activityId"=a.id AND correction.reason='SOURCE_CORRECTION'
            AND correction.before->'metadata'->>'confirmed'='false'), a."eventAt"), NULL::integer,
        jsonb_build_object('item',a.metadata->>'item','quantity',a.metadata->'quantity','status',a.metadata->>'status')
      FROM public_activity a WHERE a."eventType"='MARKETPLACE_PURCHASE' AND a.metadata->>'confirmed'='true'
        AND NOT EXISTS (SELECT 1 FROM "CollectorActivity" refund WHERE refund."sourceSystem"=a."sourceSystem"
          AND refund."sourceType"=a."sourceType" AND refund."sourceId"=a."sourceId"
          AND refund."eventType"='MARKETPLACE_REFUND' AND refund."recordStatus"='ACTIVE')
      UNION ALL
      SELECT a."collectorId", 'gauntlet', a.id::text, a."eventAt", NULL::integer,
        jsonb_build_object('score',a.metadata->'score','finalRound',a.metadata->'finalRound')
      FROM public_activity a WHERE a."eventType"='GAUNTLET_COMPLETED'
      UNION ALL
      SELECT p."collectorId", 'survival', p.game, p.at, NULL::integer, p.metadata FROM podium_games p
      UNION ALL
      SELECT NULL::uuid, 'transfer', t.id, t."eventAt", t."tokenId", '{}'::jsonb
      FROM "NftTransfer" t
      WHERE t.finalized AND t."fromAddress" <> t."toAddress"
        AND t."fromAddress" <> '0x0000000000000000000000000000000000000000'
        AND t."toAddress" <> '0x0000000000000000000000000000000000000000'
    ) e LEFT JOIN eligible c ON c.id=e."collectorId"
    LEFT JOIN "NftTransfer" transfer ON e.kind='transfer' AND transfer.id=e.key
    LEFT JOIN "Squig" art ON art.id=transfer."squigId"
    WHERE (e.kind = 'transfer' OR c.id IS NOT NULL)
    ${scope}
    ORDER BY e.at DESC, c.slug ASC, e.kind ASC, e.key ASC
    LIMIT ${COMMUNITY_PAGE_SIZE + 1} OFFSET ${(page - 1) * COMMUNITY_PAGE_SIZE}
  `);
  const recipients = rows
    .slice(0, COMMUNITY_PAGE_SIZE)
    .filter(
      (row) => row.kind === 'transfer' && row.toAddress && row.chainId !== null,
    );
  // Naming a recipient links a public wallet to a profile, so require wallet
  // sharing as well as public-profile and community-activity consent.
  const wallets = recipients.length
    ? await db().collectorWallet.findMany({
        where: {
          OR: recipients.map((row) => ({
            chainId: row.chainId!,
            walletAddress: row.toAddress!,
          })),
          status: 'ACTIVE',
          revokedAt: null,
          collector: {
            isPublic: true,
            showWallets: true,
            showCommunityActivity: true,
            mergedIntoCollectorId: null,
          },
        },
        select: {
          chainId: true,
          walletAddress: true,
          collector: { select: publicNameSelect },
        },
      })
    : [];
  const owners = new Map(
    wallets.map((w) => [
      `${w.chainId}:${w.walletAddress.toLowerCase()}`,
      {
        name: publicCollectorName(w.collector),
        path: `/collector/${w.collector.slug}`,
      },
    ]),
  );
  const names = new Map(
    (
      await db().collector.findMany({
        where: {
          slug: {
            in: [
              ...rows.map((r) => r.slug),
              ...rows.flatMap((r) =>
                podiumPlayers(r.metadata).map((p) => p.slug),
              ),
            ].filter(Boolean),
          },
        },
        select: publicNameSelect,
      })
    ).map((c) => [c.slug, publicCollectorName(c)]),
  );
  const cards = await Promise.all(
    rows.slice(0, COMMUNITY_PAGE_SIZE).map(async (row) => {
      if (row.kind === 'transfer')
        return {
          slug: '',
          name: `Squig #${row.tokenId}`,
          avatar: row.imageUrl,
          kind: row.kind,
          key: row.key,
          at: row.at.toISOString(),
          title: 'Transferred between wallets',
          recipient:
            owners.get(`${row.chainId}:${row.toAddress?.toLowerCase()}`) ??
            null,
          path: `/squig/${row.tokenId}#ownership`,
          card: null,
        };
      if (['survival', 'marketplace', 'gauntlet'].includes(row.kind)) {
        if (!(await communityVisible(row.slug))) return null;
        const name = names.get(row.slug) || 'Collector';
        const players =
          row.kind === 'survival'
            ? podiumPlayers(row.metadata).map((p) => ({
                ...p,
                name: names.get(p.slug) || 'Collector',
                path: `/collector/${p.slug}`,
              }))
            : [];
        const item =
          typeof row.metadata.item === 'string'
            ? row.metadata.item.slice(0, 180)
            : 'Marketplace item';
        const quantity =
          typeof row.metadata.quantity === 'number' && row.metadata.quantity > 1
            ? ` × ${row.metadata.quantity}`
            : '';
        return {
          slug: row.kind === 'survival' ? '' : row.slug,
          name: row.kind === 'survival' ? 'Squig Survival' : name,
          avatar:
            row.kind === 'survival'
              ? null
              : await collectorAvatarBySlug(row.slug, row.avatar),
          kind: row.kind,
          key: row.key,
          at: row.at.toISOString(),
          title:
            row.kind === 'survival'
              ? 'The podium is in!'
              : row.kind === 'marketplace'
                ? `Purchased ${item}${quantity}`
                : 'Completed The Gauntlet',
          detail:
            row.kind === 'marketplace'
              ? row.metadata.status === 'delivered'
                ? 'Delivered'
                : 'Purchase confirmed'
              : row.kind === 'gauntlet' &&
                  typeof row.metadata.score === 'number'
                ? `Score: ${row.metadata.score}`
                : null,
          path:
            row.kind === 'survival'
              ? '/thread'
              : `/collector/${row.slug}/activity`,
          players,
          card: null,
        };
      }
      if (row.kind === 'welcome') {
        if (!(await communityVisible(row.slug))) return null;
        const spec = {
          kind: 'collector' as const,
          entity: row.slug,
          format: 'collector-card' as const,
        };
        const card = await shareCard(spec);
        if (!card) return null;
        return {
          slug: row.slug,
          name: names.get(row.slug) || 'Collector',
          avatar: row.avatar,
          kind: row.kind,
          key: row.key,
          at: row.at.toISOString(),
          title: 'Joined UglyDex',
          path: `/collector/${row.slug}`,
          card,
        };
      }
      if (
        row.kind !== 'achievement' &&
        row.kind !== 'set' &&
        row.kind !== 'milestone'
      )
        return null;
      const key =
        row.kind === 'milestone'
          ? row.key
          : row.key.slice(
              (row.kind === 'achievement' ? RULESET : COLLECTION_RULESET)
                .length + 1,
            );
      const spec = {
        kind: row.kind,
        entity: row.slug,
        key,
        ...(row.kind !== 'milestone' ? { format: 'trophy-card' as const } : {}),
      };
      const card = await shareCard(spec);
      if (!card || !(await communityVisible(row.slug))) return null;
      return {
        slug: row.slug,
        name: names.get(row.slug) || 'Collector',
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
      // Include public wallets before login, and keep collectors visible while a job runs.
      const rows = await tx.$queryRaw<
        {
          id: string;
          slug: string;
          avatar: string | null;
          overall: number | null;
          discovered: number | null;
          traits: number | null;
          historicalSets: number | null;
          currentTokenIds: number[] | null;
          unclaimed: boolean;
          walletTracked: boolean;
          pending: boolean;
        }[]
      >(Prisma.sql`
      SELECT c.id, c.slug, c.avatar, s.overall, s.discovered, s.traits, s."historicalSets", s."currentTokenIds",
        EXISTS (SELECT 1 FROM "DiscoveredWallet" w WHERE w."collectorId"=c.id AND w."chainId"=1) AS "walletTracked",
        (c."claimedAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "CollectorWallet" w WHERE w."collectorId"=c.id AND w.status='ACTIVE' AND w."revokedAt" IS NULL)
          AND NOT EXISTS (SELECT 1 FROM "ExternalIdentity" i WHERE i."collectorId"=c.id AND i."authenticatedAt" IS NOT NULL)) AS unclaimed,
        (s."collectorId" IS NULL OR EXISTS (SELECT 1 FROM "CollectionJob" j WHERE j."collectorId"=c.id)) AS pending
      FROM "Collector" c LEFT JOIN "CollectionSnapshot" s ON s."collectorId"=c.id AND s.ruleset=${COLLECTION_RULESET}
      WHERE c."isPublic" AND c."mergedIntoCollectorId" IS NULL
    `);
      const evidence = new Map(
        (await publicWalletEvidence(tx)).map((e) => [e.collectorId, e]),
      );
      const ranked = rankCollectorRows(
        rows
          .filter((row) => (evidence.get(row.id)?.currentIds.length ?? 0) > 0)
          .map((row) => {
            const e = evidence.get(row.id);
            const observed =
              row.unclaimed && row.walletTracked
                ? walletFieldGuide(e?.currentIds ?? [], e?.historyIds ?? [])
                : null;
            return {
              ...row,
              owned: e?.currentIds.length ?? 0,
              overall:
                observed?.score.overall ??
                (row.discovered === null
                  ? null
                  : completion(
                      row.discovered,
                      row.traits ?? 0,
                      traitCatalog.length,
                      row.historicalSets ?? 0,
                      collectionSets.filter(
                        (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
                      ).length,
                      row.currentTokenIds?.length ?? 0,
                    ).overall),
              discovered: observed?.discovered ?? row.discovered,
              pending: !observed && row.pending,
            };
          }),
      );
      const pages = Math.max(1, Math.ceil(ranked.length / 24));
      page = Math.min(
        Math.max(Number.isSafeInteger(page) ? page : 1, 1),
        pages,
      );
      const selected = ranked.slice((page - 1) * 24, page * 24);
      const names = new Map(
        (
          await tx.collector.findMany({
            where: { id: { in: selected.map((c) => c.id) } },
            select: publicNameSelect,
          })
        ).map((c) => [c.slug, publicCollectorName(c)]),
      );
      return {
        page,
        pages,
        total: ranked.length,
        pending: ranked.filter((c) => c.pending).length,
        unclaimed: ranked.filter((c) => c.unclaimed).length,
        collectors: await Promise.all(
          selected.map(async (c) => ({
            slug: c.slug,
            avatar: (await collectorAvatar(c.id, c.avatar))?.url ?? null,
            owned: c.owned,
            overall: c.overall,
            discovered: c.discovered,
            rank: c.rank,
            pending: c.pending,
            unclaimed: c.unclaimed,
            displayName: names.get(c.slug) || 'Collector',
          })),
        ),
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  );
}
