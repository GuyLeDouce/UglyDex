-- AlterTable
ALTER TABLE "Collector" ADD COLUMN     "featuredSetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "CollectionSetDefinition" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'Medium',
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'HISTORICAL_DISCOVERY',
ADD COLUMN     "ruleset" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CollectorSetProgress" ADD COLUMN     "completionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentlyComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstCompletedAt" TIMESTAMP(3),
ADD COLUMN     "lastCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CollectionRuleset" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionRuleset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalTrait" (
    "ruleset" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "traitType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "firstToken" INTEGER NOT NULL,
    "ogCount" INTEGER NOT NULL,
    "legendaryOnly" BOOLEAN NOT NULL,

    CONSTRAINT "CanonicalTrait_pkey" PRIMARY KEY ("ruleset","key")
);

-- CreateTable
CREATE TABLE "CollectorTraitDiscovery" (
    "ruleset" TEXT NOT NULL,
    "collectorId" UUID NOT NULL,
    "traitKey" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL,
    "evidence" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CollectorTraitDiscovery_pkey" PRIMARY KEY ("ruleset","collectorId","traitKey")
);

-- CreateTable
CREATE TABLE "CollectionSnapshot" (
    "ruleset" TEXT NOT NULL,
    "collectorId" UUID NOT NULL,
    "discovered" INTEGER NOT NULL,
    "traits" INTEGER NOT NULL,
    "historicalSets" INTEGER NOT NULL,
    "currentSets" INTEGER NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "discoveredTokenIds" INTEGER[],
    "currentTokenIds" INTEGER[],
    "candidates" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionSnapshot_pkey" PRIMARY KEY ("ruleset","collectorId")
);

-- CreateTable
CREATE TABLE "CollectionAudit" (
    "id" UUID NOT NULL,
    "ruleset" TEXT NOT NULL,
    "collectorId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionMilestone" (
    "ruleset" TEXT NOT NULL,
    "collectorId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "reachedAt" TIMESTAMP(3) NOT NULL,
    "timeBasis" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CollectionMilestone_pkey" PRIMARY KEY ("ruleset","collectorId","key")
);

-- CreateTable
CREATE TABLE "CollectionJob" (
    "collectorId" UUID NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,

    CONSTRAINT "CollectionJob_pkey" PRIMARY KEY ("collectorId")
);

-- CreateTable
CREATE TABLE "CollectionReplay" (
    "id" TEXT NOT NULL,
    "cursor" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionReplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanonicalTrait_ruleset_traitType_value_idx" ON "CanonicalTrait"("ruleset", "traitType", "value");

-- CreateIndex
CREATE INDEX "CollectorTraitDiscovery_collectorId_revokedAt_idx" ON "CollectorTraitDiscovery"("collectorId", "revokedAt");

-- CreateIndex
CREATE INDEX "CollectionAudit_collectorId_createdAt_idx" ON "CollectionAudit"("collectorId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionJob_queuedAt_idx" ON "CollectionJob"("queuedAt");

-- CreateIndex
CREATE INDEX "CollectorSetProgress_setId_currentlyComplete_idx" ON "CollectorSetProgress"("setId", "currentlyComplete");
-- Durable UglyDex-only collection outbox. No external database is changed.
CREATE FUNCTION collections_enqueue(subject uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF subject IS NULL THEN RETURN; END IF;
 INSERT INTO "CollectionJob" ("collectorId") VALUES(subject)
 ON CONFLICT ("collectorId") DO UPDATE SET generation="CollectionJob".generation+1,"queuedAt"=now(),"errorCode"=NULL;
END $$;
CREATE FUNCTION collections_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb; o jsonb; r record; sid uuid;
BEGIN
 IF TG_OP<>'DELETE' THEN n=to_jsonb(NEW); END IF;
 IF TG_OP<>'INSERT' THEN o=to_jsonb(OLD); END IF;
 IF TG_OP='UPDATE' AND n=o THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME IN ('SquigDiscovery','CollectorOwnershipPeriod','CollectorWallet','HistoricalIdentityAttribution') THEN
  PERFORM collections_enqueue((n->>'collectorId')::uuid);
  PERFORM collections_enqueue((o->>'collectorId')::uuid);
 ELSIF TG_TABLE_NAME='Collector' THEN
  PERFORM collections_enqueue((n->>'id')::uuid);
 ELSIF TG_TABLE_NAME IN ('Squig','SquigTrait') THEN
  -- Metadata changes alter all candidate hints, including collectors who lack this token.
  FOR r IN SELECT id FROM "Collector" LOOP PERFORM collections_enqueue(r.id); END LOOP;
 ELSE
  sid=COALESCE(n->>'squigId',o->>'squigId')::uuid;
  FOR r IN SELECT "collectorId" FROM "SquigDiscovery" WHERE "squigId"=sid
   UNION SELECT "collectorId" FROM "CollectorOwnershipPeriod" WHERE "squigId"=sid
   UNION SELECT w."collectorId" FROM "CollectorWallet" w JOIN "SquigOwnership" s ON s."walletAddress"=w."walletAddress" WHERE s."squigId"=sid
   UNION SELECT "collectorId" FROM "CollectorWallet" WHERE "walletAddress" IN (n->>'walletAddress',o->>'walletAddress')
  LOOP PERFORM collections_enqueue(r."collectorId"); END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER collections_collector AFTER INSERT ON "Collector" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_wallet AFTER INSERT OR UPDATE OR DELETE ON "CollectorWallet" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_discovery AFTER INSERT OR UPDATE OR DELETE ON "SquigDiscovery" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_period AFTER INSERT OR UPDATE OR DELETE ON "CollectorOwnershipPeriod" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_attribution AFTER INSERT OR UPDATE OR DELETE ON "HistoricalIdentityAttribution" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_ownership AFTER INSERT OR UPDATE OR DELETE ON "SquigOwnership" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_provenance AFTER INSERT OR UPDATE OR DELETE ON "SquigProvenance" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_squig AFTER INSERT OR UPDATE OR DELETE ON "Squig" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_trait AFTER INSERT OR UPDATE OR DELETE ON "SquigTrait" FOR EACH ROW EXECUTE FUNCTION collections_changed();
CREATE TRIGGER collections_maw AFTER INSERT OR UPDATE OR DELETE ON "CollectorActivity" FOR EACH ROW EXECUTE FUNCTION collections_changed();
ALTER TABLE "CollectionSnapshot" ADD CONSTRAINT collection_score_range CHECK(overall>=0 AND overall<=100);

ALTER TABLE "CollectionSnapshot" ADD COLUMN "traitCounts" JSONB NOT NULL DEFAULT '{}';
