import { db } from '../../src/server/db';
import {
  syncDripDue,
  queueCharmRefresh,
  charmBalance,
} from '../../src/server/drip-sync';
import { collectorProfile } from '../../src/server/profiles';
import { charmHistory } from '../../src/server/charm-history';
import { POST as dirty } from '../../src/app/api/internal/charm/dirty/route';
import { dirtySignature } from '../../src/domain/charm-dirty';
import { randomUUID } from 'node:crypto';
import { launchContext } from '../../src/server/launch';
export async function phase12DatabaseTests(
  check: (value: unknown, message: string) => void,
) {
  const realm = 'a'.repeat(24),
    currency = 'b'.repeat(24),
    member = 'c'.repeat(24),
    discord = '677777777777777777';
  const previous = { ...process.env },
    fetcher = globalThis.fetch;
  Object.assign(process.env, {
    DRIP_READ_API_KEY: 'fixture-key-never-public',
    DRIP_REALM_ID: realm,
    DRIP_REALM_POINT_ID: currency,
    CHARM_DIRTY_UGLYBOT_SECRET: 'fixture-hmac-'.repeat(4),
  });
  try {
    const c = await db().collector.create({
      data: {
        slug: 'charm-fixture',
        isPublic: true,
        identities: { create: { provider: 'DISCORD', externalId: discord } },
      },
    });
    check(!c.showCharmBalance, 'CHARM privacy defaults false in database');
    await db().dripSyncState.create({
      data: {
        realmId: realm,
        currencyId: currency,
        month: new Date().toISOString().slice(0, 7),
        alignmentHash: 'fixture-reviewed',
        alignmentCommit: launchContext().commit,
        alignmentAt: new Date(),
      },
    });
    await queueCharmRefresh(c.id, true);
    check(
      !(await queueCharmRefresh(c.id, true)),
      'user refresh has durable two-minute minimum',
    );
    await queueCharmRefresh(c.id);
    await queueCharmRefresh(c.id);
    check(
      (await db().charmRefreshRequest.count({
        where: { collectorId: c.id },
      })) === 1,
      'targeted refreshes coalesce',
    );
    let requests = 0;
    globalThis.fetch = async (_url, options) => {
      requests++;
      check(
        options?.method === 'GET',
        'DRIP network transport only issues GET',
      );
      return new Response(
        JSON.stringify({
          data: [
            {
              id: member,
              credentials: [
                { oauthProvider: 'discord', oauthAccountId: discord },
              ],
              balances: [{ currencyId: currency, balance: '123456789.125' }],
            },
          ],
          meta: { totalPages: 1, credentials: { access: true } },
        }),
        {
          headers: { 'X-RateLimit-Limit': '24', 'X-RateLimit-Remaining': '20' },
        },
      );
    };
    const result = await syncDripDue();
    check(
      result.status === 'SYNCED',
      'targeted DRIP sync uses exact credential correspondence',
    );
    check(
      (await charmBalance(c.id, false)).balance === '123456789.125',
      'authoritative decimal balance persisted exactly',
    );
    check(
      (await db().charmRefreshRequest.count({
        where: { collectorId: c.id, pending: true },
      })) === 0,
      'successful targeted sync clears its generation',
    );
    await syncDripDue();
    check(requests === 1, 'durable request checkpoint prevents restart storm');
    const profile = await collectorProfile(c.slug);
    check(
      profile.status === 'ready' && !('charm' in profile),
      'public profile DTO omits private balance',
    );
    await db().collector.update({
      where: { id: c.id },
      data: { showCharmBalance: true },
    });
    const opted = await collectorProfile(c.slug);
    check(
      opted.status === 'ready' && opted.charm?.balance === '123456789.125',
      'public opt-in exposes safe balance only',
    );
    check(
      !JSON.stringify(opted).includes(member) &&
        !JSON.stringify(opted).includes(realm) &&
        !JSON.stringify(opted).includes(process.env.DRIP_READ_API_KEY!),
      'public DTO excludes infrastructure IDs and key',
    );
    const payload = {
        realmId: realm,
        currencyId: currency,
        dripMemberId: member,
        sourceSystem: 'uglybot',
        operationReference: 'fixture',
        observedAt: new Date().toISOString(),
      },
      nonce = randomUUID(),
      timestamp = String(Math.floor(Date.now() / 1000));
    const request = () =>
      new Request('https://uglydex.example/api/internal/charm/dirty', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-charm-timestamp': timestamp,
          'x-charm-nonce': nonce,
          'x-charm-signature': dirtySignature(
            process.env.CHARM_DIRTY_UGLYBOT_SECRET!,
            timestamp,
            nonce,
            payload,
          ),
        },
        body: JSON.stringify(payload),
      });
    check(
      (await dirty(request())).status === 202,
      'valid HMAC queues a refresh hint',
    );
    check(
      (await dirty(request())).status !== 202,
      'durable nonce rejects replayed callback',
    );
    check(
      (await db().charmRefreshRequest.count({
        where: { collectorId: c.id, pending: true },
      })) === 1,
      'dirty hint coalesces one pending refresh',
    );
    await db().dripSyncState.update({
      where: { realmId: realm },
      data: { nextRequestAt: new Date(0) },
    });
    globalThis.fetch = async () =>
      new Response('redacted upstream failure', {
        status: 429,
        headers: { 'Retry-After': '120', 'X-RateLimit-Remaining': '0' },
      });
    await syncDripDue();
    const rate = await db().dripSyncState.findUniqueOrThrow({
      where: { realmId: realm },
    });
    check(
      rate.total429 === 1 && +rate.nextRequestAt > Date.now() + 110000,
      '429 Retry-After persists across sync error handling',
    );
    check(
      (await charmBalance(c.id, false)).balance === '123456789.125',
      'DRIP outage preserves last known balance',
    );
    await db().dripSyncState.update({
      where: { realmId: realm },
      data: { nextRequestAt: new Date(0), monthRequests: 30000 },
    });
    globalThis.fetch = async () => {
      throw Error('BUDGET_MUST_PREVENT_NETWORK');
    };
    check(
      (await syncDripDue()).status === 'DRIP_BUDGET_WAIT',
      'monthly soft ceiling prevents all network requests',
    );
    const event = (
      sourceType: string,
      direction: string | null,
      amount: string | null,
      metadata: object = {},
    ) =>
      db().collectorActivity.create({
        data: {
          collectorId: c.id,
          eventKey: randomUUID(),
          sourceSystem: 'uglybot',
          sourceType,
          sourceId: randomUUID(),
          subjectKey: 'fixture',
          eventType: 'CHARM_FIXTURE',
          eventAt: new Date(),
          metadata,
          payloadHash: 'fixture',
          amount,
          currency: amount ? 'CHARM' : null,
          direction,
        },
      });
    await event('marketplace', 'SPEND', '5.25');
    await event('maw', 'PAYOUT', '7.5');
    await event('claimEvents', null, null, { amountRecorded: '9999' });
    await event('submissions', null, null, { rewardPoints: '8888' });
    const history = await charmHistory(c.id);
    check(
      history.totals.find((t) => t.direction === 'SPEND')?.amount ===
        '5.25000000' &&
        history.totals.find((t) => t.direction === 'PAYOUT')?.amount ===
          '7.50000000',
      'tracked settled totals remain exact',
    );
    check(
      history.entries.filter((e) => e.direction === 'OBSERVATION').length ===
        1 && history.entries.length === 3,
      'claims observation separated; reward metadata excluded',
    );
    check(
      (await charmBalance(c.id, false)).balance === '123456789.125',
      'history never reconstructs current balance',
    );
    const sharedMember = 'd'.repeat(24);
    const owner = await db().collector.create({
      data: {
        slug: 'charm-existing-member',
        isPublic: true,
        showCharmBalance: true,
      },
    });
    const target = await db().collector.create({
      data: {
        slug: 'charm-conflicting-member',
        identities: {
          create: { provider: 'DISCORD', externalId: '699999999999999999' },
        },
      },
    });
    const existing = await db().dripIdentity.create({
      data: {
        collectorId: owner.id,
        realmId: realm,
        dripMemberId: sharedMember,
        status: 'RESOLVED',
      },
    });
    await db().charmBalance.create({
      data: {
        collectorId: owner.id,
        realmId: realm,
        currencyId: currency,
        dripIdentityId: existing.id,
        balance: '42.5',
        observedAt: new Date(),
        lastApiSuccessAt: new Date(),
        status: 'CURRENT',
      },
    });
    await db().charmRefreshRequest.updateMany({ data: { pending: false } });
    await db().dripSyncState.update({
      where: { realmId: realm },
      data: { monthRequests: 0, nextRequestAt: new Date(0) },
    });
    await queueCharmRefresh(target.id);
    globalThis.fetch = async (_url, options) => {
      check(
        options?.method === 'GET',
        'conflict resolution still uses GET only',
      );
      return new Response(
        JSON.stringify({
          data: [
            {
              id: sharedMember,
              credentials: [
                {
                  oauthProvider: 'discord',
                  oauthAccountId: '699999999999999999',
                },
              ],
              balances: [{ currencyId: currency, balance: '42.5' }],
            },
          ],
          meta: { totalPages: 1, credentials: { access: true } },
        }),
      );
    };
    const conflicting = await syncDripDue();
    check(
      conflicting.status === 'SYNCED',
      'duplicate member correspondence handled without crashing the sync',
    );
    check(
      (await db().dripIdentity.count({
        where: {
          realmId: realm,
          status: 'CONFLICT',
          collectorId: { in: [owner.id, target.id] },
        },
      })) === 2,
      'duplicate mapping marks both Collectors conflicted',
    );
    check(
      (await db().dripIdentity.count({
        where: { realmId: realm, dripMemberId: sharedMember },
      })) === 1,
      'exact member cannot be persisted for two Collectors',
    );
    const conflictedProfile = await collectorProfile(owner.slug);
    check(
      conflictedProfile.status === 'ready' && !('charm' in conflictedProfile),
      'a newly conflicted mapping revokes a previously public opt-in balance',
    );
  } finally {
    globalThis.fetch = fetcher;
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
}
