-- CreateTable
CREATE TABLE "DeploymentIdentity" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "databaseFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionContract" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startBlock" BIGINT NOT NULL,
    "tokenIds" TEXT[],
    "sourceReference" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "startHash" TEXT,
    "cursor" BIGINT,
    "cursorHash" TEXT,
    "finalizedBlock" BIGINT,
    "lastSuccessAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionTransfer" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "batchIndex" INTEGER NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionBalance" (
    "contractId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "maximumQuantity" TEXT NOT NULL,
    "firstAcquiredAt" TIMESTAMP(3) NOT NULL,
    "lastAcquiredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionBalance_pkey" PRIMARY KEY ("contractId","tokenId","walletAddress")
);

-- CreateTable
CREATE TABLE "EditionCheckpoint" (
    "contractId" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,

    CONSTRAINT "EditionCheckpoint_pkey" PRIMARY KEY ("contractId","blockNumber")
);

-- CreateTable
CREATE TABLE "OperationalMetric" (
    "bucket" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OperationalMetric_pkey" PRIMARY KEY ("bucket","kind")
);

-- CreateIndex
CREATE UNIQUE INDEX "EditionContract_chainId_address_key" ON "EditionContract"("chainId", "address");

-- CreateIndex
CREATE INDEX "EditionTransfer_contractId_blockNumber_logIndex_batchIndex_idx" ON "EditionTransfer"("contractId", "blockNumber", "logIndex", "batchIndex");

-- CreateIndex
CREATE INDEX "EditionTransfer_contractId_tokenId_eventAt_idx" ON "EditionTransfer"("contractId", "tokenId", "eventAt");

-- CreateIndex
CREATE INDEX "EditionBalance_walletAddress_idx" ON "EditionBalance"("walletAddress");

-- AddForeignKey
ALTER TABLE "EditionTransfer" ADD CONSTRAINT "EditionTransfer_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "EditionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionBalance" ADD CONSTRAINT "EditionBalance_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "EditionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionCheckpoint" ADD CONSTRAINT "EditionCheckpoint_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "EditionContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
