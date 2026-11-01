import type { DerivedReadClient } from './derived-verification';
import { favoriteTokenIds } from './favorites';
import { collectionDiscoveries } from './dex-engine';
import 'server-only';
import { personalIconSummaries } from './status-icons';
import { rarestTraitsFirst } from './trait-presentation';
import { db } from './db';
import { personalizedCandidates } from './dex';
import {
  cardPersonalization,
  matchesFieldGuide,
  mostSetsAdvanced,
} from './card-personalization';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import {
  collectionWhere,
  collectionOrder,
  filterSchema,
  PAGE_SIZE,
} from '@/domain/collection';
import { resolveAsset } from '@/domain/assets';
import type { Prisma } from '@/generated/prisma/client';
import { chainKey } from '@/sync/provenance';
import { squigBadgeSummaries } from './achievement-badges';
import type { AchievementBadgeSummary } from '@/domain/achievement-badges';
import { openSeaListings } from './opensea';
import { isListingSort, sortedListings } from '@/domain/opensea';
export const catalogScope = { chainId: 1, contractAddress: SQUIGS_CONTRACT };
export const cardSelect = {
  id: true,
  tokenId: true,
  name: true,
  imageUrl: true,
  uglyPoints: true,
  mawRank: true,
  rarityTier: true,
  og: true,
  legendary: true,
  traits: {
    select: { traitType: true, value: true },
    orderBy: { traitType: 'asc' as const },
  },
} satisfies Prisma.SquigSelect;
type CardRow = Prisma.SquigGetPayload<{ select: typeof cardSelect }>;
export function cardDTO(row: CardRow) {
  return {
    tokenId: row.tokenId,
    name: row.name,
    image: resolveAsset(row.imageUrl),
    uglyPoints: row.uglyPoints?.toNumber() ?? null,
    mawRank: row.mawRank,
    rarity: row.rarityTier,
    og: row.og,
    legendary: row.legendary,
    traits: rarestTraitsFirst(row.traits),
  };
}
export async function cardsWithBadges(rows: CardRow[]) {
  const summaries = await squigBadgeSummaries(rows.map((r) => r.id));
  return rows.map((row) => ({
    ...cardDTO(row),
    achievements: summaries.get(row.id)!,
  }));
}
export type SquigCardData = ReturnType<typeof cardDTO> & {
  statusIcons?: import('@/domain/status-icons').StatusIconData[];
  achievements?: AchievementBadgeSummary;
  representation?: string;
  personalization?: {
    discovered: boolean;
    owned: boolean;
    missingTraits: number;
    advances: number;
    sets?: import('@/domain/set-icons').SetIconData[];
  };
  currentlyOwned?: boolean;
  discoveredAt?: string;
  history?: {
    firstAcquired: string;
    lastAcquired: string;
    lastLoss: string | null;
    heldSeconds: number;
    periods: number;
    firstAcquiredIsChain: boolean;
    lastAcquiredIsChain: boolean;
    lastLossIsChain: boolean;
  };
};
export async function activeAddresses(
  collectorId: string,
  reader: DerivedReadClient = db(),
) {
  return (
    await reader.collectorWallet.findMany({
      where: { collectorId, status: 'ACTIVE', chainId: 1, revokedAt: null },
      select: { walletAddress: true },
    })
  ).map((w) => w.walletAddress);
}
export async function collectionAddresses(
  collectorId: string,
  reader: DerivedReadClient = db(),
) {
  const verified = await activeAddresses(collectorId, reader);
  if (verified.length) return verified;
  const holder = await reader.collector.findFirst({
    where: {
      id: collectorId,
      claimedAt: null,
      mergedIntoCollectorId: null,
      wallets: { none: {} },
      identities: { none: {} },
    },
    select: { discoveredWallets: { select: { walletAddress: true } } },
  });
  return holder?.discoveredWallets.map((w) => w.walletAddress) ?? [];
}
export function ownedScope(addresses: string[]): Prisma.SquigWhereInput {
  return {
    ownerships: { some: { isCurrent: true, walletAddress: { in: addresses } } },
    activities: {
      none: {
        sourceType: 'maw',
        eventType: 'MAW_DIGESTED',
        recordStatus: 'ACTIVE',
      },
    },
  };
}
export async function collectionPage(
  params: Record<string, string | string[] | undefined>,
  collectorId?: string,
  discovered = false,
  viewerId?: string,
  readListings: typeof openSeaListings = openSeaListings,
) {
  const eligible = collectorId
    ? await collectionDiscoveries(db(), collectorId)
    : [];
  const filters = filterSchema.parse(params),
    addresses = collectorId ? await collectionAddresses(collectorId) : [];
  const candidates = viewerId ? await personalizedCandidates(viewerId) : null;
  const personalizedScope: Prisma.SquigWhereInput =
    filters.dex || filters.set
      ? {
          tokenId: {
            in: candidates
              ? Object.entries(candidates)
                  .filter(([, c]) =>
                    matchesFieldGuide(c, filters.dex, filters.set),
                  )
                  .map(([id]) => Number(id))
              : [],
          },
        }
      : {};
  const scope: Prisma.SquigWhereInput = collectorId
    ? discovered
      ? { id: { in: eligible.map((d) => d.squigId) } }
      : ownedScope(addresses)
    : {};
  const favoriteScope: Prisma.SquigWhereInput = filters.favorites
    ? { tokenId: { in: viewerId ? await favoriteTokenIds(viewerId) : [] } }
    : {};
  const where: Prisma.SquigWhereInput = {
    AND: [
      catalogScope,
      scope,
      collectionWhere(filters),
      personalizedScope,
      favoriteScope,
    ],
  };
  const market = isListingSort(filters.sort) ? await readListings() : null;
  let orderedIds: number[] | undefined;
  if (market && isListingSort(filters.sort)) {
    const listings = sortedListings(market.listings, filters.sort);
    const matching = await db().squig.findMany({
      where: {
        AND: [where, { tokenId: { in: listings.map((l) => l.tokenId) } }],
      },
      select: { tokenId: true },
    });
    const matches = new Set(matching.map((r) => r.tokenId));
    orderedIds = listings
      .filter((l) => matches.has(l.tokenId))
      .map((l) => l.tokenId);
  }
  if (filters.sort === 'sets-desc' && candidates) {
    const matching = await db().squig.findMany({
      where,
      select: { tokenId: true },
    });
    orderedIds = mostSetsAdvanced(matching, candidates).map((s) => s.tokenId);
  }
  const total = orderedIds?.length ?? (await db().squig.count({ where }));
  const page = Math.min(
    filters.page,
    Math.max(1, Math.ceil(total / PAGE_SIZE)),
  );
  let recentIds: string[] | undefined;
  if (filters.sort === 'recent' && collectorId && !discovered) {
    const rows = await db().squigOwnership.findMany({
      where: {
        isCurrent: true,
        walletAddress: { in: addresses },
        squig: where,
      },
      orderBy: [
        { acquiredAt: { sort: 'desc', nulls: 'last' } },
        { squig: { tokenId: 'asc' } },
      ],
      select: { squigId: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    recentIds = rows.map((r) => r.squigId);
  }
  const rows = await db().squig.findMany({
    where: orderedIds
      ? {
          AND: [
            where,
            {
              tokenId: {
                in: orderedIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
              },
            },
          ],
        }
      : recentIds
        ? { id: { in: recentIds } }
        : where,
    select: cardSelect,
    orderBy: collectionOrder(filters.sort),
    ...(recentIds || orderedIds
      ? {}
      : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  });
  if (orderedIds) {
    const positions = new Map(orderedIds.map((id, index) => [id, index]));
    rows.sort((a, b) => positions.get(a.tokenId)! - positions.get(b.tokenId)!);
  }
  if (recentIds)
    rows.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
  const badgeSummaries = await squigBadgeSummaries(rows.map((r) => r.id));
  const [owned, discoveries, traits, history] = await Promise.all([
    collectorId
      ? db().squigOwnership.findMany({
          where: {
            squigId: { in: rows.map((r) => r.id) },
            squig: {
              activities: {
                none: {
                  sourceType: 'maw',
                  eventType: 'MAW_DIGESTED',
                  recordStatus: 'ACTIVE',
                },
              },
            },
            isCurrent: true,
            walletAddress: { in: addresses },
          },
          select: { squigId: true },
        })
      : [],
    eligible.filter((d) => rows.some((r) => r.id === d.squigId)),
    db().squigTrait.groupBy({
      by: ['traitType', 'value'],
      where: { squig: { AND: [catalogScope, scope] } },
      orderBy: [{ traitType: 'asc' }, { value: 'asc' }],
    }),
    collectorId
      ? db().collectorOwnershipPeriod.findMany({
          where: {
            collectorId,
            squigId: { in: rows.map((r) => r.id) },
            squig: { provenance: { is: { dirty: false, complete: true } } },
          },
          orderBy: { acquiredAt: 'asc' },
          select: {
            squigId: true,
            acquiredAt: true,
            lostAt: true,
            acquisitionEvent: true,
            lossEvent: true,
          },
        })
      : [],
  ]);
  const boundaries = collectorId
    ? await db().nftTransfer.findMany({
        where: {
          id: {
            in: history.flatMap((p) => [
              p.acquisitionEvent,
              ...(p.lossEvent ? [p.lossEvent] : []),
            ]),
          },
        },
        select: { id: true, eventAt: true },
      })
    : [];
  const chainTimes = new Map(
    boundaries.map((e) => [e.id, e.eventAt.getTime()]),
  );
  const ownedIds = new Set(owned.map((r) => r.squigId)),
    dates = new Map(
      discoveries.map((r) => [r.squigId, r.discoveredAt.toISOString()]),
    );
  const cursor = collectorId
    ? await db().chainCursor.findUnique({ where: { key: chainKey } })
    : null;
  const at = cursor
    ? await db().chainBlock.findUnique({
        where: { chainId_number: { chainId: 1, number: cursor.blockNumber } },
      })
    : null;
  const statusIcons = await personalIconSummaries(
    viewerId,
    rows.map((r) => r.tokenId),
  );
  return {
    items: rows.map((r): SquigCardData => ({
      ...cardDTO(r),
      achievements: badgeSummaries.get(r.id),
      statusIcons: statusIcons.get(r.tokenId),
      ...cardPersonalization(candidates?.[r.tokenId]),
      ...(collectorId
        ? {
            currentlyOwned: ownedIds.has(r.id),
            discoveredAt: dates.get(r.id),
            ...(() => {
              const held = history.filter((p) => p.squigId === r.id);
              return held.length
                ? {
                    history: {
                      firstAcquired: held[0].acquiredAt.toISOString(),
                      lastAcquired: held.at(-1)!.acquiredAt.toISOString(),
                      lastLoss: held.at(-1)!.lostAt?.toISOString() ?? null,
                      heldSeconds: held.reduce(
                        (sum, p) =>
                          sum +
                          Math.max(
                            0,
                            ((
                              p.lostAt ??
                              at?.timestamp ??
                              p.acquiredAt
                            ).getTime() -
                              p.acquiredAt.getTime()) /
                              1000,
                          ),
                        0,
                      ),
                      periods: held.length,
                      firstAcquiredIsChain:
                        chainTimes.get(held[0].acquisitionEvent) ===
                        held[0].acquiredAt.getTime(),
                      lastAcquiredIsChain:
                        chainTimes.get(held.at(-1)!.acquisitionEvent) ===
                        held.at(-1)!.acquiredAt.getTime(),
                      lastLossIsChain:
                        chainTimes.get(held.at(-1)!.lossEvent ?? '') ===
                        held.at(-1)!.lostAt?.getTime(),
                    },
                  }
                : {};
            })(),
          }
        : {}),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    filters,
    setSortUnavailable: filters.sort === 'sets-desc' && !candidates,
    market: market
      ? { status: market.status, complete: market.complete }
      : null,
    traits,
  };
}
export async function currentCollectionScope(
  collectorId: string,
  reader: DerivedReadClient = db(),
): Promise<Prisma.SquigWhereInput> {
  return {
    AND: [
      catalogScope,
      ownedScope(await collectionAddresses(collectorId, reader)),
    ],
  };
}
export async function collectionSummary(collectorId: string) {
  const summary = await db().$transaction(
    async (tx) => {
      const where = await currentCollectionScope(collectorId, tx);
      const [
        stats,
        og,
        legendary,
        discovered,
        rarities,
        top,
        traits,
        recorded,
      ] = await Promise.all([
        tx.squig.aggregate({
          where,
          _count: { _all: true, uglyPoints: true, og: true, legendary: true },
          _sum: { uglyPoints: true },
        }),
        tx.squig.count({ where: { ...where, og: true } }),
        tx.squig.count({ where: { ...where, legendary: true } }),
        collectionDiscoveries(tx, collectorId).then((rows) => rows.length),
        tx.squig.groupBy({
          by: ['rarityTier'],
          where,
          _count: { _all: true },
          orderBy: { rarityTier: 'asc' },
        }),
        tx.squig.findMany({
          where,
          select: cardSelect,
          orderBy: collectionOrder('points-desc'),
          take: 3,
        }),
        tx.squigTrait.groupBy({
          by: ['traitType', 'value'],
          where: { squig: where, value: { notIn: ['None', 'none', ''] } },
          _count: { _all: true },
          orderBy: { _count: { value: 'desc' } },
          take: 5,
        }),
        tx.squigDiscovery.count({
          where: { collectorId, everOwned: true, squig: catalogScope },
        }),
      ]);
      return {
        owned: stats._count._all,
        uglyPoints:
          stats._count.uglyPoints === stats._count._all
            ? Number(stats._sum.uglyPoints ?? 0)
            : null,
        og: stats._count.og === stats._count._all ? og : null,
        legendary:
          stats._count.legendary === stats._count._all ? legendary : null,
        discovered,
        unresolvedDiscoveries: Math.max(0, recorded - discovered),
        rarities: rarities.map((r) => ({
          name: r.rarityTier ?? 'Unclassified',
          count: r._count._all,
        })),
        top,
        traits: traits.map((t) => ({
          type: t.traitType,
          value: t.value,
          count: t._count._all,
        })),
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
  // Badge decoration has no bearing on the ownership/discovery metric snapshot.
  return { ...summary, top: await cardsWithBadges(summary.top) };
}
