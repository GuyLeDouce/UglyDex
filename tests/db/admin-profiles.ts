import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { db } from '../../src/server/db';
import {
  updateAdminProfile,
  adminProfileRevision,
  adminProfileInclude,
} from '../../src/server/admin-profiles';
export async function adminProfileTests(
  check: (v: unknown, message: string) => void,
) {
  const wallet = () => '0x' + randomBytes(20).toString('hex');
  const a = wallet(),
    b = wallet(),
    c = wallet();
  const realmId = process.env.DRIP_REALM_ID!;
  const owner = process.env.ADMIN_DISCORD_IDS!;
  const first = await db().collector.create({
    data: {
      slug: 'admin-fixture-first',
      claimedAt: new Date(),
      wallets: {
        create: {
          chainId: 1,
          walletAddress: a,
          source: 'SIWE',
          verifiedAt: new Date(),
        },
      },
      identities: {
        create: {
          provider: 'DISCORD',
          externalId: '555555555555555555',
          authenticatedAt: new Date(),
        },
      },
    },
  });
  const second = await db().collector.create({
    data: {
      slug: 'admin-fixture-second',
      wallets: {
        create: {
          chainId: 1,
          walletAddress: c,
          source: 'SIWE',
          verifiedAt: new Date(),
        },
      },
      dripIdentities: {
        create: { realmId, dripMemberId: 'c'.repeat(24), status: 'RESOLVED' },
      },
    },
  });
  const input = {
    id: first.id,
    revision: adminProfileRevision(
      await db().collector.findUniqueOrThrow({
        where: { id: first.id },
        include: adminProfileInclude,
      }),
    ),
    updatedAt: first.updatedAt.toISOString(),
    slug: first.slug,
    displayName: 'Support fixture',
    wallets: [a],
    discordIds: ['555555555555555555'],
    dripId: '',
    status: 'ERROR',
    notes: 'Profile linking needs attention.',
    reason: 'Support case fixture',
  };
  await updateAdminProfile('fixture-owner', input);
  check(
    (
      await db().collectorSupport.findUnique({
        where: { collectorId: first.id },
      })
    )?.notes === input.notes,
    'status notes persist',
  );
  await assert.rejects(
    updateAdminProfile('fixture-owner', input),
    /PROFILE_CHANGED/,
  );
  const fresh = async () => ({
    ...input,
    revision: adminProfileRevision(
      await db().collector.findUniqueOrThrow({
        where: { id: first.id },
        include: adminProfileInclude,
      }),
    ),
    updatedAt: (
      await db().collector.findUniqueOrThrow({ where: { id: first.id } })
    ).updatedAt.toISOString(),
  });
  for (const [change, message] of [
    [{ wallets: [c] }, 'WALLET_CONFLICT'],
    [{ dripId: 'c'.repeat(24) }, 'DRIP_CONFLICT'],
    [{ slug: second.slug }, 'USERNAME_CONFLICT'],
    [{ discordIds: [owner] }, 'OWNER_PROTECTED'],
    [{ wallets: [], discordIds: [] }, 'LAST_LOGIN'],
  ] as const) {
    await assert.rejects(
      updateAdminProfile('fixture-owner', { ...(await fresh()), ...change }),
      new RegExp(message),
    );
    check(
      (
        await db().collectorWallet.findUnique({
          where: { chainId_walletAddress: { chainId: 1, walletAddress: a } },
        })
      )?.status === 'ACTIVE',
      message + ' rolls back wallet changes',
    );
  }
  await db().authSession.create({
    data: {
      collectorId: first.id,
      tokenHash: 'fixture-admin-session',
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  await updateAdminProfile('fixture-owner', {
    ...(await fresh()),
    wallets: [b],
    discordIds: ['666666666666666666'],
    dripId: 'd'.repeat(24),
    status: 'UPDATING',
    notes: 'Awaiting verification',
  });
  check(
    (
      await db().collectorWallet.findUnique({
        where: { chainId_walletAddress: { chainId: 1, walletAddress: a } },
      })
    )?.status === 'REVOKED',
    'old wallet retained and revoked',
  );
  check(
    (
      await db().collectorWallet.findUnique({
        where: { chainId_walletAddress: { chainId: 1, walletAddress: b } },
      })
    )?.isPrimary,
    'new wallet becomes primary',
  );
  check(
    (await db().authSession.count({ where: { collectorId: first.id } })) === 0,
    'identity edit revokes sessions',
  );
  check(
    (
      await db().externalIdentity.findFirst({
        where: { collectorId: first.id },
      })
    )?.authenticatedAt === null,
    'admin edit does not fabricate OAuth proof',
  );
  check(
    (await db().dripIdentity.findFirst({ where: { collectorId: first.id } }))
      ?.status === 'UNRESOLVED',
    'DRIP correction awaits verification',
  );
  check(
    (await db().operationalAudit.count({
      where: { subject: first.id, action: 'ADMIN_PROFILE_UPDATED' },
    })) === 2,
    'successful edits audited atomically',
  );
  await db().collectorSupport.update({
    where: { collectorId: first.id },
    data: { status: 'ERROR' },
  });
  const { adminProfileHealth } = await import('../../src/server/admin-health');
  await db().collector.update({
    where: { id: first.id },
    data: { onboardingCompletedAt: new Date(), discordTrackingConsent: false },
  });
  await db().collectionJob.deleteMany({ where: { collectorId: first.id } });
  await db().progressionJob.deleteMany({ where: { subjectId: first.id } });
  check(
    (await adminProfileHealth()).get(first.id)?.status === 'ACTIVE',
    'legacy manual status and optional identity links do not override detected health',
  );
  await db().collectionJob.create({
    data: { collectorId: first.id, errorCode: 'FIXTURE_FAILURE' },
  });
  check(
    (await adminProfileHealth()).get(first.id)?.status === 'ERROR',
    'collector job failure automatically sets ERROR',
  );
  await db().collectionJob.update({
    where: { collectorId: first.id },
    data: { errorCode: null },
  });
  check(
    (await adminProfileHealth()).get(first.id)?.status === 'UPDATING',
    'retry automatically changes ERROR to UPDATING',
  );
  await db().collectionJob.delete({ where: { collectorId: first.id } });
  check(
    (await adminProfileHealth()).get(first.id)?.status === 'ACTIVE',
    'completed work automatically restores ACTIVE',
  );
}
