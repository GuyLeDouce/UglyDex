ALTER TABLE "Collector" ADD COLUMN "communityFeedSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Collector" ADD COLUMN "communityWelcomeAt" TIMESTAMP(3);
-- Existing accounts are not new arrivals when they next edit their profile.
UPDATE "Collector" SET "communityWelcomeAt" = CURRENT_TIMESTAMP
WHERE "claimedAt" IS NOT NULL OR "onboardingCompletedAt" IS NOT NULL;
CREATE TABLE "CommunityFeedEvent" (
  "collectorId" UUID NOT NULL REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("collectorId", "kind", "key")
);
CREATE INDEX "CommunityFeedEvent_at_idx" ON "CommunityFeedEvent"("at");
