import { currentSession } from '@/server/auth';
import { onboardingState } from '@/server/onboarding';
import { redirect } from 'next/navigation';
import { Connect } from '@/components/connect';
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retryAfter?: string }>;
}) {
  const { error, retryAfter } = await searchParams;
  const session = await currentSession();
  if (session && !error) {
    const state = await onboardingState(session.collectorId);
    redirect(state.step === 'COMPLETE' ? '/collection' : '/onboarding');
  }
  const seconds =
    retryAfter && /^\d{1,5}$/.test(retryAfter) ? Number(retryAfter) : 0;
  const wait =
    seconds > 0 && seconds <= 86400
      ? `Wait at least ${seconds} seconds before starting a fresh sign-in.`
      : 'Please wait before starting a fresh sign-in.';
  return (
    <section className="connect-layout">
      <div className="connect-panel">
        <p className="eyebrow">YOUR COLLECTION STARTS HERE</p>
        <h1>Enter the UglyDex.</h1>
        <p>
          Sign a message to prove your wallet belongs to you. No transaction. No
          gas.
        </p>
        <Connect
          initialMessage={
            error === 'WALLET_REQUIRED'
              ? 'Start with wallet verification. Discord sign-in is available after you have linked and authorized it.'
              : error === 'DISCORD_DECLINED'
                ? 'Discord sign-in was cancelled. You can verify your wallet instead.'
                : error === 'DISCORD_RATE_LIMITED'
                  ? `Discord is temporarily limiting sign-in requests. ${wait} Use Connect Discord below rather than refreshing the previous callback. This attempt stopped before account linking.`
                  : error === 'IDENTITY_REVIEW_REQUIRED'
                    ? 'This identity is linked to another Collector. Verify your current wallet again, then retry linking the other identity to review the merge.'
                    : ''
          }
        />
        <small>One identity at a time. Your collection stays yours.</small>
      </div>
      <div className="connect-art" aria-hidden="true">
        <span className="connect-orbit orbit-one" />
        <span className="connect-orbit orbit-two" />
        <span className="connect-burst">✳</span>
        <span className="connect-lightning">ϟ</span>
        <span className="connect-art-label">FIELD GUIDE Nº 001</span>
      </div>
    </section>
  );
}
