import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import type { Check } from '@/domain/operations';
import { RULESET, evaluate } from '@/domain/progression';
import { hash } from '@/domain/events';
import {
  COLLECTION_RULESET as R,
  discoverTraits,
  evaluateSet,
  completion,
  tokenTraits,
} from '@/domain/dex';
import { traitCatalog, collectionSets } from '@/domain/dex-catalog';
import { progressionFacts } from './progression-engine';
import { collectionEvidence, candidateMap } from './dex-engine';
export async function verifyDerived(
  tx: Prisma.TransactionClient,
): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, failures: number, detail: string) =>
    checks.push({
      name,
      status: failures ? 'FAIL' : 'PASS',
      detail: failures + ' discrepancies; ' + detail,
    });
  let progressionFailures = 0,
    collectionFailures = 0,
    subjects = 0;
  for (const subject of ['COLLECTOR', 'SQUIG'] as const) {
    let cursor: string | undefined;
    do {
      const ids: { id: string }[] =
        subject === 'COLLECTOR'
          ? await tx.collector.findMany({
              where: cursor ? { id: { gt: cursor } } : {},
              select: { id: true },
              orderBy: { id: 'asc' },
              take: 100,
            })
          : await tx.squig.findMany({
              where: cursor ? { id: { gt: cursor } } : {},
              select: { id: true },
              orderBy: { id: 'asc' },
              take: 100,
            });
      for (const { id } of ids) {
        subjects++;
        await (async () => {
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
            saved.rulesVersion !== RULESET ||
            ledger.length !== desired.length ||
            ledger.some((g) => !desired.includes(g.id))
          )
            progressionFailures++;
          for (const [index, g] of result.grants.entries()) {
            const row = ledger.find((x) => x.id === desired[index]);
            if (
              !row ||
              row.xp !== g.xp ||
              row.ruleId !== g.rule ||
              row.grantKey !== g.key ||
              row.earnedAt.toISOString() !== g.fact.at ||
              row.sourceActivityId !== (g.fact.activityId ?? null) ||
              hash(row.evidence) !==
                hash(
                  JSON.parse(
                    JSON.stringify({
                      key: g.fact.key,
                      tokenId: g.fact.tokenId,
                      reason: g.rule,
                      at: g.fact.at,
                    }),
                  ),
                )
            )
              progressionFailures++;
          }
          const milestones = await tx.progressionMilestone.findMany({
            where: { ruleset: RULESET, subjectType: subject, subjectId: id },
            orderBy: { level: 'asc' },
          });
          if (
            hash(
              milestones.map((m) => ({
                level: m.level,
                at: m.reachedAt.toISOString(),
              })),
            ) !== hash([...result.milestones].sort((a, b) => a.level - b.level))
          )
            progressionFailures++;
          const awardSelect = {
            achievementId: true,
            awardedAt: true,
            revokedAt: true,
            gateSatisfied: true,
            progress: true,
            evidence: true,
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
          if (awards.length !== result.awards.length) progressionFailures++;
          for (const award of result.awards) {
            const stored = awards.find(
              (a) => a.achievementId === `${RULESET}:${award.definition.key}`,
            );
            if (
              !stored ||
              Boolean(stored.awardedAt && !stored.revokedAt) !==
                award.unlocked ||
              stored.gateSatisfied !== award.gate ||
              stored.progress !== award.progress ||
              (award.at && stored.awardedAt?.toISOString() !== award.at) ||
              hash(stored.evidence) !==
                hash(
                  JSON.parse(
                    JSON.stringify({
                      keys: award.evidence.slice(0, award.definition.threshold),
                      count: award.progress,
                      threshold: award.definition.threshold,
                      gate: award.definition.gate,
                      qualifyingAt: award.at,
                    }),
                  ),
                )
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
            let currentCount = 0;
            const setTimes: { at: string }[] = [];
            const expectedMilestones = new Map<
              string,
              { at: string; basis: string }
            >();
            for (const [key, t] of traits)
              expectedMilestones.set(`trait:${key}`, {
                at: t.at,
                basis: 'HISTORICAL_EVIDENCE',
              });
            if (sets.length !== collectionSets.length) collectionFailures++;
            for (const s of collectionSets) {
              const result = evaluateSet(
                s,
                s.mode === 'HISTORICAL_DISCOVERY' ? e.historical : e.current,
              );
              if (
                result.complete &&
                s.mode === 'HISTORICAL_DISCOVERY' &&
                !s.hidden
              ) {
                historical++;
                if (result.at) setTimes.push({ at: result.at });
              }
              const stored = sets.find((v) => v.setId === `${R}:${s.key}`);
              if (result.complete && s.mode === 'CURRENT_HOLDING')
                currentCount++;
              if (result.complete) {
                const at =
                  s.mode === 'HISTORICAL_DISCOVERY'
                    ? result.at
                    : stored?.firstCompletedAt?.toISOString();
                if (at)
                  expectedMilestones.set(`set:${s.key}`, {
                    at,
                    basis:
                      s.mode === 'HISTORICAL_DISCOVERY'
                        ? 'HISTORICAL_EVIDENCE'
                        : 'FIRST_OBSERVED_COMPLETE',
                  });
                else collectionFailures++;
                if (
                  !stored?.firstCompletedAt ||
                  !stored.lastCompletedAt ||
                  stored.completionCount < 1 ||
                  !stored.completedAt ||
                  (s.mode === 'HISTORICAL_DISCOVERY' &&
                    stored.completedAt.toISOString() !== result.at)
                )
                  collectionFailures++;
              } else if (stored?.completedAt) collectionFailures++;
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
            const dates = [
              ...new Set([
                ...e.historical.map((t) => t.at!),
                ...setTimes.map((t) => t.at),
              ]),
            ].sort();
            for (const threshold of [1, 5, 10, 25, 50, 75, 90, 100]) {
              if (score.overall < threshold) continue;
              const at = dates.find(
                (at) =>
                  completion(
                    e.historical.filter((t) => t.at! <= at).length,
                    [...traits.values()].filter((t) => t.at <= at).length,
                    traitCatalog.length,
                    setTimes.filter((t) => t.at <= at).length,
                    collectionSets.filter(
                      (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
                    ).length,
                  ).overall >= threshold,
              );
              if (at)
                expectedMilestones.set(`completion:${threshold}`, {
                  at,
                  basis: 'HISTORICAL_EVIDENCE',
                });
            }
            const collectionMilestones = await tx.collectionMilestone.findMany({
              where: { collectorId: id, ruleset: R, revokedAt: null },
            });
            for (const [key, expected] of expectedMilestones) {
              const m = collectionMilestones.find((m) => m.key === key);
              if (
                !m ||
                m.reachedAt.toISOString() !== expected.at ||
                m.timeBasis !== expected.basis
              )
                collectionFailures++;
            }
            for (const m of collectionMilestones) {
              if (expectedMilestones.has(m.key)) continue;
              const set = collectionSets.find(
                (s) => m.key === `set:${s.key}` && s.mode === 'CURRENT_HOLDING',
              );
              const prior =
                set && sets.find((s) => s.setId === `${R}:${set.key}`);
              if (
                m.timeBasis !== 'FIRST_OBSERVED_COMPLETE' ||
                !prior ||
                prior.firstCompletedAt?.toISOString() !==
                  m.reachedAt.toISOString() ||
                prior.completionCount < 1
              )
                collectionFailures++;
            }
            const traitCounts: Record<
              string,
              { owned: number; discovered: number }
            > = {};
            for (const [list, field] of [
              [e.historical, 'discovered'],
              [e.current, 'owned'],
            ] as const)
              for (const t of list)
                for (const trait of tokenTraits(t)) {
                  traitCounts[trait.key] ??= { owned: 0, discovered: 0 };
                  traitCounts[trait.key][field]++;
                }
            if (
              !snapshot ||
              snapshot.discovered !== e.historical.length ||
              snapshot.traits !== traits.size ||
              snapshot.overall !== score.overall ||
              snapshot.historicalSets !== historical ||
              snapshot.currentSets !== currentCount ||
              hash(snapshot.traitCounts) !== hash(traitCounts) ||
              hash(snapshot.candidates) !==
                hash(candidateMap(e.tokens, e.historical, e.current))
            )
              collectionFailures++;
          }
        })();
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
  return checks;
}
