import 'server-only';
import { db } from './db';
import { readEnv } from './env';
import {
  jobHealth,
  profileHealth,
  type HealthSignal,
} from '@/domain/admin-health';
/** A single batched snapshot, also used before filtering/pagination. No upstream calls. */
export async function adminProfileHealth() {
  const realmId = readEnv().DRIP_REALM_ID;
  const now = new Date();
  const [collectors, collections, progression, refresh, charm, reviews] =
    await Promise.all([
      db().collector.findMany({
        where: { mergedIntoCollectorId: null },
        select: {
          id: true,
          claimedAt: true,
          onboardingCompletedAt: true,
          discordTrackingConsent: true,
          identities: { select: { authenticatedAt: true, externalId: true } },
          dripIdentities: {
            where: { realmId: realmId ?? '__unconfigured__' },
            select: { status: true, dripMemberId: true },
          },
          refreshRequest: true,
        },
      }),
      db().collectionJob.findMany(),
      db().progressionJob.findMany({ where: { subjectType: 'COLLECTOR' } }),
      db().ownershipRefresh.findUnique({ where: { id: 'squigs' } }),
      db().charmRefreshRequest.findMany({
        where: { pending: true, realmId: realmId ?? '__unconfigured__' },
      }),
      db().identityReconciliation.findMany({
        where: { status: 'PENDING' },
        select: { reason: true, evidence: true, createdAt: true },
      }),
    ]);
  const signals = new Map<string, HealthSignal[]>(
    collectors.map((c) => [c.id, []]),
  );
  const add = (id: string, signal: HealthSignal) =>
    signals.get(id)?.push(signal);
  for (const j of collections)
    add(j.collectorId, jobHealth('Sets and collection', j, now));
  for (const j of progression)
    add(j.subjectId, jobHealth('Achievements and progression', j, now));
  for (const j of charm)
    add(
      j.collectorId,
      jobHealth(
        '$CHARM refresh',
        { queuedAt: j.requestedAt, attempts: 0, errorCode: null },
        now,
      ),
    );
  for (const c of collectors) {
    if (c.claimedAt && !c.onboardingCompletedAt)
      add(c.id, {
        message:
          'Profile setup is incomplete; waiting for the collector to finish the walkthrough.',
      });
    if (c.discordTrackingConsent !== false) {
      if (c.identities.some((i) => !i.authenticatedAt))
        add(c.id, {
          message:
            'Discord identity is linked but still needs the collector to authenticate it.',
        });
      for (const d of c.dripIdentities) {
        if (d.status === 'CONFLICT')
          add(c.id, {
            error: true,
            message: 'DRIP identity conflict: the saved mapping needs review.',
          });
        else if (d.status !== 'RESOLVED' || !d.dripMemberId)
          add(c.id, {
            error: c.onboardingCompletedAt !== null,
            message: `DRIP identity is ${d.status.toLowerCase()}; identity verification is required before the balance can be trusted.`,
          });
      }
      if (
        realmId &&
        c.onboardingCompletedAt &&
        c.discordTrackingConsent === true &&
        !c.dripIdentities.length
      )
        add(c.id, {
          error: true,
          message:
            'Discord tracking is enabled but no DRIP identity is linked.',
        });
    }
    // A global scan is relevant only to collectors who requested this scan.
    if (
      refresh &&
      c.refreshRequest &&
      +c.refreshRequest.requestedAt >= +refresh.requestedAt - 30000 &&
      (!refresh.completedAt ||
        c.refreshRequest.requestedAt > refresh.completedAt)
    ) {
      if (refresh.status === 'FAILED')
        add(c.id, {
          error: true,
          message: `Requested wallet ownership refresh failed (${refresh.errorCode ?? 'unknown error'}). Last update ${refresh.updatedAt.toISOString()}.`,
        });
      else if (['QUEUED', 'SYNCING'].includes(refresh.status))
        add(
          c.id,
          jobHealth(
            'Requested wallet ownership refresh',
            {
              queuedAt: c.refreshRequest.requestedAt,
              attempts: 0,
              errorCode: refresh.errorCode,
            },
            now,
          ),
        );
    }
  }
  // Match explicit collector references only; never label every profile for a global incident.
  for (const review of reviews) {
    const evidence = review.evidence;
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
      continue;
    const ids = new Set(
      Object.entries(evidence)
        .filter(
          ([key, value]) =>
            /collectorId$/i.test(key) && typeof value === 'string',
        )
        .map(([, value]) => value as string),
    );
    for (const id of ids)
      add(id, {
        error: true,
        message: `Pending identity review: ${review.reason}. Opened ${review.createdAt.toISOString()}.`,
      });
  }
  return new Map([...signals].map(([id, items]) => [id, profileHealth(items)]));
}
