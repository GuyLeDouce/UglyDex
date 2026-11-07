ALTER TABLE "Collector" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "discordTrackingConsent" BOOLEAN,
  ADD COLUMN "discordTrackingConsentAt" TIMESTAMP(3);
-- Consent is intentionally not inferred from a legacy OAuth login.
