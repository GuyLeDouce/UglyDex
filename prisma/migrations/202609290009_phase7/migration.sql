-- CreateEnum
CREATE TYPE "CollectibleStatus" AS ENUM ('DRAFT', 'VERIFIED', 'RETIRED');

-- AlterTable
ALTER TABLE "CollectorGalleryItem" ADD COLUMN     "customId" UUID;

-- CreateTable
CREATE TABLE "WorkerControl" (
    "service" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'DISABLED',
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerControl_pkey" PRIMARY KEY ("service")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "service" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "lockHeld" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "runId" TEXT,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("service","instanceId")
);

-- CreateTable
CREATE TABLE "ProductionStage" (
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runId" TEXT,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStage_pkey" PRIMARY KEY ("stage")
);

-- CreateTable
CREATE TABLE "OperationalAudit" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectibleArtwork" (
    "id" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectibleArtwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigCustom" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "squigId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "artist" TEXT,
    "issuedAt" TIMESTAMP(3),
    "status" "CollectibleStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquigCustom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigDisplayPreference" (
    "collectorId" UUID NOT NULL,
    "squigId" UUID NOT NULL,
    "customId" UUID,
    "ownershipKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquigDisplayPreference_pkey" PRIMARY KEY ("collectorId","squigId")
);

-- CreateTable
CREATE TABLE "SquigEdition" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "artist" TEXT,
    "issuedAt" TIMESTAMP(3),
    "supply" INTEGER,
    "status" "CollectibleStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "standard" TEXT NOT NULL DEFAULT 'NONE',
    "chainId" INTEGER,
    "contractAddress" TEXT,
    "tokenId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquigEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquigEditionRelation" (
    "editionId" UUID NOT NULL,
    "squigId" UUID NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'ASSOCIATED_CHARACTER',

    CONSTRAINT "SquigEditionRelation_pkey" PRIMARY KEY ("editionId","squigId")
);

-- CreateTable
CREATE TABLE "EditionOwnership" (
    "editionId" UUID NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editionRevision" INTEGER NOT NULL,

    CONSTRAINT "EditionOwnership_pkey" PRIMARY KEY ("editionId","walletAddress")
);

-- CreateTable
CREATE TABLE "CollectibleAudit" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectibleAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticDefinition" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "requirement" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CosmeticDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticEntitlement" (
    "collectorId" UUID NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CosmeticEntitlement_pkey" PRIMARY KEY ("collectorId","cosmeticId")
);

-- CreateTable
CREATE TABLE "CollectorCosmeticPreference" (
    "collectorId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorCosmeticPreference_pkey" PRIMARY KEY ("collectorId","kind")
);

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_lastHeartbeat_idx" ON "WorkerHeartbeat"("lastHeartbeat");

-- CreateIndex
CREATE INDEX "OperationalAudit_createdAt_idx" ON "OperationalAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectibleArtwork_uri_key" ON "CollectibleArtwork"("uri");

-- CreateIndex
CREATE UNIQUE INDEX "SquigCustom_key_key" ON "SquigCustom"("key");

-- CreateIndex
CREATE INDEX "SquigCustom_squigId_status_sortOrder_idx" ON "SquigCustom"("squigId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SquigEdition_slug_key" ON "SquigEdition"("slug");

-- CreateIndex
CREATE INDEX "SquigEdition_status_issuedAt_idx" ON "SquigEdition"("status", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SquigEdition_chainId_contractAddress_tokenId_key" ON "SquigEdition"("chainId", "contractAddress", "tokenId");

-- CreateIndex
CREATE INDEX "SquigEditionRelation_squigId_idx" ON "SquigEditionRelation"("squigId");

-- CreateIndex
CREATE INDEX "EditionOwnership_walletAddress_verifiedAt_idx" ON "EditionOwnership"("walletAddress", "verifiedAt");

-- CreateIndex
CREATE INDEX "CollectibleAudit_kind_entityId_createdAt_idx" ON "CollectibleAudit"("kind", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "CollectorGalleryItem" ADD CONSTRAINT "CollectorGalleryItem_customId_fkey" FOREIGN KEY ("customId") REFERENCES "SquigCustom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigCustom" ADD CONSTRAINT "SquigCustom_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigCustom" ADD CONSTRAINT "SquigCustom_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "CollectibleArtwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigDisplayPreference" ADD CONSTRAINT "SquigDisplayPreference_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigDisplayPreference" ADD CONSTRAINT "SquigDisplayPreference_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigDisplayPreference" ADD CONSTRAINT "SquigDisplayPreference_customId_fkey" FOREIGN KEY ("customId") REFERENCES "SquigCustom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigEdition" ADD CONSTRAINT "SquigEdition_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "CollectibleArtwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigEditionRelation" ADD CONSTRAINT "SquigEditionRelation_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "SquigEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquigEditionRelation" ADD CONSTRAINT "SquigEditionRelation_squigId_fkey" FOREIGN KEY ("squigId") REFERENCES "Squig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionOwnership" ADD CONSTRAINT "EditionOwnership_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "SquigEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticEntitlement" ADD CONSTRAINT "CosmeticEntitlement_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CosmeticEntitlement" ADD CONSTRAINT "CosmeticEntitlement_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "CosmeticDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorCosmeticPreference" ADD CONSTRAINT "CollectorCosmeticPreference_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectorCosmeticPreference" ADD CONSTRAINT "CollectorCosmeticPreference_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "CosmeticDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
