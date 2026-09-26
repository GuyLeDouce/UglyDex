import 'server-only';
import { z } from 'zod';
import { db } from './db';
import { markWalletDirty } from '@/sync/provenance';
export const decisionSchema = z.object({
  caseId: z.string().uuid(),
  action: z.enum(['CONFIRM', 'REJECT', 'SPLIT', 'UNRESOLVED']),
  attributionId: z.string().uuid(),
  reason: z.string().trim().min(10).max(2000),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
  secondCollectorId: z.string().uuid().optional(),
});
export async function decideAttribution(actor: string, input: unknown) {
  const d = decisionSchema.parse(input);
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('attribution-review',0))`;
    const review = await tx.identityReconciliation.findUniqueOrThrow({
      where: { id: d.caseId },
    });
    const a = await tx.historicalIdentityAttribution.findUniqueOrThrow({
      where: { id: d.attributionId },
    });
    const e = review.evidence as Record<string, unknown>;
    if (e.attributionId !== a.id && e.wallet !== a.walletAddress)
      throw new Error('CASE_EVIDENCE_MISMATCH');
    const from = d.effectiveFrom ?? a.effectiveFrom,
      to = d.effectiveTo ?? a.effectiveTo;
    if (to && to <= from) throw new Error('INVALID_INTERVAL');
    if (
      d.action === 'SPLIT' &&
      (!to || !d.secondCollectorId || (a.effectiveTo && to >= a.effectiveTo))
    )
      throw new Error('SPLIT_REQUIRES_BOUNDARY_AND_COLLECTOR');
    const data =
      d.action === 'UNRESOLVED'
        ? { status: 'UNCONFIRMED', reviewedAt: new Date() }
        : {
            status: d.action === 'REJECT' ? 'REJECTED' : 'REVIEWED',
            confidence: 'ADMIN_REVIEWED',
            effectiveFrom: from,
            effectiveTo: to,
            reviewedAt: new Date(),
          };
    await tx.historicalIdentityAttribution.update({
      where: { id: a.id },
      data,
    });
    if (d.action === 'SPLIT')
      await tx.historicalIdentityAttribution.create({
        data: {
          sourceKey: `decision:${review.id}:${crypto.randomUUID()}`,
          collectorId: d.secondCollectorId!,
          chainId: 1,
          walletAddress: a.walletAddress,
          source: 'ADMIN_SPLIT',
          status: 'REVIEWED',
          confidence: 'ADMIN_REVIEWED',
          effectiveFrom: to!,
          effectiveTo: a.effectiveTo,
          reviewedAt: new Date(),
          evidence: { previousAttributionId: a.id, caseId: review.id },
        },
      });
    await tx.reconciliationDecision.create({
      data: {
        caseId: review.id,
        actor,
        action: d.action,
        reason: d.reason,
        before: {
          ...a,
          effectiveFrom: a.effectiveFrom.toISOString(),
          effectiveTo: a.effectiveTo?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          reviewedAt: a.reviewedAt?.toISOString() ?? null,
        },
        after: {
          ...data,
          effectiveFrom: from.toISOString(),
          effectiveTo: to?.toISOString() ?? null,
          reviewedAt: data.reviewedAt?.toISOString() ?? null,
          secondCollectorId: d.secondCollectorId ?? null,
        },
      },
    });
    await tx.identityReconciliation.update({
      where: { id: review.id },
      data: {
        status:
          d.action === 'UNRESOLVED'
            ? 'PENDING'
            : d.action === 'REJECT'
              ? 'REJECTED'
              : 'RESOLVED',
        resolvedAt: d.action === 'UNRESOLVED' ? null : new Date(),
        resolution: { action: d.action, attributionId: a.id },
      },
    });
    await markWalletDirty(tx, a.walletAddress);
    return { status: 'RECORDED', rebuild: 'QUEUED' };
  });
}
