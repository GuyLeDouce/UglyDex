import { adminCharmDiagnostics } from '../../src/server/admin-charm';
import { db } from '../../src/server/db';
import { adminProfileHealth } from '../../src/server/admin-health';
import { queueCharmRefresh } from '../../src/server/drip-sync';

export async function adminHealthTests(
  check: (v: unknown, message: string) => void,
) {
  const realmId = process.env.DRIP_REALM_ID!;
  const previousKey = process.env.DRIP_READ_API_KEY;
  const previousCurrency = process.env.DRIP_REALM_POINT_ID;
  process.env.DRIP_READ_API_KEY = 'fixture-no-upstream-requests';
  process.env.DRIP_REALM_POINT_ID = 'b'.repeat(24);
  const now = new Date();
  const old = new Date(+now - 7 * 86400000);
  try {
    const c = await db().collector.create({
      data: {
        slug: 'superseded-health-fixture',
        claimedAt: old,
        onboardingCompletedAt: now,
        discordTrackingConsent: true,
        identities: {
          create: {
            provider: 'DISCORD',
            externalId: '777777777777777777',
            authenticatedAt: now,
          },
        },
        dripIdentities: {
          create: {
            realmId,
            dripMemberId: 'f'.repeat(24),
            status: 'RESOLVED',
            lastResolvedAt: now,
          },
        },
      },
      include: { dripIdentities: true },
    });
    const where = { realmId_collectorId: { realmId, collectorId: c.id } };
    await db().charmRefreshRequest.create({
      data: {
        realmId,
        collectorId: c.id,
        requestedAt: old,
        nextUserRequestAt: new Date(+old + 120000),
      },
    });
    await db().charmBalance.create({
      data: {
        collectorId: c.id,
        realmId,
        currencyId: 'b'.repeat(24),
        dripIdentityId: c.dripIdentities[0].id,
        balance: '0',
        status: 'CURRENT',
        observedAt: now,
        lastApiSuccessAt: now,
      },
    });
    const review = await db().identityReconciliation.create({
      data: {
        dedupeKey: 'health-superseded-proof',
        reason: 'DISCORD_PROOF_REQUIRED',
        evidence: { collectorId: c.id, discordIds: ['777777777777777777'] },
      },
    });
    const details = async () => (await adminProfileHealth()).get(c.id)!.details;
    check(
      !(await details()).some(
        (s) =>
          s.includes('$CHARM refresh') || s.includes('DISCORD_PROOF_REQUIRED'),
      ),
      'newer balance and matching OAuth proof suppress obsolete alerts',
    );
    await db().identityReconciliation.update({
      where: { id: review.id },
      data: {
        evidence: { collectorId: c.id, discordIds: ['888888888888888888'] },
      },
    });
    check(
      (await details()).some((s) => s.includes('DISCORD_PROOF_REQUIRED')),
      'unmatched Discord evidence remains actionable',
    );
    await db().identityReconciliation.update({
      where: { id: review.id },
      data: {
        reason: 'COLLECTOR_CONFLICT',
        evidence: { collectorId: c.id, discordIds: ['777777777777777777'] },
      },
    });
    check(
      (await details()).some((s) => s.includes('COLLECTOR_CONFLICT')),
      'current OAuth proof never hides a different identity conflict',
    );
    await db().charmRefreshRequest.update({ where, data: { pending: false } });
    await queueCharmRefresh(c.id);
    const queued = await db().charmRefreshRequest.findUniqueOrThrow({ where });
    check(queued.requestedAt >= now, 'requeued refresh gets a new start time');
    check(
      (await details()).some(
        (s) =>
          s.includes('$CHARM refresh') && !s.includes('more than one hour'),
      ),
      'new pending refresh is not aged from original row creation',
    );
    await queueCharmRefresh(c.id);
    const coalesced = await db().charmRefreshRequest.findUniqueOrThrow({
      where,
    });
    check(
      +coalesced.requestedAt === +queued.requestedAt,
      'coalescing pending refreshes preserves their waiting time',
    );
    await db().charmRefreshRequest.update({
      where,
      data: { requestedAt: old, nextUserRequestAt: new Date(+old + 120000) },
    });
    await db().charmBalance.updateMany({
      where: { collectorId: c.id },
      data: {
        observedAt: new Date(+old - 1000),
        lastApiSuccessAt: new Date(+old - 1000),
      },
    });
    check(
      (await details()).some(
        (s) => s.includes('$CHARM refresh') && s.includes('more than one hour'),
      ),
      'unfulfilled old request still reports an issue',
    );
    const before = await db().charmRefreshRequest.findUniqueOrThrow({ where });
    const diagnostics = await adminCharmDiagnostics([c.id]);
    const diagnostic = diagnostics.get(c.id);
    check(
      diagnostic?.savedBalance === '0',
      'admin diagnostics preserve a real zero balance',
    );
    check(
      diagnostic?.stale === true,
      'admin diagnostics identify stale cached balances',
    );
    check(
      diagnostic?.lastApiSuccessAt === new Date(+old - 1000).toISOString(),
      'admin diagnostics expose the profile successful-read timestamp',
    );
    check(
      diagnostics.size === 1,
      'admin diagnostics return only the requested profiles',
    );
    const after = await db().charmRefreshRequest.findUniqueOrThrow({ where });
    check(
      JSON.stringify(before) === JSON.stringify(after),
      'viewing diagnostics does not enqueue or mutate refresh requests',
    );
  } finally {
    if (previousKey === undefined) delete process.env.DRIP_READ_API_KEY;
    else process.env.DRIP_READ_API_KEY = previousKey;
    if (previousCurrency === undefined) delete process.env.DRIP_REALM_POINT_ID;
    else process.env.DRIP_REALM_POINT_ID = previousCurrency;
  }
}
