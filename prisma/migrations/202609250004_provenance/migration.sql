-- AlterTable
-- Phase 2 adds only UglyDex-owned tables. No external databases are migrated.
ALTER TABLE "SquigDiscovery" ADD COLUMN     "attributionStatus" TEXT NOT NULL DEFAULT 'OBSERVED',
ADD COLUMN     "firstOwnershipPeriod" TEXT;

-- AlterTable
ALTER TABLE "ChainCursor" ADD COLUMN     "finalizedBlock" BIGINT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3),
ADD COLUMN     "startBlock" BIGINT;

-- CreateTable
CREATE TABLE "ChainBlock" (
    "chainId" INTEGER NOT NULL,
    "number" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainBlock_pkey" PRIMARY KEY ("chainId","number")
);

-- CreateTable
CREATE TABLE "NftTransfer" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "squigId" UUID NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "transactionIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NftTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletOwnershipPeriod" (
    "id" TEXT NOT NULL,
    "squigId" UUID NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "lostAt" TIMESTAMP(3),
    "acquisitionEvent" TEXT NOT NULL,
    "lossEvent" TEXT,

    CONSTRAINT "WalletOwnershipPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalIdentityAttribution" (
    "id" UUID NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "collectorId" UUID NOT NULL,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "walletAddress" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "evidence" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalIdentityAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectorOwnershipPeriod" (
    "id" TEXT NOT NULL,
    "squigId" UUID NOT NULL,
    "collectorId" UUID NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "lostAt" TIMESTAMP(3),
    "evidenceIds" TEXT[],
    "walletAddresses" TEXT[],
    "acquisitionEvent" TEXT NOT NULL,
    "lossEvent" TEXT,

    CONSTRAINT "CollectorOwnershipPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigProvenance" (
    "squigId" UUID NOT NULL,
    "dirty" BOOLEAN NOT NULL DEFAULT true,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "mintAt" TIMESTAMP(3),
    "minter" TEXT,
    "mintTransaction" TEXT,
    "mintBlock" BIGINT,
    "currentWallet" TEXT,
    "currentSince" TIMESTAMP(3),
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueWallets" INTEGER NOT NULL DEFAULT 0,
    "longestHoldSeconds" BIGINT,
    "derivedThrough" BIGINT,
    "verifiedAt" TIMESTAMP(3),
    "ownerMatches" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquigProvenance_pkey" PRIMARY KEY ("squigId")
);

-- CreateTable
CREATE TABLE "ReconciliationDecision" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NftTransfer_squigId_blockNumber_logIndex_idx" ON "NftTransfer"("squigId", "blockNumber", "logIndex");

-- CreateIndex
CREATE INDEX "NftTransfer_squigId_eventAt_idx" ON "NftTransfer"("squigId", "eventAt");

-- CreateIndex
CREATE INDEX "NftTransfer_fromAddress_eventAt_idx" ON "NftTransfer"("fromAddress", "eventAt");

-- CreateIndex
CREATE INDEX "NftTransfer_toAddress_eventAt_idx" ON "NftTransfer"("toAddress", "eventAt");

-- CreateIndex
CREATE INDEX "NftTransfer_blockNumber_idx" ON "NftTransfer"("blockNumber");

-- CreateIndex
CREATE INDEX "NftTransfer_transactionHash_idx" ON "NftTransfer"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "NftTransfer_chainId_transactionHash_logIndex_key" ON "NftTransfer"("chainId", "transactionHash", "logIndex");

-- CreateIndex
CREATE INDEX "WalletOwnershipPeriod_squigId_acquiredAt_idx" ON "WalletOwnershipPeriod"("squigId", "acquiredAt");

-- CreateIndex
CREATE INDEX "WalletOwnershipPeriod_walletAddress_acquiredAt_idx" ON "WalletOwnershipPeriod"("walletAddress", "acquiredAt");

-- CreateIndex
CREATE INDEX "WalletOwnershipPeriod_squigId_lostAt_idx" ON "WalletOwnershipPeriod"("squigId", "lostAt");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalIdentityAttribution_sourceKey_key" ON "HistoricalIdentityAttribution"("sourceKey");

-- CreateIndex
CREATE INDEX "HistoricalIdentityAttribution_walletAddress_effectiveFrom_e_idx" ON "HistoricalIdentityAttribution"("walletAddress", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HistoricalIdentityAttribution_collectorId_status_idx" ON "HistoricalIdentityAttribution"("collectorId", "status");

-- CreateIndex
CREATE INDEX "CollectorOwnershipPeriod_squigId_acquiredAt_idx" ON "CollectorOwnershipPeriod"("squigId", "acquiredAt");

-- CreateIndex
CREATE INDEX "CollectorOwnershipPeriod_collectorId_acquiredAt_idx" ON "CollectorOwnershipPeriod"("collectorId", "acquiredAt");

-- CreateIndex
CREATE INDEX "CollectorOwnershipPeriod_collectorId_lostAt_idx" ON "CollectorOwnershipPeriod"("collectorId", "lostAt");

-- CreateIndex
CREATE INDEX "SquigProvenance_dirty_complete_idx" ON "SquigProvenance"("dirty", "complete");

-- CreateIndex
CREATE INDEX "ReconciliationDecision_caseId_createdAt_idx" ON "ReconciliationDecision"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "IdentityReconciliation_status_createdAt_idx" ON "IdentityReconciliation"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "NftTransfer" ADD CONSTRAINT "NftTransfer_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletOwnershipPeriod" ADD CONSTRAINT "WalletOwnershipPeriod_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalIdentityAttribution" ADD CONSTRAINT "HistoricalIdentityAttribution_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorOwnershipPeriod" ADD CONSTRAINT "CollectorOwnershipPeriod_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorOwnershipPeriod" ADD CONSTRAINT "CollectorOwnershipPeriod_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigProvenance" ADD CONSTRAINT "SquigProvenance_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDecision" ADD CONSTRAINT "ReconciliationDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IdentityReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NftTransfer" ADD CONSTRAINT "NftTransfer_normalized" CHECK (
  "chainId" = 1 AND "tokenId" BETWEEN 1 AND 4444 AND "blockNumber" >= 0 AND "logIndex" >= 0 AND "transactionIndex" >= 0
  AND "fromAddress" ~ '^0x[0-9a-f]{40}$' AND "toAddress" ~ '^0x[0-9a-f]{40}$'
  AND "transactionHash" ~ '^0x[0-9a-f]{64}$' AND "blockHash" ~ '^0x[0-9a-f]{64}$');
ALTER TABLE "HistoricalIdentityAttribution" ADD CONSTRAINT "Attribution_interval" CHECK (
  "chainId"=1 AND "walletAddress" ~ '^0x[0-9a-f]{40}$' AND ("effectiveTo" IS NULL OR "effectiveTo">"effectiveFrom")
  AND "status" IN ('VERIFIED','REVIEWED','REVOKED','UNCONFIRMED','INFERRED','CONFLICTING','REJECTED','INVALIDATED'));
ALTER TABLE "WalletOwnershipPeriod" ADD CONSTRAINT "WalletPeriod_interval" CHECK ("lostAt" IS NULL OR "lostAt">="acquiredAt");
ALTER TABLE "CollectorOwnershipPeriod" ADD CONSTRAINT "CollectorPeriod_interval" CHECK ("lostAt" IS NULL OR "lostAt">="acquiredAt");
CREATE UNIQUE INDEX "WalletPeriod_one_open" ON "WalletOwnershipPeriod" ("squigId") WHERE "lostAt" IS NULL;
CREATE UNIQUE INDEX "CollectorPeriod_one_open" ON "CollectorOwnershipPeriod" ("squigId") WHERE "lostAt" IS NULL;
