import { db } from '../../src/server/db';
import { hash } from '../../src/domain/events';
import { launchContext } from '../../src/server/launch';
import { syncDripDue } from '../../src/server/drip-sync';
export async function dripRevalidationTests(
  check: (v: unknown, message: string) => void,
) {
  const previous = { ...process.env },
    fetcher = globalThis.fetch;
  const realm = '1'.repeat(24),
    currency = '2'.repeat(24);
  Object.assign(process.env, {
    DRIP_REALM_ID: realm,
    DRIP_REALM_POINT_ID: currency,
    DRIP_READ_API_KEY: 'fixture-no-real-network',
  });
  const evidence = {
    uglyBotRealm: true,
    uglyBotCurrency: true,
    gauntletRealm: true,
    gauntletCurrency: true,
    realmHash: hash(realm),
    currencyHash: hash(currency),
    currencyActive: true,
    readOnly: true,
  };
  let reads = 0;
  try {
    await db().dripSyncState.create({
      data: {
        realmId: realm,
        currencyId: currency,
        month: new Date().toISOString().slice(0, 7),
        alignmentCommit: 'old-release',
        alignment: evidence,
        alignmentHash: hash(evidence),
      },
    });
    globalThis.fetch = async (url, options) => {
      reads++;
      check(
        !options?.method || options.method === 'GET',
        'automatic revalidation performs GET requests only',
      );
      return new Response(
        JSON.stringify(
          String(url).includes('currencies')
            ? { data: [{ id: currency, realmId: realm, archived: false }] }
            : { id: realm },
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const result = await syncDripDue();
    check(
      result.status === 'ALIGNMENT_REVALIDATED' && reads === 2,
      'a new deployment obtains fresh live Realm and currency proof',
    );
    const state = await db().dripSyncState.findUniqueOrThrow({
      where: { realmId: realm },
    });
    check(
      state.alignmentCommit === launchContext().commit && !!state.alignmentAt,
      'fresh proof is bound to current deployment',
    );
    check(
      state.errorCode === null,
      'successful revalidation clears prior sync error',
    );
    await db().dripSyncState.update({
      where: { realmId: realm },
      data: { alignmentCommit: 'another-release', nextRequestAt: new Date(0) },
    });
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: 'wrong-realm' }), { status: 200 });
    check(
      (await syncDripDue()).status === 'CHARM_ECONOMY_MISMATCH',
      'live mismatch prevents synchronization',
    );
    const invalid = await db().dripSyncState.findUniqueOrThrow({
      where: { realmId: realm },
    });
    check(
      invalid.alignmentHash === null &&
        invalid.errorCode === 'CHARM_ECONOMY_MISMATCH',
      'mismatched live proof is revoked',
    );
  } finally {
    globalThis.fetch = fetcher;
    await db().dripSyncState.deleteMany({ where: { realmId: realm } });
    for (const key of [
      'DRIP_REALM_ID',
      'DRIP_REALM_POINT_ID',
      'DRIP_READ_API_KEY',
    ]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
