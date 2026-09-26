import 'server-only';
import { db } from './db';
import {
  COLLECTION_RULESET as R,
  completion,
  type TraitEntry,
  type evaluateSet,
} from '@/domain/dex';
import {
  collectionSets,
  traitCatalog,
  requirementLabel,
} from '@/domain/dex-catalog';
import type { Candidates } from './dex-engine';
import { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';
type Result = ReturnType<typeof evaluateSet>;
export type SetCard = {
  key: string;
  name: string;
  description: string;
  category: string;
  mode: string;
  difficulty: string;
  hidden: boolean;
  revealed: boolean;
  complete: boolean;
  progress: number;
  required: number;
  requirements: {
    label: string;
    count: number;
    required: number;
    tokens: number[];
    explorer: string;
  }[];
  firstCompletedAt: string | null;
  completedAt: string | null;
  completionCount: number;
  featured: boolean;
};
export function setProjection(
  s: (typeof collectionSets)[number],
  result: Result | undefined,
  showEvidence: boolean,
): SetCard {
  const revealed = !s.hidden || !!result?.complete;
  return {
    key: s.key,
    name: revealed ? s.name : '???',
    description: revealed
      ? s.description
      : 'An unusual combination is waiting to be discovered.',
    category: revealed ? s.category : 'Hidden',
    mode: s.mode,
    difficulty: revealed ? s.difficulty : 'Secret',
    hidden: !!s.hidden,
    revealed,
    complete: !!result?.complete,
    progress: revealed ? (result?.progress ?? 0) : 0,
    required: revealed ? s.requirements.reduce((n, r) => n + r.count, 0) : 0,
    requirements: revealed
      ? s.requirements.map((r, i) => {
          const q = new URLSearchParams(),
            filter = r.filter,
            t = filter?.traits?.[0];
          if (t) {
            q.set('trait', t.type);
            if (t.values.length === 1) q.set('value', t.values[0]);
          }
          if (r.traitType) q.set('trait', r.traitType);
          if (filter?.og) q.set('og', '1');
          if (filter?.legendary) q.set('legendary', '1');
          if (filter?.rarity) q.set('rarity', filter.rarity);
          return {
            label: requirementLabel(r),
            count: result?.requirements[i]?.count ?? 0,
            required: r.count,
            tokens: showEvidence ? (result?.requirements[i]?.tokens ?? []) : [],
            explorer: `/squigs?${q}`,
          };
        })
      : [],
    firstCompletedAt: null,
    completedAt: null,
    completionCount: 0,
    featured: false,
  };
}
export async function dexView(id: string, isPublic = false) {
  return db().$transaction(
    async (tx) => {
      const collector = await tx.collector.findUnique({
        where: { id },
        select: {
          isPublic: true,
          showWallets: true,
          featuredSetIds: true,
          collectionVisibility: true,
        },
      });
      if (!collector || (isPublic && !collector.isPublic)) return null;
      const pending = await tx.collectionJob.findUnique({
          where: { collectorId: id },
        }),
        snapshot = await tx.collectionSnapshot.findUnique({
          where: { ruleset_collectorId: { ruleset: R, collectorId: id } },
        });
      if (pending || !snapshot) return { status: 'pending' as const };
      const rows = await tx.collectorSetProgress.findMany({
        where: { collectorId: id, set: { ruleset: R } },
      });
      const traits = await tx.collectorTraitDiscovery.findMany({
        where: { ruleset: R, collectorId: id, revokedAt: null },
      });
      const cards = collectionSets.map((s) => {
        const row = rows.find((r) => r.setId === `${R}:${s.key}`),
          card = setProjection(
            s,
            row?.progress as Result | undefined,
            !isPublic ||
              (collector.showWallets &&
                collector.collectionVisibility === 'FULL'),
          );
        return {
          ...card,
          firstCompletedAt: card.revealed
            ? (row?.firstCompletedAt?.toISOString() ?? null)
            : null,
          completedAt: card.revealed
            ? (row?.completedAt?.toISOString() ?? null)
            : null,
          completionCount: card.revealed ? (row?.completionCount ?? 0) : 0,
          featured:
            card.complete && collector.featuredSetIds.includes(`${R}:${s.key}`),
        };
      });
      const historicalTotal = collectionSets.filter(
        (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
      ).length;
      return {
        status: 'ready' as const,
        ruleset: R,
        score: completion(
          snapshot.discovered,
          snapshot.traits,
          traitCatalog.length,
          snapshot.historicalSets,
          historicalTotal,
        ),
        discovered: snapshot.discovered,
        traits: snapshot.traits,
        traitTotal: traitCatalog.length,
        historicalSets: snapshot.historicalSets,
        historicalTotal,
        currentSets: snapshot.currentSets,
        cards,
        updatedAt: snapshot.calculatedAt.toISOString(),
        traitDiscoveries: !isPublic
          ? traits.map((t) => ({
              key: t.traitKey,
              tokenId: t.tokenId,
              at: t.firstDiscoveredAt.toISOString(),
            }))
          : [],
        traitCounts: !isPublic
          ? (snapshot.traitCounts as Record<
              string,
              { owned: number; discovered: number }
            >)
          : {},
        currentIds: !isPublic ? snapshot.currentTokenIds : [],
        discoveredIds: !isPublic ? snapshot.discoveredTokenIds : [],
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  );
}
export type DexView = Awaited<ReturnType<typeof dexView>>;
export async function personalizedCandidates(id: string) {
  return db().$transaction(
    async (tx) => {
      if (await tx.collectionJob.findUnique({ where: { collectorId: id } }))
        return null;
      const s = await tx.collectionSnapshot.findUnique({
        where: { ruleset_collectorId: { ruleset: R, collectorId: id } },
        select: { candidates: true },
      });
      return s?.candidates as Candidates | null;
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function traitView(id?: string) {
  const dex = id ? await dexView(id) : null;
  const ready = dex?.status === 'ready' ? dex : null;

  return {
    status: ready ? 'ready' : id ? 'pending' : 'public',
    traits: traitCatalog.map((t) => ({
      ...t,
      first: ready?.traitDiscoveries.find((d) => d.key === t.key) ?? null,
      owned: ready?.traitCounts[t.key]?.owned ?? 0,
      discovered: ready?.traitCounts[t.key]?.discovered ?? 0,
    })),
  };
}
export type TraitView = TraitEntry & {
  first: { key: string; tokenId: number; at: string } | null;
  owned: number;
  discovered: number;
};
export async function saveFeaturedSets(id: string, input: unknown) {
  const keys = z
    .array(z.string().max(100))
    .max(3)
    .refine((v) => new Set(v).size === v.length)
    .parse(input);
  await db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`collections:${id}`},0))`;
      if (await tx.collectionJob.findUnique({ where: { collectorId: id } }))
        throw new Error('COLLECTIONS_PENDING');
      const ids = keys.map((k) => `${R}:${k}`),
        count = await tx.collectorSetProgress.count({
          where: {
            collectorId: id,
            setId: { in: ids },
            currentlyComplete: true,
            set: { ruleset: R },
          },
        });
      if (count !== ids.length) throw new Error('SET_NOT_COMPLETE');
      await tx.collector.update({
        where: { id },
        data: { featuredSetIds: ids },
      });
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function publicSetCollector(slug: string) {
  return db().collector.findFirst({
    where: { slug: slug.toLowerCase(), isPublic: true },
    select: { id: true, slug: true, displayName: true },
  });
}
export async function completionCount(key: string) {
  // Only opt-in public collectors with settled projections enter this public count.
  const rows = await db().$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(*) AS count FROM "CollectorSetProgress" p JOIN "Collector" c ON c.id=p."collectorId" WHERE p."setId"=${`${R}:${key}`} AND p."currentlyComplete" AND c."isPublic" AND NOT EXISTS(SELECT 1 FROM "CollectionJob" j WHERE j."collectorId"=c.id)`,
  );
  return Number(rows[0].count);
}
