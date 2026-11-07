import 'server-only';
import { db } from './db';
import { onboardingStep } from '@/domain/onboarding';
import type { Prisma } from '@/generated/prisma/client';

export async function onboardingState(
  collectorId: string,
  client: Prisma.TransactionClient = db(),
) {
  const collector = await client.collector.findUniqueOrThrow({
    where: { id: collectorId },
    include: {
      wallets: {
        where: { status: 'ACTIVE', revokedAt: null, source: 'SIWE' },
        select: { id: true },
      },
      identities: {
        where: { provider: 'DISCORD', authenticatedAt: { not: null } },
        select: { id: true },
      },
      dripIdentities: {
        where: { status: 'RESOLVED', dripMemberId: { not: null } },
        select: { id: true },
      },
    },
  });
  const facts = {
    onboardingCompletedAt: collector.onboardingCompletedAt,
    discordTrackingConsent: collector.discordTrackingConsent,
    discordTrackingConsentAt: collector.discordTrackingConsentAt,
    walletVerified: collector.wallets.length > 0,
    discordVerified: collector.identities.length > 0,
    dripVerified: collector.dripIdentities.length > 0,
  };
  return { ...facts, step: onboardingStep(facts) };
}

export async function nextAfterAuthentication(collectorId: string) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    const state = await onboardingState(collectorId, tx);
    if (state.step === 'COMPLETE') return '/me';
    if (state.step !== 'READY') return '/onboarding';
    await tx.collector.update({
      where: { id: collectorId },
      data: { onboardingCompletedAt: new Date() },
    });
    return '/settings/profile';
  });
}

export async function setDiscordTracking(
  collectorId: string,
  consent: boolean,
  authorizedAt?: Date,
) {
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    const state = await onboardingState(collectorId, tx);
    // An OAuth flow opened before a newer choice cannot override that choice.
    if (
      authorizedAt &&
      state.discordTrackingConsentAt &&
      state.discordTrackingConsentAt > authorizedAt
    )
      return;
    if (!state.walletVerified && !state.onboardingCompletedAt)
      throw new Error('WALLET_REQUIRED');
    if (consent && !state.discordVerified) throw new Error('DISCORD_REQUIRED');
    await tx.collector.update({
      where: { id: collectorId },
      data: {
        discordTrackingConsent: consent,
        discordTrackingConsentAt: new Date(),
        ...(consent && !state.dripVerified
          ? { onboardingCompletedAt: null }
          : {}),
        ...(!consent ? { showDiscord: false, showCharmBalance: false } : {}),
      },
    });
    if (!consent) {
      // Keep historical evidence, but stop displaying or deriving activity from it.
      await tx.collectorActivity.updateMany({
        where: {
          collectorId,
          sourceSystem: { in: ['uglybot', 'gauntlet', 'images'] },
          recordStatus: 'ACTIVE',
        },
        data: { recordStatus: 'OPTED_OUT' },
      });
      await tx.charmRefreshRequest.updateMany({
        where: { collectorId },
        data: { pending: false },
      });
    } else {
      await tx.collectorActivity.updateMany({
        where: { collectorId, recordStatus: 'OPTED_OUT' },
        data: { recordStatus: 'ACTIVE' },
      });
    }
    await tx.progressionJob.upsert({
      where: {
        subjectType_subjectId: {
          subjectType: 'COLLECTOR',
          subjectId: collectorId,
        },
      },
      create: { subjectType: 'COLLECTOR', subjectId: collectorId },
      update: { queuedAt: new Date(), generation: { increment: 1 } },
    });
  });
}
