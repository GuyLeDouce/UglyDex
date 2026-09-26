import 'server-only';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import { type Check } from '@/domain/operations';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { RULESET, evaluate } from '@/domain/progression';
import { hash } from '@/domain/events';
import {
  COLLECTION_RULESET as R,
  discoverTraits,
  evaluateSet,
  completion,
} from '@/domain/dex';
import {
  canonicalTokens,
  traitCatalog,
  collectionSets,
  verifyCatalog,
} from '@/domain/dex-catalog';
import { progressionFacts } from './progression-engine';
import { collectionEvidence } from './dex-engine';
import { migrationChecks } from './production';
import { chainKey } from '@/sync/provenance';

// Read-only verification. Run with workers paused for a stable evidence view.
export async function productionVerify(
  options: { owners?: 'spot' | 'full' } = {},
): Promise<Check[]> {
  const checks = await migrationChecks();
  if (checks.some((c) => c.status === 'FAIL')) return checks;
  const add = (name: string, failures: number, detail: string) =>
    checks.push({
      name,
      status: failures ? 'FAIL' : 'PASS',
      detail: `${failures} discrepancies; ${detail}`,
    });
  const rows = await db().squig.findMany({
    where: { chainId: 1, contractAddress: SQUIGS_CONTRACT },
    select: {
      tokenId: true,
      og: true,
      legendary: true,
      traits: { select: { traitType: true, value: true } },
    },
  });
  let invalid = Math.abs(4444 - rows.length) + verifyCatalog().length;
  for (const t of canonicalTokens) {
    const row = rows.find((r) => r.tokenId === t.tokenId);
    if (
      !row ||
      row.og !== t.og ||
      row.legendary !== t.legendary ||
      Object.keys(t.traits).length !== row.traits.length ||
      row.traits.some((v) => t.traits[v.traitType] !== v.value)
    )
      invalid++;
  }
  add('catalog.integrity', invalid, 'Canonical 4444 token and trait catalog');
  const count = async (query: Prisma.Sql) =>
    Number((await db().$queryRaw<{ n: bigint }[]>(query))[0].n);
  add(
    'ownership.unique',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM (SELECT "squigId" FROM "SquigOwnership" WHERE "isCurrent" GROUP BY "squigId" HAVING count(*)>1) x`,
    ),
    'At most one current owner per Squig',
  );
  add(
    'provenance.dirty',
    await db().squigProvenance.count({ where: { dirty: true } }),
    'Derivation queue drained',
  );
  add(
    'provenance.continuity',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM "WalletOwnershipPeriod" a JOIN "WalletOwnershipPeriod" b ON a."squigId"=b."squigId" AND a.id<b.id AND a."acquiredAt"<COALESCE(b."lostAt",'infinity'::timestamp) AND b."acquiredAt"<COALESCE(a."lostAt",'infinity'::timestamp)`,
    ),
    'No overlapping wallet periods',
  );
  add(
    'identity.attribution',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM "SquigDiscovery" d LEFT JOIN "CollectorOwnershipPeriod" p ON p.id=d."firstOwnershipPeriod" WHERE d."attributionStatus"='CONFIRMED' AND (p.id IS NULL OR p."collectorId"<>d."collectorId" OR p."squigId"<>d."squigId")`,
    ),
    'Confirmed discoveries reference the same Collector and Squig',
  );
  add(
    'activity.idempotency',
    await count(
      Prisma.sql`SELECT count(*) AS n FROM (SELECT "eventKey" FROM "CollectorActivity" GROUP BY "eventKey" HAVING count(*)>1) x`,
    ),
    'Unique normalized event keys',
  );
  const jobs =
    (await db().progressionJob.count()) +
    (await db().collectionJob.count()) +
    (await db().activityAttributionJob.count());
  add('derived.queues', jobs, 'All evaluation and attribution queues drained');
  let progressionFailures = 0,
    collectionFailures = 0,
    subjects = 0;
  for (const subject of ['COLLECTOR', 'SQUIG'] as const) {
    let cursor: string | undefined;
    do {
      const ids: { id: string }[] =
        subject === 'COLLECTOR'
          ? await db().collector.findMany({
              where: cursor ? { id: { gt: cursor } } : {},
              select: { id: true },
              orderBy: { id: 'asc' },
              take: 100,
            })
          : await db().squig.findMany({
              where: cursor ? { id: { gt: cursor } } : {},
              select: { id: true },
              orderBy: { id: 'asc' },
              take: 100,
            });
      for (const { id } of ids) {
        subjects++;
        await db().$transaction(
          async (tx) => {
            const { facts, gates } = await progressionFacts(tx, subject, id),
              result = evaluate(subject, facts, gates);
            const saved =
              subject === 'COLLECTOR'
                ? await tx.collectorProgress.findUnique({
                    where: { collectorId: id },
                  })
                : await tx.squigProgress.findUnique({ where: { squigId: id } });
            const ledger = await tx.xpLedgerEntry.findMany({
              where: {
                subjectType: subject,
                subjectId: id,
                ruleset: RULESET,
                revokedAt: null,
              },
              select: { id: true },
            });
            const desired = result.grants.map((g) =>
              hash([
                RULESET,
                subject,
                id,
                g.key,
                g.xp,
                g.fact.at,
                g.fact.metadata,
              ]),
            );
            if (
              !saved ||
              saved.xp !== result.total ||
              saved.level !== result.level ||
              ledger.length !== desired.length ||
              ledger.some((g) => !desired.includes(g.id))
            )
              progressionFailures++;
            const awardSelect = {
              achievementId: true,
              awardedAt: true,
              revokedAt: true,
              gateSatisfied: true,
              progress: true,
            } as const;
            const awards =
              subject === 'COLLECTOR'
                ? await tx.collectorAchievement.findMany({
                    where: {
                      collectorId: id,
                      achievement: { ruleset: RULESET },
                    },
                    select: awardSelect,
                  })
                : await tx.squigAchievement.findMany({
                    where: { squigId: id, achievement: { ruleset: RULESET } },
                    select: awardSelect,
                  });
            for (const award of result.awards) {
              const stored = awards.find(
                (a) => a.achievementId === `${RULESET}:${award.definition.key}`,
              );
              if (
                !stored ||
                Boolean(stored.awardedAt && !stored.revokedAt) !==
                  award.unlocked ||
                stored.gateSatisfied !== award.gate ||
                stored.progress !== award.progress
              )
                progressionFailures++;
            }
            if (subject === 'COLLECTOR') {
              const e = await collectionEvidence(tx, id),
                traits = discoverTraits(e.historical);
              const snapshot = await tx.collectionSnapshot.findUnique({
                where: { ruleset_collectorId: { ruleset: R, collectorId: id } },
              });
              const savedTraits = await tx.collectorTraitDiscovery.findMany({
                where: { collectorId: id, ruleset: R, revokedAt: null },
              });
              if (
                savedTraits.length !== traits.size ||
                savedTraits.some((t) => {
                  const expected = traits.get(t.traitKey);
                  return (
                    !expected ||
                    expected.tokenId !== t.tokenId ||
                    expected.at !== t.firstDiscoveredAt.toISOString() ||
                    expected.evidence !== t.evidence
                  );
                })
              )
                collectionFailures++;
              const sameTokens = (a: number[], b: number[]) =>
                [...a].sort((x, y) => x - y).join(',') ===
                [...b].sort((x, y) => x - y).join(',');
              if (
                snapshot &&
                (!sameTokens(
                  snapshot.currentTokenIds,
                  e.current.map((t) => t.tokenId),
                ) ||
                  !sameTokens(
                    snapshot.discoveredTokenIds,
                    e.historical.map((t) => t.tokenId),
                  ))
              )
                collectionFailures++;
              const sets = await tx.collectorSetProgress.findMany({
                where: { collectorId: id, set: { ruleset: R } },
              });
              let historical = 0;
              for (const s of collectionSets) {
                const result = evaluateSet(
                  s,
                  s.mode === 'HISTORICAL_DISCOVERY' ? e.historical : e.current,
                );
                if (
                  result.complete &&
                  s.mode === 'HISTORICAL_DISCOVERY' &&
                  !s.hidden
                )
                  historical++;
                const stored = sets.find((v) => v.setId === `${R}:${s.key}`);
                if (
                  !stored ||
                  stored.currentlyComplete !== result.complete ||
                  JSON.stringify(stored.progress) !==
                    JSON.stringify(JSON.parse(JSON.stringify(result)))
                ) {
                  // PostgreSQL jsonb key order is not significant.
                  if (
                    !stored ||
                    stored.currentlyComplete !== result.complete ||
                    hash(stored.progress) !== hash(result)
                  )
                    collectionFailures++;
                }
              }
              const score = completion(
                e.historical.length,
                traits.size,
                traitCatalog.length,
                historical,
                collectionSets.filter(
                  (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
                ).length,
              );
              if (
                !snapshot ||
                snapshot.discovered !== e.historical.length ||
                snapshot.traits !== traits.size ||
                snapshot.overall !== score.overall
              )
                collectionFailures++;
            }
          },
          { isolationLevel: 'RepeatableRead', timeout: 60000 },
        );
      }
      cursor = ids.length === 100 ? ids.at(-1)!.id : undefined;
    } while (cursor);
  }
  add(
    'progression.replay',
    progressionFailures,
    `${subjects} subjects recomputed without writes`,
  );
  add(
    'collections.replay',
    collectionFailures,
    'Completion and deterministic set evidence recomputed without writes',
  );
  const { shareCard } = await import('./sharing');
  const { shareSchema } = await import('@/domain/sharing');
  let privacyFailures = 0;
  let cursor: string | undefined;
  do {
    const privateProfiles = await db().collector.findMany({
      where: { isPublic: false, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true, slug: true },
      take: 100,
      orderBy: { id: 'asc' },
    });
    for (const c of privateProfiles)
      if (await shareCard(shareSchema.parse({ entity: c.slug })))
        privacyFailures++;
    cursor =
      privateProfiles.length === 100 ? privateProfiles.at(-1)!.id : undefined;
  } while (cursor);
  add(
    'privacy.private_cards',
    privacyFailures,
    'Private Collectors have no personalized anonymous share projection',
  );
  const coverage = await db().squigProvenance.count({
    where: { complete: true, dirty: false },
  });
  checks.push({
    name: 'history.coverage',
    status: coverage === 4444 ? 'PASS' : 'WARN',
    detail: `${coverage}/4444 complete provenance; tracked counts are not lifetime totals`,
  });
  if (options.owners) {
    try {
      const { validateContract, getOwnershipBatch } =
        await import('@/integrations/blockchain');
      const client = await validateContract();
      const cursor = await db().chainCursor.findUniqueOrThrow({
        where: { key: chainKey },
      });
      const block = await client.getBlock({ blockNumber: cursor.blockNumber });
      if (block.hash !== cursor.blockHash)
        throw new Error('CURSOR_HASH_MISMATCH');
      const tokens =
        options.owners === 'full'
          ? Array.from({ length: 4444 }, (_, i) => i + 1)
          : [1, 444, 888, 1333, 1777, 2222, 2666, 3111, 3555, 4000, 4444];
      let failures = 0;
      for (let i = 0; i < tokens.length; i += 100) {
        const batch = tokens.slice(i, i + 100),
          owners = await getOwnershipBatch(client, batch, block.number);
        const stored = await db().squig.findMany({
          where: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: { in: batch },
          },
          select: {
            tokenId: true,
            provenance: { select: { currentWallet: true } },
          },
        });
        owners.forEach((o, index) => {
          if (
            o.status !== 'success' ||
            o.result.toLowerCase() !==
              stored.find((s) => s.tokenId === batch[index])?.provenance
                ?.currentWallet
          )
            failures++;
        });
      }
      if (
        (await client.getBlock({ blockNumber: block.number })).hash !==
        block.hash
      )
        throw new Error('BLOCK_CHANGED');
      add(
        'chain.ownerOf',
        failures,
        `${tokens.length} reads pinned to indexed block ${block.number}`,
      );
    } catch {
      checks.push({
        name: 'chain.ownerOf',
        status: 'FAIL',
        detail: 'RPC verification unavailable or cursor changed',
      });
    }
  } else
    checks.push({
      name: 'chain.ownerOf',
      status: 'WARN',
      detail: 'Use --owners spot or --owners full for RPC verification',
    });
  const { verifyCollectibles } = await import('./collectibles-verify');
  checks.push(...(await verifyCollectibles()));
  return checks;
}
