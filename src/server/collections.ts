import 'server-only';
import { db } from './db';
import { personalizedCandidates } from './dex';
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
    traits: row.traits,
  };
}
export type SquigCardData = ReturnType<typeof cardDTO> & {
  representation?: string;
  personalization?: {
    discovered: boolean;
    owned: boolean;
    missingTraits: number;
    advances: number;
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
export async function activeAddresses(collectorId: string) {
  return (
    await db().collectorWallet.findMany({
      where: { collectorId, status: 'ACTIVE', chainId: 1, revokedAt: null },
      select: { walletAddress: true },
    })
  ).map((w) => w.walletAddress);
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
) {
  const filters = filterSchema.parse(params),
    addresses = collectorId ? await activeAddresses(collectorId) : [];
  const candidates = viewerId ? await personalizedCandidates(viewerId) : null;
  const personalizedScope: Prisma.SquigWhereInput =
    filters.dex || filters.set
      ? {
          tokenId: {
            in: candidates
              ? Object.entries(candidates)
                  .filter(
                    ([, c]) =>
                      (!filters.set || c.sets.includes(filters.set)) &&
                      (!filters.dex ||
                        (filters.dex === 'undiscovered'
                          ? !c.discovered
                          : filters.dex === 'traits'
                            ? c.missingTraits > 0
                            : c.sets.length > 0)),
                  )
                  .map(([id]) => Number(id))
              : [],
          },
        }
      : {};
  const scope: Prisma.SquigWhereInput = collectorId
    ? discovered
      ? { discoveries: { some: { collectorId, everOwned: true } } }
      : ownedScope(addresses)
    : {};
  const where: Prisma.SquigWhereInput = {
    AND: [catalogScope, scope, collectionWhere(filters), personalizedScope],
  };
  const total = await db().squig.count({ where });
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
    where: recentIds ? { id: { in: recentIds } } : where,
    select: cardSelect,
    orderBy: collectionOrder(filters.sort),
    ...(recentIds ? {} : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  });
  if (recentIds)
    rows.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
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
    collectorId
      ? db().squigDiscovery.findMany({
          where: {
            collectorId,
            squigId: { in: rows.map((r) => r.id) },
            everOwned: true,
          },
          select: { squigId: true, discoveredAt: true },
        })
      : [],
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
  return {
    items: rows.map((r): SquigCardData => ({
      ...cardDTO(r),
      ...(candidates?.[r.tokenId]
        ? {
            personalization: {
              discovered: candidates[r.tokenId].discovered,
              owned: candidates[r.tokenId].owned,
              missingTraits: candidates[r.tokenId].missingTraits,
              advances: candidates[r.tokenId].sets.length,
            },
          }
        : {}),
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
    traits,
  };
}
export async function collectionSummary(collectorId: string) {
  const addresses = await activeAddresses(collectorId),
    where = { AND: [catalogScope, ownedScope(addresses)] };
  const [stats, og, legendary, discovered, rarities, top, traits] =
    await Promise.all([
      db().squig.aggregate({
        where,
        _count: { _all: true, uglyPoints: true, og: true, legendary: true },
        _sum: { uglyPoints: true },
      }),
      db().squig.count({ where: { ...where, og: true } }),
      db().squig.count({ where: { ...where, legendary: true } }),
      db().squigDiscovery.count({
        where: { collectorId, everOwned: true, squig: catalogScope },
      }),
      db().squig.groupBy({
        by: ['rarityTier'],
        where,
        _count: { _all: true },
        orderBy: { rarityTier: 'asc' },
      }),
      db().squig.findMany({
        where,
        select: cardSelect,
        orderBy: collectionOrder('points-desc'),
        take: 3,
      }),
      db().squigTrait.groupBy({
        by: ['traitType', 'value'],
        where: { squig: where, value: { notIn: ['None', 'none', ''] } },
        _count: { _all: true },
        orderBy: { _count: { value: 'desc' } },
        take: 5,
      }),
    ]);
  return {
    owned: stats._count._all,
    uglyPoints:
      stats._count.uglyPoints === stats._count._all
        ? Number(stats._sum.uglyPoints ?? 0)
        : null,
    og: stats._count.og === stats._count._all ? og : null,
    legendary: stats._count.legendary === stats._count._all ? legendary : null,
    discovered,
    rarities: rarities.map((r) => ({
      name: r.rarityTier ?? 'Unclassified',
      count: r._count._all,
    })),
    top: top.map(cardDTO),
    traits: traits.map((t) => ({
      type: t.traitType,
      value: t.value,
      count: t._count._all,
    })),
  };
}
