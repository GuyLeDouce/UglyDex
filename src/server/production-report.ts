import 'server-only';
import { db } from './db';
export async function productionEvidenceReport() {
  const [
    catalog,
    mints,
    continuous,
    ownerMatched,
    anomalies,
    discord,
    wallets,
    collectors,
    conflicts,
    unattributed,
    xp,
    unlocks,
    revoked,
    gated,
    discoveries,
    traits,
    sets,
    snapshots,
    sources,
    duplicates,
  ] = await Promise.all([
    db().squig.count(),
    db().squigProvenance.count({ where: { mintAt: { not: null } } }),
    db().squigProvenance.count({ where: { complete: true, dirty: false } }),
    db().squigProvenance.count({ where: { ownerMatches: true, dirty: false } }),
    db().squigProvenance.findMany({
      where: {
        OR: [{ complete: false }, { dirty: true }, { ownerMatches: false }],
      },
      select: {
        squig: { select: { tokenId: true } },
        issues: true,
        dirty: true,
        ownerMatches: true,
      },
      orderBy: { squig: { tokenId: 'asc' } },
    }),
    db().externalIdentity.count({ where: { provider: 'DISCORD' } }),
    db().collectorWallet.count(),
    db().collector.count(),
    db().identityReconciliation.count({ where: { status: 'PENDING' } }),
    db().collectorActivity.count({ where: { collectorId: null } }),
    db().xpLedgerEntry.count({ where: { revokedAt: null } }),
    db().collectorAchievement.count({
      where: { revokedAt: null, awardedAt: { not: null } },
    }),
    db().xpLedgerEntry.count({ where: { revokedAt: { not: null } } }),
    db().collectorAchievement.count({ where: { gateSatisfied: false } }),
    db().squigDiscovery.count(),
    db().collectorTraitDiscovery.count(),
    db().collectorSetProgress.groupBy({
      by: ['currentlyComplete'],
      _count: true,
    }),
    db().collectionSnapshot.count(),
    db().integrationSource.findMany({
      select: {
        id: true,
        state: true,
        schemaValid: true,
        backfillFinishedAt: true,
        lastSuccessAt: true,
        warning: true,
      },
    }),
    db().$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM (SELECT "eventKey" FROM "CollectorActivity" GROUP BY "eventKey" HAVING count(*)>1) q`,
  ]);
  const [distribution, setModes, collectorEvaluations, squigEvaluations] =
    await Promise.all([
      db().$queryRaw<
        { bucket: number; n: bigint }[]
      >`SELECT floor(overall/10)::int*10 AS bucket,count(*) AS n FROM "CollectionSnapshot" GROUP BY 1 ORDER BY 1`,
      db().$queryRaw<
        { mode: string; n: bigint }[]
      >`SELECT s.mode,count(*) AS n FROM "CollectorSetProgress" p JOIN "CollectionSetDefinition" s ON s.id=p."setId" WHERE p."currentlyComplete" GROUP BY s.mode`,
      db().collectorProgress.count(),
      db().squigProgress.count(),
    ]);
  return {
    at: new Date().toISOString(),
    provenance: {
      catalog,
      mints,
      continuous,
      ownerMatched,
      anomalousTokens: anomalies.map((a) => ({
        tokenId: a.squig.tokenId,
        issues: a.issues,
        dirty: a.dirty,
        ownerMatches: a.ownerMatches,
      })),
    },
    identity: { discord, wallets, collectors, conflicts, unattributed },
    progression: {
      collectorEvaluations,
      squigEvaluations,
      activeXpGrants: xp,
      collectorUnlocks: unlocks,
      revokedGrants: revoked,
      completenessGated: gated,
    },
    collections: {
      discoveries,
      traits,
      sets,
      snapshots,
      completionDistribution: distribution.map((r) => ({
        bucket: r.bucket,
        count: Number(r.n),
      })),
      completedByMode: setModes.map((r) => ({
        mode: r.mode,
        count: Number(r.n),
      })),
    },
    sources,
    duplicateCanonicalEvents: Number(duplicates[0].n),
    limitation:
      'Tracked/indexed evidence only; owner matches refer to stored verification block. Unresolved attribution is excluded from Collector progression grants.',
  };
}
