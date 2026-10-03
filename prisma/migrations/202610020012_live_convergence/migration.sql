-- AlterTable
ALTER TABLE "Collector" ADD COLUMN     "showCharmBalance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReplayProof" ADD COLUMN     "configurationHash" TEXT,
ADD COLUMN     "databaseFingerprint" TEXT;

-- CreateTable
CREATE TABLE "LiveDerivationProof" (
    "id" UUID NOT NULL,
    "frozenProofId" UUID NOT NULL,
    "environment" TEXT NOT NULL,
    "databaseFingerprint" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "derived" JSONB NOT NULL,
    "configurationHash" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "queues" JSONB NOT NULL,
    "checks" JSONB NOT NULL,

    CONSTRAINT "LiveDerivationProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DripIdentity" (
    "id" UUID NOT NULL,
    "collectorId" UUID NOT NULL,
    "realmId" TEXT NOT NULL,
    "dripMemberId" TEXT,
    "realmMemberId" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'EXACT_DISCORD_CREDENTIAL',
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastResolvedAt" TIMESTAMP(3),

    CONSTRAINT "DripIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmBalance" (
    "collectorId" UUID NOT NULL,
    "realmId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "dripIdentityId" UUID NOT NULL,
    "balance" DECIMAL(65,18),
    "observedAt" TIMESTAMP(3),
    "lastApiSuccessAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "CharmBalance_pkey" PRIMARY KEY ("collectorId","realmId","currencyId")
);

-- CreateTable
CREATE TABLE "DripSyncState" (
    "realmId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "alignment" JSONB,
    "alignmentHash" TEXT,
    "alignmentAt" TIMESTAMP(3),
    "alignmentCommit" TEXT,
    "lastFullSweep" TIMESTAMP(3),
    "nextSweepAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sweepStartedAt" TIMESTAMP(3),
    "memberCursor" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "last429At" TIMESTAMP(3),
    "nextRequestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" TEXT NOT NULL,
    "monthRequests" INTEGER NOT NULL DEFAULT 0,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "total429" INTEGER NOT NULL DEFAULT 0,
    "minimumRemaining" INTEGER,
    "lastRateLimit" JSONB,
    "errorCode" TEXT,

    CONSTRAINT "DripSyncState_pkey" PRIMARY KEY ("realmId")
);

-- CreateTable
CREATE TABLE "CharmRefreshRequest" (
    "collectorId" UUID NOT NULL,
    "realmId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextUserRequestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pending" BOOLEAN NOT NULL DEFAULT true,
    "generation" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CharmRefreshRequest_pkey" PRIMARY KEY ("realmId","collectorId")
);

-- CreateTable
CREATE TABLE "CharmDirtyNonce" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharmDirtyNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveDerivationProof_capturedAt_idx" ON "LiveDerivationProof"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DripIdentity_realmId_collectorId_key" ON "DripIdentity"("realmId", "collectorId");

-- CreateIndex
CREATE UNIQUE INDEX "DripIdentity_realmId_dripMemberId_key" ON "DripIdentity"("realmId", "dripMemberId");

-- CreateIndex
CREATE INDEX "CharmRefreshRequest_realmId_pending_requestedAt_idx" ON "CharmRefreshRequest"("realmId", "pending", "requestedAt");

-- CreateIndex
CREATE INDEX "CharmDirtyNonce_expiresAt_idx" ON "CharmDirtyNonce"("expiresAt");

-- AddForeignKey
ALTER TABLE "LiveDerivationProof" ADD CONSTRAINT "LiveDerivationProof_frozenProofId_fkey" FOREIGN KEY ("frozenProofId") REFERENCES "ReplayProof"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DripIdentity" ADD CONSTRAINT "DripIdentity_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmBalance" ADD CONSTRAINT "CharmBalance_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmBalance" ADD CONSTRAINT "CharmBalance_dripIdentityId_fkey" FOREIGN KEY ("dripIdentityId") REFERENCES "DripIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
