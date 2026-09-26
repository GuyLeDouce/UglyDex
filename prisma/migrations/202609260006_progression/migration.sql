-- AlterTable
ALTER TABLE "Collector" ADD COLUMN     "featuredAchievementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "selectedTitleId" TEXT;

-- AlterTable
ALTER TABLE "AchievementDefinition" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ruleset" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subjectType" TEXT NOT NULL DEFAULT 'COLLECTOR',
ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'Common',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "CollectorAchievement" ADD COLUMN     "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gateSatisfied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SquigAchievement" ADD COLUMN     "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gateSatisfied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProgressionRuleset" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionRuleset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpLedgerEntry" (
    "id" TEXT NOT NULL,
    "ruleset" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "ruleId" TEXT NOT NULL,
    "grantKey" TEXT NOT NULL,
    "sourceActivityId" TEXT,
    "xp" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "XpLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionAudit" (
    "id" UUID NOT NULL,
    "ruleset" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionJob" (
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,

    CONSTRAINT "ProgressionJob_pkey" PRIMARY KEY ("subjectType","subjectId")
);

-- CreateTable
CREATE TABLE "ProgressionMilestone" (
    "ruleset" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "reachedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionMilestone_pkey" PRIMARY KEY ("ruleset","subjectType","subjectId","level")
);

-- CreateTable
CREATE TABLE "ProgressionReplay" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'COLLECTOR',
    "cursor" TEXT,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionReplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XpLedgerEntry_ruleset_subjectType_subjectId_revokedAt_idx" ON "XpLedgerEntry"("ruleset", "subjectType", "subjectId", "revokedAt");

-- CreateIndex
CREATE INDEX "XpLedgerEntry_sourceActivityId_idx" ON "XpLedgerEntry"("sourceActivityId");

-- CreateIndex
CREATE INDEX "XpLedgerEntry_ruleId_idx" ON "XpLedgerEntry"("ruleId");

-- CreateIndex
CREATE INDEX "ProgressionAudit_subjectType_subjectId_createdAt_idx" ON "ProgressionAudit"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgressionJob_queuedAt_idx" ON "ProgressionJob"("queuedAt");

-- All triggers write only UglyDex-owned state. A transactionally durable outbox.
CREATE FUNCTION progression_enqueue(kind text, subject uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF subject IS NULL THEN RETURN; END IF;
 INSERT INTO "ProgressionJob" ("subjectType","subjectId") VALUES(kind,subject)
 ON CONFLICT ("subjectType","subjectId") DO UPDATE SET generation="ProgressionJob".generation+1,"queuedAt"=now(),"errorCode"=NULL;
END $$;
CREATE FUNCTION progression_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rowdata jsonb; olddata jsonb; sid uuid; r record;
BEGIN
 IF TG_OP<>'DELETE' THEN rowdata=to_jsonb(NEW); END IF;
 IF TG_OP<>'INSERT' THEN olddata=to_jsonb(OLD); END IF;
 IF TG_TABLE_NAME IN ('CollectorActivity','SquigDiscovery','CollectorOwnershipPeriod') THEN
  PERFORM progression_enqueue('COLLECTOR',(rowdata->>'collectorId')::uuid);
  PERFORM progression_enqueue('COLLECTOR',(olddata->>'collectorId')::uuid);
  PERFORM progression_enqueue('SQUIG',(rowdata->>'squigId')::uuid);
  PERFORM progression_enqueue('SQUIG',(olddata->>'squigId')::uuid);
  IF TG_TABLE_NAME='CollectorActivity' AND COALESCE(rowdata->>'category',olddata->>'category')='CREATOR' THEN
   FOR r IN SELECT DISTINCT "collectorId" FROM "CollectorActivity" WHERE "sourceType"='liveImages' AND (metadata->>'imageKey'=rowdata->'metadata'->>'imageKey' OR metadata->>'imageKey'=olddata->'metadata'->>'imageKey' OR "sourceId"=rowdata->'metadata'->>'liveImageId' OR "sourceId"=olddata->'metadata'->>'liveImageId') LOOP
    PERFORM progression_enqueue('COLLECTOR',r."collectorId");
   END LOOP;
  END IF;
 ELSIF TG_TABLE_NAME IN ('Squig','SquigProvenance') THEN
  sid=COALESCE(rowdata->>'squigId',rowdata->>'id',olddata->>'squigId',olddata->>'id')::uuid;
  PERFORM progression_enqueue('SQUIG',sid);
  FOR r IN SELECT "collectorId" FROM "SquigDiscovery" WHERE "squigId"=sid LOOP PERFORM progression_enqueue('COLLECTOR',r."collectorId"); END LOOP;
 ELSIF TG_TABLE_NAME='ActivityAttributionJob' THEN
  FOR r IN SELECT DISTINCT "collectorId" FROM "CollectorActivity" WHERE "walletAddress"=COALESCE(rowdata->>'walletAddress',olddata->>'walletAddress') AND "discordId" IS NULL LOOP PERFORM progression_enqueue('COLLECTOR',r."collectorId"); END LOOP;
 ELSIF TG_TABLE_NAME='Collector' THEN
  PERFORM progression_enqueue('COLLECTOR',(rowdata->>'id')::uuid);
 ELSIF TG_TABLE_NAME='IntegrationSource' THEN
  IF TG_OP='UPDATE' AND rowdata->>'state'=olddata->>'state' THEN RETURN NULL; END IF;
  INSERT INTO "ProgressionJob" ("subjectType","subjectId") SELECT 'COLLECTOR',id FROM "Collector" UNION ALL SELECT 'SQUIG',id FROM "Squig"
  ON CONFLICT ("subjectType","subjectId") DO UPDATE SET generation="ProgressionJob".generation+1,"queuedAt"=now();
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER progression_activity AFTER INSERT OR UPDATE OR DELETE ON "CollectorActivity" FOR EACH ROW EXECUTE FUNCTION progression_changed();
CREATE TRIGGER progression_discovery AFTER INSERT OR UPDATE OR DELETE ON "SquigDiscovery" FOR EACH ROW EXECUTE FUNCTION progression_changed();
CREATE TRIGGER progression_period AFTER INSERT OR UPDATE OR DELETE ON "CollectorOwnershipPeriod" FOR EACH ROW EXECUTE FUNCTION progression_changed();
CREATE TRIGGER progression_squig AFTER INSERT OR UPDATE OR DELETE ON "Squig" FOR EACH ROW EXECUTE FUNCTION progression_changed();
CREATE TRIGGER progression_provenance AFTER INSERT OR UPDATE OR DELETE ON "SquigProvenance" FOR EACH ROW EXECUTE FUNCTION progression_changed();
CREATE TRIGGER progression_attribution AFTER INSERT OR UPDATE OR DELETE ON "ActivityAttributionJob" FOR EACH ROW EXECUTE FUNCTION progression_changed();
CREATE TRIGGER progression_source AFTER INSERT OR UPDATE OR DELETE ON "IntegrationSource" FOR EACH ROW EXECUTE FUNCTION progression_changed();
CREATE TRIGGER progression_collector AFTER INSERT ON "Collector" FOR EACH ROW EXECUTE FUNCTION progression_changed();
ALTER TABLE "XpLedgerEntry" ADD CONSTRAINT positive_xp CHECK(xp>0), ADD CONSTRAINT xp_subject CHECK("subjectType" IN ('COLLECTOR','SQUIG'));
CREATE UNIQUE INDEX active_xp_grant ON "XpLedgerEntry" (ruleset,"subjectType","subjectId","grantKey") WHERE "revokedAt" IS NULL;
ALTER TABLE "CollectorAchievement" ALTER COLUMN "awardedAt" DROP NOT NULL, ALTER COLUMN "awardedAt" DROP DEFAULT;
ALTER TABLE "SquigAchievement" ALTER COLUMN "awardedAt" DROP NOT NULL, ALTER COLUMN "awardedAt" DROP DEFAULT;
CREATE INDEX "CollectorActivity_collectorId_id_idx" ON "CollectorActivity"("collectorId",id);
CREATE INDEX "CollectorActivity_squigId_id_idx" ON "CollectorActivity"("squigId",id);
CREATE INDEX "ProgressionAudit_ruleset_kind_idx" ON "ProgressionAudit"(ruleset,kind);
CREATE INDEX "AchievementDefinition_ruleset_subjectType_idx" ON "AchievementDefinition"(ruleset,"subjectType");
CREATE INDEX "CollectorAchievement_achievementId_revokedAt_idx" ON "CollectorAchievement"("achievementId","revokedAt");
CREATE INDEX "SquigAchievement_achievementId_revokedAt_idx" ON "SquigAchievement"("achievementId","revokedAt");
