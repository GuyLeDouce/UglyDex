import assert from 'node:assert/strict';
import { db } from '../../src/server/db';
import { changeWalletBlock } from '../../src/server/wallet-blocks';
import { discoverHolder } from '../../src/server/collector-discovery';
import { collectorProfile } from '../../src/server/profiles';

export async function walletBlockTests(
  check: (value: unknown, message: string) => void,
) {
  const a = '0x' + 'ba'.repeat(20),
    b = '0x' + 'bb'.repeat(20),
    future = '0x' + 'bc'.repeat(20);
  const actor = 'test:wallet-block';
  const block = (walletAddress: string) =>
    changeWalletBlock(actor, {
      action: 'block',
      walletAddress,
      reason: 'Disposable test',
    });
  const unblock = async (walletAddress: string) => {
    const row = await db().blockedWallet.findUniqueOrThrow({
      where: { chainId_walletAddress: { chainId: 1, walletAddress } },
    });
    return changeWalletBlock(actor, {
      action: 'unblock',
      walletAddress,
      blockedAt: row.createdAt.toISOString(),
    });
  };
  const mapping = await db().$transaction((tx) => discoverHolder(tx, a));
  assert.ok(mapping);
  const id = mapping.collectorId;
  const get = () => db().collector.findUniqueOrThrow({ where: { id } });
  const before = await get();
  await block(a.toUpperCase().replace('0X', '0x'));
  check(
    !(await get()).isPublic &&
      (await get()).walletBlockPublicPreference === true,
    'block hides public holder and retains public preference',
  );
  const publicResult = await collectorProfile(before.slug);
  check(
    publicResult.status === 'missing',
    'blocked profile is inaccessible publicly',
  );
  const duplicate = await block(a);
  check(
    !duplicate.changed &&
      (await db().operationalAudit.count({
        where: { actor, subject: a, action: 'WALLET_BLOCKED' },
      })) === 1,
    'repeat block is idempotent with one audit',
  );
  await db().collector.update({ where: { id }, data: { isPublic: true } });
  check(
    !(await get()).isPublic,
    'profile update cannot publish a blocked wallet',
  );
  await assert.rejects(
    changeWalletBlock(actor, {
      action: 'unblock',
      walletAddress: a,
      blockedAt: '2000-01-01T00:00:00.000Z',
    }),
    /BLOCK_CHANGED/,
  );
  await db().discoveredWallet.create({
    data: { chainId: 1, walletAddress: b, collectorId: id },
  });
  await block(b);
  await unblock(a);
  check(
    !(await get()).isPublic,
    'another blocked linked wallet keeps the whole collector hidden',
  );
  await unblock(b);
  check(
    (await get()).isPublic &&
      (await get()).walletBlockPublicPreference === null,
    'final unblock restores prior public visibility',
  );
  await db().collector.update({ where: { id }, data: { isPublic: false } });
  await block(a);
  await unblock(a);
  check(
    !(await get()).isPublic,
    'unblocking never publishes an already-private collector',
  );
  await db().collector.update({ where: { id }, data: { isPublic: true } });
  await block(a);
  await db().collector.update({ where: { id }, data: { isPublic: false } });
  await unblock(a);
  check(
    !(await get()).isPublic,
    'owner choosing private while blocked remains private on unblock',
  );
  await block(future);
  const later = await db().$transaction((tx) => discoverHolder(tx, future));
  assert.ok(later);
  check(
    !(
      await db().collector.findUniqueOrThrow({
        where: { id: later.collectorId },
      })
    ).isPublic,
    'wallet blocked before indexing never gets a public holder profile',
  );
  const claimed = await db().collector.create({
    data: {
      slug: 'wallet-block-claimed-test',
      isPublic: true,
      claimedAt: new Date(),
    },
  });
  await db().discoveredWallet.update({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: future } },
    data: { collectorId: claimed.id },
  });
  check(
    !(await db().collector.findUniqueOrThrow({ where: { id: claimed.id } }))
      .isPublic,
    'block follows a claimed or merged wallet mapping',
  );
  await unblock(future);
  check(
    (await db().collector.findUniqueOrThrow({ where: { id: claimed.id } }))
      .isPublic,
    'mapped collector can be restored after unblock',
  );
  await db().collectorWallet.create({
    data: {
      collectorId: claimed.id,
      chainId: 1,
      walletAddress: future,
      verifiedAt: new Date(),
      source: 'siwe',
      status: 'ACTIVE',
    },
  });
  await db().discoveredWallet.delete({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: future } },
  });
  await block(future);
  check(
    !(await db().collector.findUniqueOrThrow({ where: { id: claimed.id } }))
      .isPublic,
    'active verified wallet alone enforces the block',
  );
  await unblock(future);
  check(
    (await db().discoveredWallet.count({ where: { collectorId: id } })) === 2,
    'moderation preserves wallet mappings',
  );
  await db().collectorWallet.deleteMany({ where: { collectorId: claimed.id } });
  await db().discoveredWallet.deleteMany({ where: { collectorId: id } });
  await db().collector.deleteMany({
    where: { id: { in: [id, claimed.id, later.collectorId] } },
  });
}
