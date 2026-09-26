import 'server-only';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import { hash } from '@/domain/events';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import {
  COLLECTION_RULESET as R,
  completion,
  discoverTraits,
  evaluateSet,
  evaluateRequirement,
  matches,
  tokenTraits,
  normalizeTrait,
  type DexToken,
} from '@/domain/dex';
import {
  collectionSets,
  traitCatalog,
  canonicalTokens,
  verifyCatalog,
} from '@/domain/dex-catalog';
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
export const historicalSets = collectionSets.filter(
  (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
);
export async function seedCollections() {
  const errors = verifyCatalog();
  for (const s of collectionSets)
    if (!evaluateSet(s, canonicalTokens).complete)
      errors.push(`${s.key}:IMPOSSIBLE_SET`);
  if (errors.length) throw new Error(errors.join(','));
  const configuration = {
    sets: collectionSets,
    catalog: traitCatalog,
    weights: [40, 35, 25],
    semantics: 1,
  };
  await db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${R},0))`;
      const prior = await tx.collectionRuleset.findUnique({ where: { id: R } });
      if (prior && prior.fingerprint !== hash(configuration))
        throw new Error('COLLECTION_VERSION_BUMP_REQUIRED');
      await tx.collectionRuleset.upsert({
        where: { id: R },
        create: {
          id: R,
          fingerprint: hash(configuration),
          configuration: json(configuration),
        },
        update: {},
      });
      await tx.canonicalTrait.createMany({
        data: traitCatalog.map((t) => ({
          ruleset: R,
          key: t.key,
          traitType: t.type,
          value: t.value,
          tokenCount: t.count,
          firstToken: t.firstToken,
          ogCount: t.ogCount,
          legendaryOnly: t.legendaryOnly,
        })),
        skipDuplicates: true,
      });
      for (const [sortOrder, s] of collectionSets.entries()) {
        const id = `${R}:${s.key}`;
        await tx.collectionSetDefinition.upsert({
          where: { id },
          update: {},
          create: {
            id,
            ruleset: R,
            name: s.name,
            description: s.description,
            mode: s.mode,
            category: s.category,
            difficulty: s.difficulty,
            hidden: !!s.hidden,
            sortOrder,
          },
        });
        for (const [i, r] of s.requirements.entries())
          await tx.collectionSetRequirement.upsert({
            where: { setId_key: { setId: id, key: String(i) } },
            create: {
              setId: id,
              key: String(i),
              criteria: json(r),
              requiredCount: r.count,
            },
            update: {},
          });
      }
    },
    { timeout: 30000 },
  );
}
export async function collectionEvidence(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const rows = await tx.squig.findMany({
    where: { chainId: 1, contractAddress: SQUIGS_CONTRACT },
    select: {
      id: true,
      tokenId: true,
      og: true,
      legendary: true,
      rarityTier: true,
      traits: { select: { traitType: true, value: true } },
    },
  });
  const tokens = rows.map((s): DexToken => ({
    tokenId: s.tokenId,
    og: s.og === true,
    legendary: s.legendary === true,
    rarityTier: s.rarityTier ?? '',
    traits: Object.fromEntries(s.traits.map((t) => [t.traitType, t.value])),
  }));
  const byId = new Map(rows.map((r, i) => [r.id, tokens[i]]));
  const discoveries = await tx.$queryRaw<
    { squigId: string; discoveredAt: Date; firstOwnershipPeriod: string }[]
  >`
    SELECT d."squigId",d."discoveredAt",d."firstOwnershipPeriod" FROM "SquigDiscovery" d
    JOIN "SquigProvenance" p ON p."squigId"=d."squigId" AND NOT p.dirty AND p.complete
    JOIN "CollectorOwnershipPeriod" h ON h.id=d."firstOwnershipPeriod" AND h."collectorId"=d."collectorId" AND h."squigId"=d."squigId" AND h."acquiredAt"=d."discoveredAt"
    WHERE d."collectorId"=${id}::uuid AND d."everOwned" AND d."attributionStatus"='CONFIRMED'`;
  const historical = discoveries.flatMap((d) => {
    const token = byId.get(d.squigId);
    return token
      ? [
          {
            ...token,
            at: d.discoveredAt.toISOString(),
            evidence: d.firstOwnershipPeriod,
          },
        ]
      : [];
  });
  const owned = await tx.$queryRaw<{ squigId: string }[]>`
    SELECT DISTINCT o."squigId" FROM "SquigOwnership" o
    JOIN "CollectorWallet" w ON w."walletAddress"=o."walletAddress" AND w."chainId"=1 AND w.status='ACTIVE' AND w."revokedAt" IS NULL
    WHERE w."collectorId"=${id}::uuid AND o."isCurrent"
    AND NOT EXISTS(SELECT 1 FROM "SquigProvenance" p WHERE p."squigId"=o."squigId" AND p.dirty)
    AND NOT EXISTS(SELECT 1 FROM "CollectorActivity" a WHERE a."squigId"=o."squigId" AND a."sourceType"='maw' AND a."eventType"='MAW_DIGESTED' AND a."recordStatus"='ACTIVE')`;
  const current = owned.flatMap((o) =>
    byId.has(o.squigId) ? [byId.get(o.squigId)!] : [],
  );
  return { tokens, historical, current };
}
// One batch per subject, not one evaluation per explorer card. Hidden goals never feed hints.
export function candidateMap(
  tokens: DexToken[],
  historical: DexToken[],
  current: DexToken[],
) {
  const known = new Set(
    historical.flatMap((t) => tokenTraits(t).map((t) => t.key)),
  );
  const discovered = new Set(historical.map((t) => t.tokenId)),
    owned = new Set(current.map((t) => t.tokenId));
  const gaps = collectionSets
    .filter((s) => !s.hidden)
    .flatMap((s) => {
      const held = s.mode === 'CURRENT_HOLDING' ? current : historical;
      return s.requirements.flatMap((r) => {
        if (evaluateRequirement(r, held).complete) return [];
        return [
          {
            set: s.key,
            r,
            ids: new Set(held.map((t) => t.tokenId)),
            values: new Set(
              held
                .filter((t) => matches(t, r.filter))
                .map((t) => normalizeTrait(t.traits[r.traitType ?? ''] ?? '')),
            ),
          },
        ];
      });
    });
  return Object.fromEntries(
    tokens.map((t) => {
      const sets = [
        ...new Set(
          gaps
            .filter(
              (g) =>
                !g.ids.has(t.tokenId) &&
                matches(t, g.r.filter) &&
                (g.r.kind !== 'TOKEN_IDS' ||
                  g.r.tokenIds?.includes(t.tokenId)) &&
                (g.r.kind !== 'UNIQUE_TRAIT_VALUES' ||
                  (!!t.traits[g.r.traitType!] &&
                    !g.values.has(normalizeTrait(t.traits[g.r.traitType!])))),
            )
            .map((g) => g.set),
        ),
      ];
      return [
        String(t.tokenId),
        {
          discovered: discovered.has(t.tokenId),
          owned: owned.has(t.tokenId),
          missingTraits: tokenTraits(t).filter((t) => !known.has(t.key)).length,
          sets,
        },
      ];
    }),
  );
}
export type Candidates = ReturnType<typeof candidateMap>;
export async function rebuildCollection(id: string) {
  const run = await db().syncRun.create({
    data: {
      source: `collections:${R}`,
      counts: {},
      cursorStart: { collector: id },
    },
  });
  try {
    return await db().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`collections:${id}`},0))`;
        await tx.collector.findUniqueOrThrow({
          where: { id },
          select: { id: true },
        });
        if (!(await tx.collectionRuleset.findUnique({ where: { id: R } })))
          throw new Error('COLLECTIONS_NOT_SEEDED');
        const job = await tx.collectionJob.findUnique({
          where: { collectorId: id },
        });
        const { tokens, historical, current } = await collectionEvidence(
          tx,
          id,
        );
        const catalogKeys = new Set(traitCatalog.map((t) => t.key));
        if (
          tokens.some((t) =>
            tokenTraits(t).some((trait) => !catalogKeys.has(trait.key)),
          )
        )
          throw new Error('UNKNOWN_CANONICAL_TRAIT_REQUIRES_VERSION');
        await tx.syncRun.updateMany({
          where: {
            source: 'collections:' + R,
            status: 'RUNNING',
            startedAt: { lt: run.startedAt },
            cursorStart: { path: ['collector'], equals: id },
          },
          data: {
            status: 'INTERRUPTED',
            errorCode: 'RETRIED_AFTER_INTERRUPTION',
            finishedAt: new Date(),
          },
        });
        const traits = discoverTraits(historical),
          now = new Date();
        const counts = {
          discovered: historical.length,
          traits: traits.size,
          completed: 0,
          revoked: 0,
          changed: 0,
        };
        const audit = async (
          kind: string,
          reference: string,
          before: unknown,
          after: unknown,
        ) => {
          counts.changed++;
          await tx.collectionAudit.create({
            data: {
              ruleset: R,
              collectorId: id,
              kind,
              reference,
              ...(before ? { before: json(before) } : {}),
              ...(after ? { after: json(after) } : {}),
            },
          });
        };
        const desiredMilestones = new Map<
          string,
          { at: Date; basis: string }
        >();
        const priorTraits = await tx.collectorTraitDiscovery.findMany({
          where: { ruleset: R, collectorId: id },
        });
        for (const [key, t] of traits) {
          if (!traitCatalog.some((c) => c.key === key))
            throw new Error('UNKNOWN_CANONICAL_TRAIT_REQUIRES_VERSION');
          const old = priorTraits.find((p) => p.traitKey === key),
            data = {
              tokenId: t.tokenId,
              firstDiscoveredAt: new Date(t.at),
              evidence: t.evidence,
              revokedAt: null,
            };
          if (
            !old ||
            old.revokedAt ||
            old.evidence !== t.evidence ||
            old.tokenId !== t.tokenId ||
            old.firstDiscoveredAt.toISOString() !== t.at
          )
            await audit(
              old ? 'TRAIT_RESTORED_OR_CORRECTED' : 'TRAIT_DISCOVERED',
              key,
              old,
              data,
            );
          await tx.collectorTraitDiscovery.upsert({
            where: {
              ruleset_collectorId_traitKey: {
                ruleset: R,
                collectorId: id,
                traitKey: key,
              },
            },
            create: { ruleset: R, collectorId: id, traitKey: key, ...data },
            update: data,
          });
          desiredMilestones.set(`trait:${key}`, {
            at: new Date(t.at),
            basis: 'HISTORICAL_EVIDENCE',
          });
        }
        for (const old of priorTraits)
          if (!old.revokedAt && !traits.has(old.traitKey)) {
            await tx.collectorTraitDiscovery.update({
              where: {
                ruleset_collectorId_traitKey: {
                  ruleset: R,
                  collectorId: id,
                  traitKey: old.traitKey,
                },
              },
              data: { revokedAt: now },
            });
            await audit('TRAIT_INVALIDATED', old.traitKey, old, null);
          }
        const priorSets = await tx.collectorSetProgress.findMany({
          where: { collectorId: id, set: { ruleset: R } },
        });
        let historicalCount = 0,
          currentCount = 0;
        const setTimes: { at: string }[] = [];
        for (const s of collectionSets) {
          const historicalMode = s.mode === 'HISTORICAL_DISCOVERY',
            result = evaluateSet(s, historicalMode ? historical : current),
            setId = `${R}:${s.key}`,
            old = priorSets.find((p) => p.setId === setId);
          const first =
            old?.firstCompletedAt ??
            (result.complete
              ? historicalMode && result.at
                ? new Date(result.at)
                : now
              : null);
          const transition = result.complete && !old?.currentlyComplete;
          if (result.complete) {
            counts.completed++;
            if (historicalMode && !s.hidden) {
              historicalCount++;
              if (result.at) setTimes.push({ at: result.at });
            }
            if (!historicalMode) currentCount++;
          }
          if (old?.currentlyComplete && !result.complete) counts.revoked++;
          if (
            !old ||
            hash(old.progress) !== hash(result) ||
            old.currentlyComplete !== result.complete
          )
            await audit(
              transition
                ? 'SET_COMPLETED'
                : old?.currentlyComplete && !result.complete
                  ? historicalMode
                    ? 'SET_INVALIDATED'
                    : 'CURRENT_SET_LOST'
                  : 'SET_PROGRESS',
              s.key,
              old?.progress,
              result,
            );
          await tx.collectorSetProgress.upsert({
            where: { collectorId_setId: { collectorId: id, setId } },
            create: {
              collectorId: id,
              setId,
              progress: json(result),
              currentlyComplete: result.complete,
              completedAt: result.complete
                ? result.at
                  ? new Date(result.at)
                  : now
                : null,
              firstCompletedAt: first,
              lastCompletedAt: first,
              completionCount: Number(result.complete),
            },
            update: {
              progress: json(result),
              currentlyComplete: result.complete,
              completedAt: result.complete
                ? historicalMode && result.at
                  ? new Date(result.at)
                  : (old?.completedAt ?? now)
                : null,
              firstCompletedAt: first,
              lastCompletedAt: transition
                ? historicalMode && result.at
                  ? new Date(result.at)
                  : now
                : old?.lastCompletedAt,
              completionCount: { increment: Number(transition) },
              calculatedAt: now,
            },
          });
          if (result.complete)
            desiredMilestones.set(`set:${s.key}`, {
              at: historicalMode && result.at ? new Date(result.at) : first!,
              basis: historicalMode
                ? 'HISTORICAL_EVIDENCE'
                : 'FIRST_OBSERVED_COMPLETE',
            });
        }
        const score = completion(
          historical.length,
          traits.size,
          traitCatalog.length,
          historicalCount,
          historicalSets.length,
        );
        // Threshold dates are reconstructed from qualifying evidence, not replay time.
        const dates = [
          ...new Set([
            ...historical.map((t) => t.at!),
            ...setTimes.map((t) => t.at),
          ]),
        ].sort();
        for (const threshold of [1, 5, 10, 25, 50, 75, 90, 100]) {
          if (score.overall < threshold) continue;
          const at = dates.find(
            (at) =>
              completion(
                historical.filter((t) => t.at! <= at).length,
                [...traits.values()].filter((t) => t.at <= at).length,
                traitCatalog.length,
                setTimes.filter((t) => t.at <= at).length,
                historicalSets.length,
              ).overall >= threshold,
          );
          if (at)
            desiredMilestones.set(`completion:${threshold}`, {
              at: new Date(at),
              basis: 'HISTORICAL_EVIDENCE',
            });
        }
        const milestones = await tx.collectionMilestone.findMany({
          where: { ruleset: R, collectorId: id },
        });
        for (const [key, m] of desiredMilestones) {
          const old = milestones.find((x) => x.key === key);
          if (!old || old.revokedAt || +old.reachedAt !== +m.at)
            await audit('MILESTONE_REACHED_OR_RESTORED', key, old, {
              at: m.at,
              basis: m.basis,
            });
          await tx.collectionMilestone.upsert({
            where: {
              ruleset_collectorId_key: { ruleset: R, collectorId: id, key },
            },
            create: {
              ruleset: R,
              collectorId: id,
              key,
              reachedAt: m.at,
              timeBasis: m.basis,
            },
            update: { reachedAt: m.at, timeBasis: m.basis, revokedAt: null },
          });
        }
        for (const old of milestones)
          if (!old.revokedAt && !desiredMilestones.has(old.key)) {
            // Current first-completion history is retained even after a sale.
            if (old.timeBasis === 'FIRST_OBSERVED_COMPLETE') continue;
            await tx.collectionMilestone.update({
              where: {
                ruleset_collectorId_key: {
                  ruleset: R,
                  collectorId: id,
                  key: old.key,
                },
              },
              data: { revokedAt: now },
            });
            await audit('MILESTONE_INVALIDATED', old.key, old, null);
          }
        const traitCounts: Record<
          string,
          { owned: number; discovered: number }
        > = {};
        for (const [list, field] of [
          [historical, 'discovered'],
          [current, 'owned'],
        ] as const)
          for (const t of list)
            for (const trait of tokenTraits(t)) {
              traitCounts[trait.key] ??= { owned: 0, discovered: 0 };
              traitCounts[trait.key][field]++;
            }
        const data = {
          traitCounts: json(traitCounts),
          discovered: historical.length,
          traits: traits.size,
          historicalSets: historicalCount,
          currentSets: currentCount,
          overall: score.overall,
          discoveredTokenIds: historical
            .map((t) => t.tokenId)
            .sort((a, b) => a - b),
          currentTokenIds: current.map((t) => t.tokenId).sort((a, b) => a - b),
          candidates: json(candidateMap(tokens, historical, current)),
          calculatedAt: now,
        };
        await tx.collectionSnapshot.upsert({
          where: { ruleset_collectorId: { ruleset: R, collectorId: id } },
          create: { ruleset: R, collectorId: id, ...data },
          update: data,
        });
        if (job)
          await tx.collectionJob.deleteMany({
            where: { collectorId: id, generation: job.generation },
          });
        await tx.syncRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETE', counts, finishedAt: now },
        });
        return counts;
      },
      { isolationLevel: 'RepeatableRead', timeout: 60000 },
    );
  } catch (cause) {
    await db().syncRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorCode: 'COLLECTION_EVALUATION_FAILED',
        finishedAt: new Date(),
      },
    });
    await db().collectionJob.upsert({
      where: { collectorId: id },
      create: { collectorId: id, errorCode: 'EVALUATION_FAILED', attempts: 1 },
      update: {
        errorCode: 'EVALUATION_FAILED',
        attempts: { increment: 1 },
        queuedAt: new Date(),
      },
    });
    throw new Error('COLLECTION_EVALUATION_FAILED', { cause });
  }
}
export async function processCollections(limit = 25, stop = () => false) {
  const jobs = await db().collectionJob.findMany({
    orderBy: { queuedAt: 'asc' },
    take: limit,
  });
  let processed = 0,
    failed = 0;
  for (const j of jobs) {
    if (stop()) break;
    try {
      await rebuildCollection(j.collectorId);
      processed++;
    } catch {
      failed++;
    }
  }
  return { processed, failed };
}
export async function queueCollections(restart = false) {
  await db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`replay:${R}`},0))`;
      const p = await tx.collectionReplay.upsert({
        where: { id: R },
        create: { id: R },
        update: restart ? { cursor: null, completedAt: null } : {},
      });
      if (p.completedAt) return;
      const rows = await tx.collector.findMany({
        where: p.cursor ? { id: { gt: p.cursor } } : {},
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 200,
      });
      for (const c of rows)
        await tx.$executeRaw`SELECT collections_enqueue(${c.id}::uuid)`;
      await tx.collectionReplay.update({
        where: { id: R },
        data: {
          cursor: rows.at(-1)?.id ?? p.cursor,
          completedAt: rows.length < 200 ? new Date() : null,
        },
      });
    },
    { timeout: 30000 },
  );
  return (await db().collectionReplay.findUniqueOrThrow({ where: { id: R } }))
    .completedAt;
}
