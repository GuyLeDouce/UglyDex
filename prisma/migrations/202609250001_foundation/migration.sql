-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('DISCORD');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Collector" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "avatar" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentity" (
    "id" UUID NOT NULL,
    "collectorId" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "metadata" JSONB,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authenticatedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorWallet" (
    "id" UUID NOT NULL,
    "collectorId" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "checksumAddress" VARCHAR(42),
    "source" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CollectorWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLinkEvidence" (
    "id" UUID NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "walletAddress" TEXT NOT NULL,
    "legacyVerified" BOOLEAN NOT NULL,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLinkEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityReconciliation" (
    "id" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "resolution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squig" (
    "id" UUID NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "name" TEXT,
    "metadata" JSONB,
    "uglyPoints" DECIMAL(20,4),
    "mawRank" INTEGER,
    "rarityTier" TEXT,
    "legendary" BOOLEAN,
    "og" BOOLEAN,
    "metadataUpdatedAt" TIMESTAMP(3),
    "metadataSourceHash" TEXT,

    CONSTRAINT "Squig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigTrait" (
    "id" UUID NOT NULL,
    "squigId" UUID NOT NULL,
    "traitType" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SquigTrait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigOwnership" (
    "id" UUID NOT NULL,
    "squigId" UUID NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "fromWallet" TEXT,
    "sourceKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "transactionHash" TEXT,
    "logIndex" INTEGER,
    "acquiredAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SquigOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigDiscovery" (
    "id" UUID NOT NULL,
    "collectorId" UUID NOT NULL,
    "squigId" UUID NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "everOwned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SquigDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorActivity" (
    "id" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "collectorId" UUID NOT NULL,
    "squigId" UUID,
    "sourceSystem" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigPassportEvent" (
    "id" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "squigId" UUID NOT NULL,
    "activityId" UUID,
    "eventType" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "SquigPassportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorProgress" (
    "collectorId" UUID NOT NULL,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rulesVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectorProgress_pkey" PRIMARY KEY ("collectorId")
);

-- CreateTable
CREATE TABLE "SquigProgress" (
    "squigId" UUID NOT NULL,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rulesVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquigProgress_pkey" PRIMARY KEY ("squigId")
);

-- CreateTable
CREATE TABLE "AchievementDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorAchievement" (
    "collectorId" UUID NOT NULL,
    "achievementId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "CollectorAchievement_pkey" PRIMARY KEY ("collectorId","achievementId")
);

-- CreateTable
CREATE TABLE "SquigAchievement" (
    "squigId" UUID NOT NULL,
    "achievementId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "SquigAchievement_pkey" PRIMARY KEY ("squigId","achievementId")
);

-- CreateTable
CREATE TABLE "CollectionSetDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CollectionSetDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionSetRequirement" (
    "id" UUID NOT NULL,
    "setId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CollectionSetRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorSetProgress" (
    "collectorId" UUID NOT NULL,
    "setId" TEXT NOT NULL,
    "progress" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectorSetProgress_pkey" PRIMARY KEY ("collectorId","setId")
);

-- CreateTable
CREATE TABLE "QuestDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "QuestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "collectorId" UUID NOT NULL,
    "questId" TEXT NOT NULL,
    "progress" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("collectorId","questId")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "counts" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainCursor" (
    "key" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainCursor_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "collectorId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "tokenHash" TEXT NOT NULL,
    "collectorId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collector_slug_key" ON "Collector"("slug");

-- CreateIndex
CREATE INDEX "ExternalIdentity_collectorId_idx" ON "ExternalIdentity"("collectorId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_provider_externalId_key" ON "ExternalIdentity"("provider", "externalId");

-- CreateIndex
CREATE INDEX "CollectorWallet_collectorId_status_idx" ON "CollectorWallet"("collectorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CollectorWallet_chainId_walletAddress_key" ON "CollectorWallet"("chainId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLinkEvidence_sourceKey_key" ON "WalletLinkEvidence"("sourceKey");

-- CreateIndex
CREATE INDEX "WalletLinkEvidence_walletAddress_discordId_idx" ON "WalletLinkEvidence"("walletAddress", "discordId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityReconciliation_dedupeKey_key" ON "IdentityReconciliation"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Squig_chainId_contractAddress_tokenId_key" ON "Squig"("chainId", "contractAddress", "tokenId");

-- CreateIndex
CREATE INDEX "SquigTrait_traitType_value_idx" ON "SquigTrait"("traitType", "value");

-- CreateIndex
CREATE UNIQUE INDEX "SquigTrait_squigId_traitType_key" ON "SquigTrait"("squigId", "traitType");

-- CreateIndex
CREATE UNIQUE INDEX "SquigOwnership_sourceKey_key" ON "SquigOwnership"("sourceKey");

-- CreateIndex
CREATE INDEX "SquigOwnership_squigId_blockNumber_idx" ON "SquigOwnership"("squigId", "blockNumber");

-- CreateIndex
CREATE INDEX "SquigOwnership_walletAddress_isCurrent_idx" ON "SquigOwnership"("walletAddress", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "SquigDiscovery_collectorId_squigId_key" ON "SquigDiscovery"("collectorId", "squigId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectorActivity_eventKey_key" ON "CollectorActivity"("eventKey");

-- CreateIndex
CREATE INDEX "CollectorActivity_collectorId_eventAt_idx" ON "CollectorActivity"("collectorId", "eventAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectorActivity_sourceSystem_sourceType_sourceId_subjectK_key" ON "CollectorActivity"("sourceSystem", "sourceType", "sourceId", "subjectKey", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "SquigPassportEvent_eventKey_key" ON "SquigPassportEvent"("eventKey");

-- CreateIndex
CREATE INDEX "SquigPassportEvent_squigId_eventAt_idx" ON "SquigPassportEvent"("squigId", "eventAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSetRequirement_setId_key_key" ON "CollectionSetRequirement"("setId", "key");

-- CreateIndex
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_collectorId_idx" ON "AuthSession"("collectorId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- AddForeignKey
ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorWallet" ADD CONSTRAINT "CollectorWallet_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigTrait" ADD CONSTRAINT "SquigTrait_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigOwnership" ADD CONSTRAINT "SquigOwnership_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigDiscovery" ADD CONSTRAINT "SquigDiscovery_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigDiscovery" ADD CONSTRAINT "SquigDiscovery_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorActivity" ADD CONSTRAINT "CollectorActivity_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorActivity" ADD CONSTRAINT "CollectorActivity_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigPassportEvent" ADD CONSTRAINT "SquigPassportEvent_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigPassportEvent" ADD CONSTRAINT "SquigPassportEvent_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CollectorActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorProgress" ADD CONSTRAINT "CollectorProgress_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigProgress" ADD CONSTRAINT "SquigProgress_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorAchievement" ADD CONSTRAINT "CollectorAchievement_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorAchievement" ADD CONSTRAINT "CollectorAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigAchievement" ADD CONSTRAINT "SquigAchievement_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigAchievement" ADD CONSTRAINT "SquigAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSetRequirement" ADD CONSTRAINT "CollectionSetRequirement_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CollectionSetDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorSetProgress" ADD CONSTRAINT "CollectorSetProgress_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorSetProgress" ADD CONSTRAINT "CollectorSetProgress_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CollectionSetDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "QuestDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
