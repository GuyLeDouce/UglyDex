import 'server-only';
import { db } from './db';
import { productionEvidenceReport } from './production-report';
// Candidate pairs are review leads, never an automatic merge based on amount/time/name.
export async function evidenceAudit() {
  const [report, sources, attribution, decisions, pilots, candidates, missing] =
    await Promise.all([
      productionEvidenceReport(),
      db().integrationSource.findMany({
        select: {
          id: true,
          state: true,
          firstAvailableAt: true,
          lastAvailableAt: true,
          importedThrough: true,
          backfillFinishedAt: true,
          warning: true,
          schemaFingerprint: true,
        },
      }),
      db().collectorActivity.groupBy({
        by: ['attributionStatus'],
        _count: true,
      }),
      db().reconciliationDecision.groupBy({ by: ['action'], _count: true }),
      db().operationalAudit.findMany({
        where: { action: 'PILOT_IMPORT' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, subject: true, createdAt: true, detail: true },
      }),
      db().$queryRaw<
        { category: string; n: bigint }[]
      >`SELECT a.category,count(*) AS n FROM "CollectorActivity" a JOIN "CollectorActivity" b ON a.id<b.id AND a."sourceType"<>b."sourceType" AND a."collectorId"=b."collectorId" AND a.currency=b.currency AND a.amount=b.amount AND a.direction=b.direction AND a."eventAt"=b."eventAt" WHERE a.amount IS NOT NULL AND a."recordStatus"='ACTIVE' AND b."recordStatus"='ACTIVE' GROUP BY a.category`,
      db().squig.count({ where: { provenance: null } }),
    ]);
  const safePilots = pilots.map((p) => {
    const detail = p.detail as Record<string, unknown>;
    const counts = Object.fromEntries(
      [
        'scanned',
        'eligible',
        'normalized',
        'inserted',
        'updated',
        'skipped',
        'duplicates',
        'ignoredRows',
        'unresolved',
        'failed',
        'collectorLinked',
        'squigLinked',
      ].map((k) => [k, typeof detail[k] === 'number' ? detail[k] : null]),
    );
    return { run: p.id, feed: p.subject, at: p.createdAt, counts };
  });
  return {
    ...report,
    missingProvenance: missing,
    sources,
    attribution,
    decisions,
    pilots: safePilots,
    duplicateCandidates: candidates.map((c) => ({
      category: c.category,
      count: Number(c.n),
    })),
    duplicatePolicy:
      'Candidates require source-reference review. Canonical sourceSystem/type/id/subject/event keys retain replay identity. Equal amount/time alone does not prove duplication.',
  };
}
export async function explainActivity(id: string) {
  const a = await db().collectorActivity.findUniqueOrThrow({
    where: { id },
    select: {
      collectorId: true,
      discordId: true,
      walletAddress: true,
      eventAt: true,
      attributionStatus: true,
    },
  });
  const identity = a.discordId
    ? await db().externalIdentity.findUnique({
        where: {
          provider_externalId: { provider: 'DISCORD', externalId: a.discordId },
        },
        select: { collectorId: true },
      })
    : null;
  const evidence = a.walletAddress
    ? await db().historicalIdentityAttribution.findMany({
        where: {
          walletAddress: a.walletAddress,
          effectiveFrom: { lte: a.eventAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: a.eventAt } }],
          status: { notIn: ['REJECTED', 'INVALIDATED'] },
        },
        select: {
          collectorId: true,
          status: true,
          confidence: true,
          source: true,
          reviewedAt: true,
        },
      })
    : [];
  return {
    status: a.attributionStatus,
    discordIdentityMatches:
      !!identity && identity.collectorId === a.collectorId,
    matchingWalletEvidence: evidence.filter(
      (e) => e.collectorId === a.collectorId,
    ).length,
    conflictingCollectors: new Set(evidence.map((e) => e.collectorId)).size > 1,
    reviewedEvidence: evidence.filter((e) => e.reviewedAt).length,
    policy:
      'Discord exact identity, otherwise effective-time wallet evidence. No username matching. Admin-only aggregate explanation.',
  };
}
