import 'server-only';
import { db } from './db';
import { hash } from '@/domain/events';
import {
  COLLECTION_RULESET,
  FIELD_GUIDE_MASTERY,
  completion,
} from '@/domain/dex';
import { collectionSets, traitCatalog } from '@/domain/dex-catalog';

/** Score-only migration: preserve evidence, snapshots' evaluation dates, awards,
 * and queued corrections. Row locks serialize with concurrent worker updates.
 * A crash rolls back the current batch; policy tags make retries idempotent.
 */
export async function migrateMasteryScores() {
  const policy = FIELD_GUIDE_MASTERY;
  await db().collectionRuleset.upsert({
    where: { id: policy.version },
    create: {
      id: policy.version,
      fingerprint: hash(policy),
      configuration: policy,
    },
    update: {},
  });
  const historicalTotal = collectionSets.filter(
    (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
  ).length;
  let updated = 0;
  for (;;) {
    const count = await db().$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          {
            collectorId: string;
            discovered: number;
            traits: number;
            historicalSets: number;
            currentTokenIds: number[];
          }[]
        >`SELECT "collectorId", discovered, traits, "historicalSets", "currentTokenIds"
        FROM "CollectionSnapshot" WHERE ruleset=${COLLECTION_RULESET}
        AND "scoringPolicy"<>${policy.version}
        ORDER BY "collectorId" LIMIT 100 FOR UPDATE`;
        for (const row of rows) {
          const score = completion(
            row.discovered,
            row.traits,
            traitCatalog.length,
            row.historicalSets,
            historicalTotal,
            new Set(row.currentTokenIds).size,
          );
          await tx.collectionSnapshot.update({
            where: {
              ruleset_collectorId: {
                ruleset: COLLECTION_RULESET,
                collectorId: row.collectorId,
              },
            },
            data: { overall: score.overall, scoringPolicy: policy.version },
          });
        }
        return rows.length;
      },
      { timeout: 30000 },
    );
    updated += count;
    if (count < 100) break;
  }
  return { policy: policy.version, updated };
}
