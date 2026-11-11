import { redirect } from 'next/navigation';
import { currentSession } from '@/server/auth';
import { onboardingState } from '@/server/onboarding';
import { Connect } from '@/components/connect';
import { ProfileWalkthrough } from '@/components/profile-walkthrough';
import { walkthroughStep } from '@/domain/profile-walkthrough';
import { db } from '@/server/db';
import { collectorAvatar } from '@/server/collector-avatar';
import {
  activeAddresses,
  catalogScope,
  ownedScope,
} from '@/server/collections';
import { OnboardingChoice } from '@/components/onboarding-choice';
export const dynamic = 'force-dynamic';
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await currentSession();
  if (!session) redirect('/connect');
  const state = await onboardingState(session.collectorId);
  if (state.step === 'COMPLETE') redirect('/me');
  const { error } = await searchParams;
  if (state.step === 'DRIP' || state.step === 'READY') {
    const c = await db().collector.findUniqueOrThrow({
      where: { id: session.collectorId },
    });
    const step = walkthroughStep(
      c.profileSetupStep,
      state.dripVerified || state.discordTrackingConsent === false,
    );
    const avatar = await collectorAvatar(
      c.id,
      step === 'AVATAR' ? null : c.avatar,
    );
    const addresses = await activeAddresses(c.id);
    const squigs =
      step === 'AVATAR'
        ? await db().squig.findMany({
            where: { AND: [catalogScope, ownedScope(addresses)] },
            orderBy: [
              { mawRank: { sort: 'asc', nulls: 'last' } },
              { tokenId: 'asc' },
            ],
            select: { tokenId: true, mawRank: true },
          })
        : [];
    return (
      <ProfileWalkthrough
        key={step}
        step={step}
        name={c.displayName ?? ''}
        avatarId={avatar?.tokenId ?? null}
        squigs={squigs}
      />
    );
  }
  return (
    <section className="panel">
      <p className="eyebrow">ONE COLLECTOR. ALL YOUR CONNECTIONS.</p>
      <h1>Set up your UglyDex.</h1>
      <ol>
        <li>Verify wallet {state.walletVerified ? '✓' : ''}</li>
        <li>
          Choose Discord tracking{' '}
          {state.discordVerified && state.discordTrackingConsent ? '✓' : ''}
        </li>
        <li>Verify DRIP ID {state.dripVerified ? '✓' : ''}</li>
      </ol>
      {error && (
        <p role="alert">
          {error === 'DISCORD_DECLINED'
            ? 'Discord authorization was cancelled. Try again or choose the tracking opt-out below.'
            : 'Discord sign-in could not be completed. Please try again.'}
        </p>
      )}
      {state.step === 'WALLET' && (
        <>
          <h2>First, verify your wallet.</h2>
          <p>
            Sign a message to prove ownership. No transaction or gas required.
          </p>
          <Connect showDiscord={false} />
        </>
      )}
      {state.step === 'DISCORD' && (
        <>
          <h2>Connect your community identity.</h2>
          <p>
            Authorize Discord and allow UglyDex to import and display your
            linked community activity. You can change this choice in Account
            connections.
          </p>
          {state.discordVerified ? (
            <OnboardingChoice action="enable">
              Allow Discord activity tracking
            </OnboardingChoice>
          ) : (
            <form method="post" action="/api/auth/discord">
              <input type="hidden" name="trackingConsent" value="yes" />
              <button className="button primary">
                Authorize Discord and enable tracking
              </button>
            </form>
          )}
        </>
      )}
      {state.step === 'DISCORD' && (
        <>
          <OnboardingChoice action="decline">
            Decline and opt out of Discord activity tracking
          </OnboardingChoice>
          <p>
            Continue with your wallet only. Public wallet ownership and on-chain
            history remain available.
          </p>
        </>
      )}
    </section>
  );
}
