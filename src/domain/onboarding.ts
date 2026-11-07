export type OnboardingFacts = {
  onboardingCompletedAt: Date | null;
  discordTrackingConsent: boolean | null;
  walletVerified: boolean;
  discordVerified: boolean;
  dripVerified: boolean;
};

// Completion is durable: returning sign-ins never restart initial setup.
export function onboardingStep(facts: OnboardingFacts) {
  if (facts.onboardingCompletedAt) return 'COMPLETE';
  if (!facts.walletVerified) return 'WALLET';
  if (facts.discordTrackingConsent === false) return 'READY';
  if (facts.discordTrackingConsent !== true || !facts.discordVerified)
    return 'DISCORD';
  if (!facts.dripVerified) return 'DRIP';
  return 'READY';
}
