import assert from 'node:assert/strict';
import { db } from '../../src/server/db';
import {
  onboardingState,
  nextAfterAuthentication,
  setDiscordTracking,
} from '../../src/server/onboarding';
import { importEvent } from '../../src/sync/import-event';

export async function onboardingDatabaseTests(
  check: (v: unknown, m: string) => void,
) {
  const wallet = '0x' + 'a9'.repeat(20);
  const discord = '877777777777777777';
  const c = await db().collector.create({
    data: { slug: 'onboarding-fixture' },
  });
  check(
    (await onboardingState(c.id)).step === 'WALLET',
    'new collector begins with wallet proof',
  );
  await assert.rejects(setDiscordTracking(c.id, false), /WALLET_REQUIRED/);
  await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      chainId: 1,
      walletAddress: wallet,
      checksumAddress: wallet,
      source: 'SIWE',
      verifiedAt: new Date(),
      isPrimary: true,
    },
  });
  check(
    (await nextAfterAuthentication(c.id)) === '/onboarding',
    'wallet proof alone does not bypass consent',
  );
  await assert.rejects(setDiscordTracking(c.id, true), /DISCORD_REQUIRED/);
  await setDiscordTracking(c.id, false);
  check(
    (await nextAfterAuthentication(c.id)) === '/settings/profile',
    'wallet-only completion opens Profile Settings',
  );
  check(
    (await nextAfterAuthentication(c.id)) === '/me',
    'returning collector does not repeat onboarding',
  );
  const identity = await db().externalIdentity.create({
    data: {
      collectorId: c.id,
      provider: 'DISCORD',
      externalId: discord,
      authenticatedAt: new Date(),
    },
  });
  await setDiscordTracking(c.id, true);
  check(
    (await onboardingState(c.id)).step === 'DRIP',
    'opting in later requires verified DRIP',
  );
  await db().dripIdentity.create({
    data: {
      collectorId: c.id,
      realmId: 'a'.repeat(24),
      dripMemberId: 'a9'.repeat(12),
      status: 'UNRESOLVED',
    },
  });
  check(
    (await onboardingState(c.id)).step === 'DRIP',
    'unresolved DRIP ID cannot complete onboarding',
  );
  await db().dripIdentity.updateMany({
    where: { collectorId: c.id },
    data: { status: 'RESOLVED' },
  });
  check(
    (await nextAfterAuthentication(c.id)) === '/settings/profile',
    'verified three-step setup opens Profile Settings',
  );
  const event = {
    sourceSystem: 'uglybot',
    sourceType: 'onboarding-fixture',
    sourceId: 'one',
    subject: 'fixture',
    eventType: 'CLAIM_RECEIVED',
    eventAt: new Date(),
    discordId: discord,
    metadata: {},
    category: 'OTHER',
    importance: 'MAJOR',
    visibility: 'PUBLIC',
    recordStatus: 'ACTIVE',
  } as const;
  await importEvent(event);
  check(
    (await db().collectorActivity.count({
      where: { collectorId: c.id, recordStatus: 'ACTIVE' },
    })) === 1,
    'consented community activity imports',
  );
  await setDiscordTracking(c.id, false);
  check(
    (await db().collectorActivity.count({
      where: { collectorId: c.id, recordStatus: 'ACTIVE' },
    })) === 0,
    'opt-out removes historical community activity from active display',
  );
  check(
    (await importEvent({ ...event, sourceId: 'two' })) === 'skipped',
    'opt-out prevents new community imports',
  );
  check(
    (await importEvent({ ...event, metadata: { correction: true } })) ===
      'skipped',
    'source refresh cannot reactivate opted-out records',
  );
  check(
    (
      await db().externalIdentity.findUniqueOrThrow({
        where: { id: identity.id },
      })
    ).authenticatedAt !== null,
    'tracking opt-out preserves authorized Discord sign-in',
  );
  check(
    (await nextAfterAuthentication(c.id)) === '/me',
    'tracking opt-out preserves completed setup',
  );
  await setDiscordTracking(c.id, true);
  check(
    (await db().collectorActivity.count({
      where: { collectorId: c.id, recordStatus: 'ACTIVE' },
    })) === 1,
    'explicit re-consent restores preserved history',
  );
  await db().collectorWallet.updateMany({
    where: { collectorId: c.id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  await setDiscordTracking(c.id, false);
  check(
    (await onboardingState(c.id)).discordTrackingConsent === false,
    'returning Discord-only collector can still withdraw tracking consent after wallet revocation',
  );
}
