ALTER TABLE "Collector" ADD COLUMN "claimedAt" TIMESTAMP(3), ADD COLUMN "showUsername" BOOLEAN NOT NULL DEFAULT false;
-- Preserve existing publication consent; never make old private accounts public.
UPDATE "Collector" c SET "claimedAt" = LEAST(
 (SELECT min("verifiedAt") FROM "CollectorWallet" w WHERE w."collectorId"=c.id),
 (SELECT min("authenticatedAt") FROM "ExternalIdentity" e WHERE e."collectorId"=c.id)
);
UPDATE "Collector" SET "showUsername"=true WHERE "displayName" IS NOT NULL AND "displayName"<>'';
CREATE TABLE "DiscoveredWallet" (
 "chainId" INTEGER NOT NULL,
 "walletAddress" VARCHAR(42) NOT NULL,
 "collectorId" UUID NOT NULL REFERENCES "Collector"("id"),
 "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("chainId", "walletAddress"),
 CHECK ("chainId"=1 AND "walletAddress" ~ '^0x[0-9a-f]{40}$')
);
CREATE INDEX "DiscoveredWallet_collectorId_idx" ON "DiscoveredWallet"("collectorId");
