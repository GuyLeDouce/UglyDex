import assert from 'node:assert/strict';
import { db } from '../../src/server/db';
import { observe } from '../../src/sync/blockchain';
import {
  collectionPage,
  collectionSummary,
} from '../../src/server/collections';
import { manageWallet, saveProfile } from '../../src/server/settings';
import { reconcileCurrentDiscoveries } from '../../src/server/discoveries';
import { requestRefresh } from '../../src/server/refresh';
import { ownershipWorkerBatch } from '../../src/sync/ownership-worker';
import {
  validateContract,
  getOwnershipBatch,
} from '../../src/integrations/blockchain';
import { collectorProfile } from '../../src/server/profiles';
export async function phase1DatabaseTests(
  check: (value: unknown, message: string) => void,
) {
  const c = await db().collector.create({ data: { slug: 'phase1-alice' } }),
    other = await db().collector.create({ data: { slug: 'phase1-bob' } });
  const a = '0x' + 'a'.repeat(40),
    b = '0x' + 'b'.repeat(40),
    out = '0x' + 'c'.repeat(40);
  const w1 = await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      chainId: 1,
      walletAddress: a,
      source: 'SIWE',
      verifiedAt: new Date('2025-01-01'),
      isPrimary: true,
    },
  });
  const w2 = await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      chainId: 1,
      walletAddress: b,
      source: 'SIWE',
      verifiedAt: new Date('2025-01-01'),
    },
  });
  const event = (
    tokenId: number,
    wallet: string,
    block: bigint,
    from?: string,
  ) => ({
    tokenId,
    wallet,
    from,
    block,
    blockHash: '0x' + block.toString(16).padStart(64, '0'),
    time: new Date(Number(block) * 1000 + Date.parse('2026-01-01')),
    key: `fixture:${tokenId}:${block}`,
    source: 'transfer',
    txHash: '0x' + 'd'.repeat(64),
    logIndex: 0,
  });
  const apply = (e: ReturnType<typeof event>) =>
    db().$transaction((tx) => observe(tx, e));
  check((await apply(event(800, a, 1n))) === 'inserted', 'ownership insert');
  check(
    (await apply(event(800, a, 1n))) === 'skipped',
    'ownership replay idempotent',
  );
  await apply(event(801, b, 1n));
  check(
    (await collectionSummary(c.id)).owned === 2,
    'aggregates two active wallets without duplicates',
  );
  await apply(event(800, b, 2n, a));
  await apply({ ...event(801, b, 5n), source: 'ownerOf' });
  check(
    (await collectionPage({ sort: 'recent' }, c.id)).items[0].tokenId === 800,
    'recent sort uses acquisition rather than snapshot observation time',
  );
  check(
    (await collectionSummary(c.id)).owned === 2,
    'same-collector transfer keeps total',
  );
  check(
    (await db().squigDiscovery.count({ where: { collectorId: c.id } })) === 2,
    'same-collector transfer keeps unique discovery',
  );
  await apply(event(800, out, 3n, b));
  check(
    (await collectionSummary(c.id)).owned === 1,
    'transfer out removes current collection',
  );
  const discoveryPage = await collectionPage({}, c.id, true);
  check(
    discoveryPage.items.find((s) => s.tokenId === 800)?.currentlyOwned ===
      false,
    'discovered view distinguishes previously owned',
  );
  check(
    discoveryPage.items.find((s) => s.tokenId === 801)?.currentlyOwned === true,
    'discovered view identifies currently owned',
  );
  check(
    (await collectionSummary(c.id)).discovered === 2,
    'discovery persists after sale',
  );
  await apply(event(800, a, 0n));
  check(
    (await collectionSummary(c.id)).owned === 1,
    'old historical backfill cannot rewind current owner',
  );
  const d = await db().squigDiscovery.findFirstOrThrow({
    where: { collectorId: c.id, squig: { tokenId: 800 } },
  });
  check(
    d.discoveredAt.getTime() === Date.parse('2026-01-01'),
    'earliest proved discovery is retained on out-of-order imports',
  );
  await apply(event(802, out, 4n));
  await db().collectorWallet.create({
    data: {
      collectorId: other.id,
      chainId: 1,
      walletAddress: out,
      source: 'SIWE',
      verifiedAt: new Date(),
    },
  });
  await reconcileCurrentDiscoveries(other.id);
  check(
    (await collectionSummary(other.id)).discovered === 0,
    'new wallet does not claim discoveries from stale pre-signature observations',
  );
  const base = {
    slug: 'Phase1-Alice',
    displayName: 'Alice',
    bio: 'Real collection',
    avatar: '',
    isPublic: true,
    showWallets: false,
    showDiscord: false,
    featuredTokenIds: [801],
  };
  await saveProfile(c.id, base);
  const publicProfile = await collectorProfile('PHASE1-ALICE');
  check(
    publicProfile.status === 'ready' &&
      !JSON.stringify(publicProfile).includes(a) &&
      !JSON.stringify(publicProfile).includes(b),
    'public DTO and summary exclude hidden wallet addresses',
  );
  check(
    publicProfile.status === 'ready' && publicProfile.featured.length === 1,
    'featured selection uses owned tokens',
  );
  await assert.rejects(() =>
    saveProfile(c.id, { ...base, featuredTokenIds: [800] }),
  );
  check(true, 'cannot feature a sold Squig');
  await assert.rejects(() =>
    saveProfile(other.id, { ...base, featuredTokenIds: [] }),
  );
  check(true, 'case-insensitive slug collision rejected');
  await assert.rejects(() =>
    db().collector.create({ data: { slug: 'PHASE1-ALICE' } }),
  );
  check(true, 'database enforces slug case uniqueness');
  await saveProfile(c.id, { ...base, slug: 'renamed-alice' });
  check(
    (await collectionSummary(c.id)).discovered === 2,
    'slug change retains UUID history',
  );
  await saveProfile(c.id, { ...base, slug: 'renamed-alice', isPublic: false });
  check(
    (await collectorProfile('renamed-alice')).status === 'missing',
    'private public route has no DTO',
  );
  await manageWallet(c.id, w2.id, 'primary');
  check(
    (await db().collectorWallet.count({
      where: { collectorId: c.id, isPrimary: true },
    })) === 1,
    'primary wallet invariant',
  );
  await db().authSession.create({
    data: {
      tokenHash: 'fixture-session',
      collectorId: c.id,
      expiresAt: new Date(Date.now() + 100000),
    },
  });
  await manageWallet(c.id, w2.id, 'revoke');
  check(
    (await collectionSummary(c.id)).owned === 0,
    'revoked wallet excluded from aggregation',
  );
  check(
    (await collectionSummary(c.id)).discovered === 2,
    'revocation preserves discoveries',
  );
  check(
    (await db().authSession.count({ where: { collectorId: c.id } })) === 0,
    'revocation invalidates all sessions',
  );
  check(
    (await db().collectorWallet.findUniqueOrThrow({ where: { id: w2.id } }))
      .status === 'REVOKED',
    'revocation preserves wallet evidence',
  );
  await assert.rejects(
    () => manageWallet(c.id, w1.id, 'revoke'),
    /LAST_CREDENTIAL/,
  );
  check(true, 'last sign-in method cannot be removed');
  await assert.rejects(
    () => manageWallet(other.id, w1.id, 'primary'),
    /WALLET_NOT_FOUND/,
  );
  check(true, 'cannot manage another collector wallet');
  check(
    (await requestRefresh(c.id)).status === 'QUEUED',
    'refresh queues durably',
  );
  await assert.rejects(() => requestRefresh(c.id), /REFRESH_THROTTLED/);
  check(true, 'database refresh throttle');
  check(
    (await requestRefresh(other.id)).status === 'QUEUED',
    'cross-collector requests coalesce',
  );
  check(
    (await db().ownershipRefresh.count()) === 1,
    'one shared contract scan',
  );
  const all = await collectionPage({});
  if (all.total === 4444) {
    check(all.items.length === 24, 'catalog paginates on server');
    const p2 = await collectionPage({ page: '2' });
    check(p2.items[0].tokenId === 25, 'second page stable order');
    const descending = await collectionPage({ sort: 'points-desc' });
    check(
      descending.items.every(
        (v, i, rows) => i === 0 || v.uglyPoints! <= rows[i - 1].uglyPoints!,
      ),
      'points sort desc',
    );
    const asc = await collectionPage({ sort: 'points-asc' });
    check(
      asc.items.every(
        (v, i, rows) => i === 0 || v.uglyPoints! >= rows[i - 1].uglyPoints!,
      ),
      'points sort asc',
    );
    const rank = await collectionPage({ sort: 'rank' });
    check(
      rank.items.every((v) => v.mawRank === 1),
      'Maw rank sort honors legendary ties',
    );
    const trait = await collectionPage({
      trait: 'Skin',
      value: 'Amphibian Red',
    });
    check(
      trait.total > 0 &&
        trait.items.every((s) =>
          s.traits.some(
            (t) => t.traitType === 'Skin' && t.value === 'Amphibian Red',
          ),
        ),
      'trait filters query actual normalized rows',
    );
    check(
      (await collectionPage({ q: '69', legendary: '1', og: '1' })).items
        .length === 1,
      'token OG and Legendary filters combine',
    );
    check(
      (await collectionPage({ min: '800', max: '810' })).items.every(
        (s) => s.uglyPoints! >= 800 && s.uglyPoints! <= 810,
      ),
      'point range filter',
    );
    check(
      (await collectionPage({ rarity: 'epic' })).items.every(
        (s) => s.rarity === 'epic',
      ),
      'rarity filter',
    );
    check(
      (await collectionPage({ page: '185', q: '1' })).page === 1,
      'out of range page clamps after filtering',
    );
  }
  // RPC is injected only here; the real PostgreSQL transaction, leases, observations,
  // discovery writes and checkpoints are exercised by the production worker.
  const block = {
    number: 10000n,
    hash: '0x' + 'e'.repeat(64),
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
  };
  const fakeClient = { getBlock: async () => block } as unknown as Awaited<
    ReturnType<typeof validateContract>
  >;
  let fail = false;
  const blocks: bigint[] = [];
  const reader: typeof getOwnershipBatch = async (_client, tokens, at) => {
    blocks.push(at);
    if (fail) throw new Error('fixture RPC outage');
    return tokens.map(() => ({
      status: 'success' as const,
      result: out as `0x${string}`,
    }));
  };
  const deps = {
    validateContract: async () => fakeClient,
    getOwnershipBatch: reader,
  };
  check(await ownershipWorkerBatch(deps), 'worker processes first page');
  check(
    (await db().ownershipRefresh.findUniqueOrThrow({ where: { id: 'squigs' } }))
      .nextToken === 101,
    'worker commits durable next token',
  );
  fail = true;
  await ownershipWorkerBatch(deps);
  const failed = await db().ownershipRefresh.findUniqueOrThrow({
    where: { id: 'squigs' },
  });
  check(
    failed.status === 'FAILED' && failed.nextToken === 101,
    'RPC failure preserves checkpoint',
  );
  await db().ownershipRefresh.update({
    where: { id: 'squigs' },
    data: { status: 'SYNCING', leaseUntil: new Date(0), leaseToken: 'expired' },
  });
  fail = false;
  check(await ownershipWorkerBatch(deps), 'expired lease recovered');
  check(
    (await db().ownershipRefresh.findUniqueOrThrow({ where: { id: 'squigs' } }))
      .nextToken === 201,
    'resume advances next page without restarting',
  );
  check(
    blocks.every((n) => n === 10000n),
    'resumed scan pins finalized snapshot',
  );
  await db().ownershipRefresh.update({
    where: { id: 'squigs' },
    data: {
      status: 'SYNCING',
      leaseUntil: new Date(Date.now() + 60000),
      leaseToken: 'another-worker',
    },
  });
  check(
    !(await ownershipWorkerBatch(deps)),
    'live lease excludes concurrent worker',
  );
  await db().ownershipRefresh.update({
    where: { id: 'squigs' },
    data: { status: 'QUEUED', nextToken: 4444 },
  });
  await ownershipWorkerBatch(deps);
  check(
    (await db().ownershipRefresh.findUniqueOrThrow({ where: { id: 'squigs' } }))
      .status === 'COMPLETE',
    'last page marks completion',
  );
}
