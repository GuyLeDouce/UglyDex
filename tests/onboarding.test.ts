import { describe, expect, it } from 'vitest';
import { onboardingStep, type OnboardingFacts } from '../src/domain/onboarding';
const initial: OnboardingFacts = {
  onboardingCompletedAt: null,
  discordTrackingConsent: null,
  walletVerified: false,
  discordVerified: false,
  dripVerified: false,
};
describe('wallet-first onboarding', () => {
  it('does not let Discord or DRIP substitute for wallet verification', () => {
    expect(
      onboardingStep({
        ...initial,
        discordVerified: true,
        dripVerified: true,
        discordTrackingConsent: true,
      }),
    ).toBe('WALLET');
  });
  it('requires an explicit tracking choice even for an existing Discord credential', () => {
    expect(
      onboardingStep({
        ...initial,
        walletVerified: true,
        discordVerified: true,
      }),
    ).toBe('DISCORD');
  });
  it('requires authorized Discord before proceeding to DRIP', () => {
    expect(
      onboardingStep({
        ...initial,
        walletVerified: true,
        discordTrackingConsent: true,
      }),
    ).toBe('DISCORD');
    expect(
      onboardingStep({
        ...initial,
        walletVerified: true,
        discordTrackingConsent: true,
        discordVerified: true,
      }),
    ).toBe('DRIP');
  });
  it('permits wallet-only opt-out and fully verified setup', () => {
    expect(
      onboardingStep({
        ...initial,
        walletVerified: true,
        discordTrackingConsent: false,
      }),
    ).toBe('READY');
    expect(
      onboardingStep({
        ...initial,
        walletVerified: true,
        discordTrackingConsent: true,
        discordVerified: true,
        dripVerified: true,
      }),
    ).toBe('READY');
  });
  it('does not repeat setup after a completed profile returns', () => {
    expect(
      onboardingStep({ ...initial, onboardingCompletedAt: new Date() }),
    ).toBe('COMPLETE');
  });
});
