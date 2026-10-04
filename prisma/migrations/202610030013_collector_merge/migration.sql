ALTER TABLE "Collector" ADD COLUMN "mergedIntoCollectorId" UUID;
ALTER TABLE "AuthSession" ADD COLUMN "authMethod" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN "credentialFingerprint" TEXT;

CREATE TABLE "CollectorMergeRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "survivorCollectorId" UUID NOT NULL,
    "absorbedCollectorId" UUID NOT NULL,
    "credentialType" TEXT NOT NULL,
    "credentialFingerprint" TEXT NOT NULL,
    "survivorCredentialType" TEXT NOT NULL,
    "survivorCredentialFingerprint" TEXT NOT NULL,
    "reviewKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectorMergeRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CollectorMergeRequest_survivorCollectorId_fkey" FOREIGN KEY ("survivorCollectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollectorMergeRequest_absorbedCollectorId_fkey" FOREIGN KEY ("absorbedCollectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CollectorMergeRequest_reviewKey_key"
ON "CollectorMergeRequest"("reviewKey");
CREATE INDEX "CollectorMergeRequest_survivorCollectorId_status_expiresAt_idx"
ON "CollectorMergeRequest"("survivorCollectorId", "status", "expiresAt");
