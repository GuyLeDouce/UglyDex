import 'server-only';
import { db } from './db';
import { onboardingState } from './onboarding';
import { activeAddresses, catalogScope, ownedScope } from './collections';
import { squigAvatarUrl } from './collector-avatar';
import {
  walkthroughInput,
  walkthroughSharing,
  walkthroughStep,
} from '@/domain/profile-walkthrough';
import { hasCollectorUsername, slugSchema } from '@/domain/profile';
import { publishCommunityCard } from './community-publication';

export async function saveWalkthrough(collectorId: string, input: unknown) {
  const data = walkthroughInput.parse(input);
  const addresses = await activeAddresses(collectorId);
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    const state = await onboardingState(collectorId, tx);
    const c = await tx.collector.findUniqueOrThrow({
      where: { id: collectorId },
    });
    const next = `/collector/${c.slug}`;
    if (state.step === 'COMPLETE') return { complete: true, next };
    if (state.step === 'WALLET' || state.step === 'DISCORD')
      throw new Error('CONNECTIONS_REQUIRED');
    // Keep the existing wallet-only tracking opt-out available.
    const step = walkthroughStep(
      c.profileSetupStep,
      state.dripVerified || state.discordTrackingConsent === false,
    );
    if (data.action === 'name') {
      if (step !== 'NAME') throw new Error('SETUP_STEP_CHANGED');
      const normalized = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36)
        .replace(/-$/, '');
      const parsed = slugSchema.safeParse(normalized);
      const base = parsed.success ? parsed.data : 'ugly-collector';
      let slug = c.slug;
      if (!hasCollectorUsername(slug)) {
        // Serialize name allocation, including simultaneous new collectors.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'profile-name:' + base}, 0))`;
        slug = base;
        let suffix = 1;
        while (
          await tx.collector.findFirst({
            where: { slug, id: { not: collectorId } },
            select: { id: true },
          })
        )
          slug = `${base}-${suffix++}`;
      }
      await tx.collector.update({
        where: { id: collectorId },
        data: { displayName: data.name, slug, profileSetupStep: 1 },
      });
    } else if (data.action === 'avatar') {
      if (step !== 'AVATAR') throw new Error('SETUP_STEP_CHANGED');
      const owned = { AND: [catalogScope, ownedScope(addresses)] };
      if (
        data.tokenId !== null &&
        !(await tx.squig.count({ where: { ...owned, tokenId: data.tokenId } }))
      )
        throw new Error('AVATAR_NOT_OWNED');
      await tx.collector.update({
        where: { id: collectorId },
        data: {
          avatar: data.tokenId === null ? null : squigAvatarUrl(data.tokenId),
          profileSetupStep: 2,
        },
      });
    } else {
      if (step !== 'SHARING') throw new Error('SETUP_STEP_CHANGED');
      const now = new Date();
      const privacy = walkthroughSharing(data.share);
      const blocked = c.walletBlockPublicPreference !== null;
      await tx.collector.update({
        where: { id: collectorId },
        data: {
          ...privacy,
          ...(blocked
            ? { isPublic: false, walletBlockPublicPreference: true }
            : {}),
          onboardingCompletedAt: now,
          profileSetupStep: 3,
          ...(!blocked && c.claimedAt && !c.communityWelcomeAt
            ? { communityWelcomeAt: now }
            : {}),
        },
      });
      if (!blocked && c.claimedAt && !c.communityWelcomeAt)
        await publishCommunityCard(tx, collectorId, 'welcome', 'joined', now);
      return { complete: true, next };
    }
    return { complete: false, next: '/onboarding' };
  });
}
