-- DropForeignKey
ALTER TABLE "CollectorActivity" DROP CONSTRAINT "CollectorActivity_collectorId_fkey";

-- AlterTable
ALTER TABLE "CollectorActivity" ADD COLUMN     "amount" DECIMAL(30,8),
ADD COLUMN     "attributionStatus" TEXT NOT NULL DEFAULT 'RESOLVED',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "direction" TEXT,
ADD COLUMN     "discordId" TEXT,
ADD COLUMN     "importance" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "recordStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "sourceCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "walletAddress" TEXT,
ALTER COLUMN "collectorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "cursorEnd" JSONB,
ADD COLUMN     "cursorStart" JSONB,
ADD COLUMN     "errorCode" TEXT;

-- CreateTable
CREATE TABLE "ActivityCorrection" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "afterHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSource" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'UNVALIDATED',
    "schemaFingerprint" TEXT,
    "schemaValid" BOOLEAN,
    "cursor" JSONB,
    "reconcileCursor" JSONB,
    "firstAvailableAt" TIMESTAMP(3),
    "lastAvailableAt" TIMESTAMP(3),
    "importedThrough" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "backfillFinishedAt" TIMESTAMP(3),
    "warning" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRejection" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "runId" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRejection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAttributionJob" (
    "walletAddress" TEXT NOT NULL,
    "cursor" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAttributionJob_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateIndex
CREATE INDEX "ActivityCorrection_activityId_createdAt_idx" ON "ActivityCorrection"("activityId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRejection_source_resolvedAt_idx" ON "ImportRejection"("source", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRejection_source_sourceRecordId_key" ON "ImportRejection"("source", "sourceRecordId");

-- CreateIndex
CREATE INDEX "CollectorActivity_squigId_eventAt_id_idx" ON "CollectorActivity"("squigId", "eventAt", "id");

-- CreateIndex
CREATE INDEX "CollectorActivity_collectorId_category_eventAt_id_idx" ON "CollectorActivity"("collectorId", "category", "eventAt", "id");

-- CreateIndex
CREATE INDEX "CollectorActivity_sourceSystem_sourceType_sourceId_idx" ON "CollectorActivity"("sourceSystem", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CollectorActivity_sourceSystem_eventAt_idx" ON "CollectorActivity"("sourceSystem", "eventAt");

-- CreateIndex
CREATE INDEX "CollectorActivity_eventType_eventAt_idx" ON "CollectorActivity"("eventType", "eventAt");

-- CreateIndex
CREATE INDEX "CollectorActivity_attributionStatus_eventAt_idx" ON "CollectorActivity"("attributionStatus", "eventAt");

-- CreateIndex
CREATE INDEX "CollectorActivity_discordId_idx" ON "CollectorActivity"("discordId");

-- CreateIndex
CREATE INDEX "CollectorActivity_walletAddress_idx" ON "CollectorActivity"("walletAddress");

-- CreateIndex
CREATE INDEX "SyncRun_source_startedAt_idx" ON "SyncRun"("source", "startedAt");

-- AddForeignKey
ALTER TABLE "CollectorActivity" ADD CONSTRAINT "CollectorActivity_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCorrection" ADD CONSTRAINT "ActivityCorrection_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CollectorActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Native invariants; never applied to an external datasource.
ALTER TABLE "CollectorActivity" ADD CONSTRAINT "activity_amount_nonnegative" CHECK (amount IS NULL OR amount >= 0);
ALTER TABLE "CollectorActivity" ADD CONSTRAINT "activity_wallet_normalized" CHECK ("walletAddress" IS NULL OR "walletAddress" ~ '^0x[0-9a-f]{40}$');
CREATE INDEX "activity_live_image_reference" ON "CollectorActivity" ((metadata->>'liveImageId')) WHERE "sourceType"='submissions';
CREATE INDEX "activity_image_url" ON "CollectorActivity" ((metadata->>'imageUrl')) WHERE "sourceType" IN ('imageUses','liveImages','submissions');
UPDATE "CollectorActivity" SET "visibility"='PUBLIC', category='SQUIGS' WHERE "sourceSystem"='provenance';
UPDATE "CollectorActivity" SET "discordId"=substring("subjectKey" from 9) WHERE "subjectKey" ~ '^discord:[0-9]{17,20}$';
CREATE INDEX "activity_image_key" ON "CollectorActivity" ((metadata->>'imageKey')) WHERE "sourceType" IN ('liveImages','submissions');
