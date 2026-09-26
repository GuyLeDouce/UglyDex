-- UglyDex-owned constraints only. Prisma cannot express partial unique indexes.
CREATE UNIQUE INDEX "CollectorWallet_one_primary" ON "CollectorWallet" ("collectorId", "chainId") WHERE "isPrimary" = true AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "SquigOwnership_one_current" ON "SquigOwnership" ("squigId") WHERE "isCurrent" = true;
ALTER TABLE "CollectorWallet" ADD CONSTRAINT "CollectorWallet_normalized" CHECK ("walletAddress" ~ '^0x[0-9a-f]{40}$');
ALTER TABLE "WalletLinkEvidence" ADD CONSTRAINT "WalletLinkEvidence_normalized" CHECK ("walletAddress" ~ '^0x[0-9a-f]{40}$');
ALTER TABLE "SquigOwnership" ADD CONSTRAINT "SquigOwnership_normalized" CHECK ("walletAddress" ~ '^0x[0-9a-f]{40}$');
ALTER TABLE "Squig" ADD CONSTRAINT "Squig_token_range" CHECK ("tokenId" BETWEEN 1 AND 4444);
ALTER TABLE "Squig" ADD CONSTRAINT "Squig_contract_normalized" CHECK ("contractAddress" ~ '^0x[0-9a-f]{40}$');
ALTER TABLE "CollectorProgress" ADD CONSTRAINT "CollectorProgress_nonnegative" CHECK ("xp" >= 0 AND "level" >= 1);
ALTER TABLE "SquigProgress" ADD CONSTRAINT "SquigProgress_nonnegative" CHECK ("xp" >= 0 AND "level" >= 1);
