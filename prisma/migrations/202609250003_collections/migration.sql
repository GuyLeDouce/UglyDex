ALTER TABLE "Collector" ADD COLUMN "showWallets" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "showDiscord" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "featuredTokenIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
CREATE UNIQUE INDEX "Collector_slug_case_insensitive" ON "Collector" (lower("slug"));
CREATE INDEX "Squig_uglyPoints_tokenId_idx" ON "Squig" ("uglyPoints", "tokenId");
CREATE INDEX "Squig_mawRank_tokenId_idx" ON "Squig" ("mawRank", "tokenId");
CREATE INDEX "Squig_rarityTier_og_legendary_idx" ON "Squig" ("rarityTier", "og", "legendary");
CREATE INDEX "SquigDiscovery_collectorId_everOwned_discoveredAt_idx" ON "SquigDiscovery" ("collectorId", "everOwned", "discoveredAt");
CREATE TABLE "OwnershipRefresh" (
 "id" TEXT PRIMARY KEY DEFAULT 'squigs', "status" TEXT NOT NULL DEFAULT 'QUEUED',
 "nextToken" INTEGER NOT NULL DEFAULT 1, "blockNumber" BIGINT, "blockHash" TEXT, "blockTime" TIMESTAMP(3),
 "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedAt" TIMESTAMP(3),
 "completedAt" TIMESTAMP(3), "leaseUntil" TIMESTAMP(3), "leaseToken" TEXT, "errorCode" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK ("nextToken" BETWEEN 1 AND 4445), CHECK ("status" IN ('QUEUED','SYNCING','COMPLETE','FAILED'))
);
CREATE TABLE "CollectorRefreshRequest" ("collectorId" UUID PRIMARY KEY REFERENCES "Collector"("id"), "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
