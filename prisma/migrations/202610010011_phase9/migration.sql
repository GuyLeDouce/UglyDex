CREATE TABLE "LaunchGate" (
 "key" TEXT PRIMARY KEY,
 "status" TEXT NOT NULL,
 "environment" TEXT NOT NULL,
 "databaseFingerprint" TEXT NOT NULL,
 "commit" TEXT NOT NULL,
 "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "summary" TEXT NOT NULL,
 "evidenceHash" TEXT NOT NULL,
 "notes" TEXT NOT NULL DEFAULT '',
 CONSTRAINT "LaunchGate_status" CHECK ("status" IN ('VERIFIED','PARTIAL','PENDING','DEGRADED','FAILED'))
);
CREATE TABLE "ReplayProof" (
 "id" UUID PRIMARY KEY,
 "environment" TEXT NOT NULL,
 "commit" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "finishedAt" TIMESTAMP(3),
 "status" TEXT NOT NULL DEFAULT 'RUNNING',
 "inputHash" TEXT,
 "replayA" JSONB,
 "replayB" JSONB,
 "differences" JSONB,
 "errorCode" TEXT
);
