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
import { verifyAndLinkDripMember } from '../../src/server/charm-link';
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
    const linkDiscord = '699999999999999997';
    const linkMember = 'f'.repeat(24);
    const linkCollector = await db().collector.create({
      data: {
        slug: 'charm-drip-id-link',
        identities: {
          create: {
            provider: 'DISCORD',
            externalId: linkDiscord,
            authenticatedAt: new Date(),
          },
        },
      },
    });
    await db().dripSyncState.update({
      where: { realmId: realm },
      data: { nextRequestAt: new Date(0) },
    });
    let linkRequests = 0;
    globalThis.fetch = async (input, options) => {
      linkRequests++;
      const url = new URL(String(input));
      check(
        options?.method === 'GET' &&
          url.searchParams.get('type') === 'drip-id' &&
          url.searchParams.get('values') === linkMember,
        'user-provided DRIP ID is verified by one exact GET request',
      );
      return new Response(
        JSON.stringify({
          data: [
            {
              id: linkMember,
              realmMemberId: 'private-link-realm-fixture',
              credentials: [
                { oauthProvider: 'discord', oauthAccountId: linkDiscord },
              ],
              balances: [
                { currencyId: currency, balance: '9007199254740993.125' },
              ],
            },
          ],
          meta: { totalPages: 1, credentials: { access: true } },
        }),
      );
    };
    const linkResult = await verifyAndLinkDripMember(
      linkCollector.id,
      linkMember,
    );
    const linkedIdentity = await db().dripIdentity.findUniqueOrThrow({
      where: {
        realmId_collectorId: {
          realmId: realm,
          collectorId: linkCollector.id,
        },
      },
    });
    const linkedBalance = await db().charmBalance.findUniqueOrThrow({
      where: {
        collectorId_realmId_currencyId: {
          collectorId: linkCollector.id,
          realmId: realm,
          currencyId: currency,
        },
      },
    });
    check(
      linkResult.balanceAvailable &&
        linkRequests === 1 &&
        linkedIdentity.status === 'RESOLVED' &&
        linkedIdentity.source === 'EXACT_DRIP_CREDENTIAL' &&
        linkedBalance.status === 'CURRENT' &&
        linkedBalance.balance?.toString() === '9007199254740993.125',
      'exact DRIP ID ownership and decimal balance persist safely in PostgreSQL',
    );
    const mappedMember = 'e'.repeat(24);
    const mappedDiscord = '688888888888888888';
    const mappedWallet = `0x${'1'.repeat(40)}`;
    const mappedCollector = await db().collector.create({
      data: {
        slug: 'charm-wallet-link-map',
        identities: {
          create: { provider: 'DISCORD', externalId: mappedDiscord },
        },
        wallets: {
          create: {
            chainId: 1,
            walletAddress: mappedWallet,
            source: 'AUTHENTICATED_WALLET',
            verifiedAt: new Date(),
          },
        },
      },
    });
    Object.assign(process.env, {
      UGLYBOT_BRIDGE_URL: 'https://bridge.example/',
      UGLYBOT_BRIDGE_SECRET: 'fixture-bridge-secret-'.repeat(2),
    });
    globalThis.fetch = async (input, options) => {
      check(
        options?.method === 'POST' || options?.method === 'GET',
        'mapped lookup uses bridge POST and DRIP GET only',
      );
      const url = new URL(String(input));
      if (url.pathname === '/v1/lookups/dripIdentity')
        return new Response(
          JSON.stringify({
            ok: true,
            data: [
              {
                discord_id: mappedDiscord,
                wallet_address: mappedWallet,
                drip_member_id: mappedMember,
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      check(
        url.searchParams.get('type') === 'drip-id' &&
          url.searchParams.get('values') === mappedMember,
        'DRIP member resolution uses the exact mapped drip_member_id',
      );
      return new Response(
        JSON.stringify({
          data: [
            {
              id: mappedMember,
              balances: [{ currencyId: currency, balance: '88.75' }],
            },
          ],
          meta: { totalPages: 1 },
        }),
      );
    };
    await queueCharmRefresh(mappedCollector.id);
    await db().dripSyncState.update({
      where: { realmId: realm },
      data: { nextRequestAt: new Date(0) },
    });
    const mappedResult = await syncDripDue();
    check(
      mappedResult.status === 'SYNCED' &&
        (await charmBalance(mappedCollector.id, false)).balance === '88.75',
      'wallet_links drip_member_id resolves and stores the exact $CHARM balance',
    );
    check(
      (
        await db().dripIdentity.findUniqueOrThrow({
          where: {
            realmId_collectorId: {
              realmId: realm,
              collectorId: mappedCollector.id,
            },
          },
        })
      ).source === 'VERIFIED_WALLET_LINK',
      'mapped DRIP identity records its verified wallet_links source',
    );

    const deniedDiscord = '688888888888888889';
    const deniedCollector = await db().collector.create({
      data: {
        slug: 'charm-denied-credential-read',
        identities: {
          create: { provider: 'DISCORD', externalId: deniedDiscord },
        },
      },
    });
    globalThis.fetch = async (_input, options) => {
      check(
        options?.method === 'GET',
        'denied credential read remains GET-only',
      );
      return new Response('denied', { status: 403 });
    };
    await queueCharmRefresh(deniedCollector.id);
    await db().dripSyncState.update({
      where: { realmId: realm },
      data: { nextRequestAt: new Date(0) },
    });
    const deniedResult = await syncDripDue();
    check(
      deniedResult.status === 'SYNCED' &&
        (
          await db().dripIdentity.findUniqueOrThrow({
            where: {
              realmId_collectorId: {
                realmId: realm,
                collectorId: deniedCollector.id,
              },
            },
          })
        ).status === 'UNRESOLVED' &&
        (await charmBalance(deniedCollector.id, false)).balance === null,
      'credential-read denial remains unknown and does not block later mapped identities',
    );
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
