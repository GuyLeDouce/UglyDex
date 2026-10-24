import assert from 'node:assert/strict';
import { db } from '../../src/server/db';
import {
  discoverHolder,
  backfillHolders,
  adoptDiscoveredWallet,
} from '../../src/server/collector-discovery';
import { observe } from '../../src/sync/blockchain';
import {
  activeAddresses,
  collectionSummary,
} from '../../src/server/collections';
import { collectorProfile } from '../../src/server/profiles';
import { uglyUsers } from '../../src/server/community';
import { saveProfile } from '../../src/server/settings';
export async function collectorIdentityTests(
  check: (value: unknown, message: string) => void,
) {
  const a = '0x' + 'fe'.repeat(20),
    b = '0x' + 'fd'.repeat(20);
  const apply = (wallet: string, block: bigint) =>
    db().$transaction((tx) =>
      observe(tx, {
        tokenId: 4429,
        wallet,
        block,
        blockHash: '0x' + 'e'.repeat(64),
        time: new Date(),
        key: `identity-fixture:${block}`,
        source: 'ownerOf',
      }),
    );
  await apply(a, 99000000n);
  const first = await db().discoveredWallet.findUniqueOrThrow({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: a } },
    include: { collector: true },
  });
  check(
    first.collector.isPublic && !first.collector.claimedAt,
    'canonical holder automatically public and unclaimed',
  );
  check(
    (await activeAddresses(first.collectorId)).length === 0,
    'discovery never grants a verified wallet association',
  );
  check(
    (await db().authSession.count({
      where: { collectorId: first.collectorId },
    })) === 0,
    'discovery creates no sessions',
  );
  const repeated = await Promise.all(
    Array.from({ length: 8 }, () =>
      db().$transaction((tx) => discoverHolder(tx, a)),
    ),
  );
  check(
    repeated.every((r) => r?.collectorId === first.collectorId),
    'concurrent discovery retains one permanent identity',
  );
  check(
    (await collectionSummary(first.collectorId)).owned === 1,
    'unclaimed public collection reads indexed holdings',
  );
  const profile = await collectorProfile(first.collector.slug);
  check(
    profile.status === 'ready' && profile.profile.unclaimed,
    'unclaimed public projection available',
  );
  const directory = await uglyUsers(1);
  check(
    directory.pages > 0,
    'public directory includes discovery records without progression',
  );
  const before = await db().discoveredWallet.count();
  await backfillHolders({ dryRun: true, limit: 500 });
  check(
    before === (await db().discoveredWallet.count()),
    'backfill dry run performs no writes',
  );
  await apply(b, 99000001n);
  check(
    (await collectionSummary(first.collectorId)).owned === 0,
    'transfer removes current holdings',
  );
  check(
    (await collectorProfile(first.collector.slug)).status === 'ready',
    'selling every Squig retains public holder profile',
  );
  check(
    (await db().squigOwnership.count({ where: { walletAddress: a } })) > 0,
    'transfer retains original ownership evidence',
  );
  const survivor = await db().collector.create({
    data: { slug: 'identity-survivor', claimedAt: new Date() },
  });
  await db().$transaction((tx) => adoptDiscoveredWallet(tx, a, survivor.id));
  check(
    (
      await db().discoveredWallet.findUniqueOrThrow({
        where: { chainId_walletAddress: { chainId: 1, walletAddress: a } },
      })
    ).collectorId === survivor.id,
    'fresh proof may adopt an empty discovery shell',
  );
  check(
    (await collectorProfile(first.collector.slug)).status === 'missing',
    'absorbed shell is not a duplicate public collector',
  );
  await assert.rejects(
    db().$transaction((tx) => adoptDiscoveredWallet(tx, a, first.collectorId)),
    /IDENTITY_REVIEW_REQUIRED/,
  );
  check(true, 'claimed identity never silently reassigned');
  const unnamed = await db().collector.create({
    data: {
      slug: 'collector-00000000-0000-0000-0000-000000000032',
      claimedAt: new Date(),
    },
  });
  for (const suffix of ['f1', 'f2'])
    await db().collectorWallet.create({
      data: {
        chainId: 1,
        walletAddress: '0x' + suffix.repeat(20),
        collectorId: unnamed.id,
        source: 'SIWE',
        verifiedAt: new Date(),
      },
    });
  await assert.rejects(
    saveProfile(unnamed.id, {
      slug: '',
      displayName: '',
      bio: '',
      avatar: '',
      isPublic: true,
      showWallets: true,
      showDiscord: false,
      featuredTokenIds: [],
    }),
    /USERNAME_REQUIRED/,
  );
  check(true, 'profile settings cannot leave a multi-wallet identity unnamed');
  check(
    (
      await saveProfile(unnamed.id, {
        slug: 'identity-multiwallet',
        displayName: '',
        bio: '',
        avatar: '',
        isPublic: true,
        showWallets: true,
        showDiscord: false,
        featuredTokenIds: [],
      })
    ).slug === 'identity-multiwallet',
    'multi-wallet username can be set without changing UUID',
  );
}
