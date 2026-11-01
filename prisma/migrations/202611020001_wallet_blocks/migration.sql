ALTER TABLE "Collector" ADD COLUMN "walletBlockPublicPreference" BOOLEAN;
CREATE TABLE "BlockedWallet" (
  "chainId" INTEGER NOT NULL DEFAULT 1,
  "walletAddress" VARCHAR(42) NOT NULL,
  "reason" TEXT NOT NULL,
  "blockedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("chainId", "walletAddress"),
  CONSTRAINT "BlockedWallet_address_check" CHECK ("chainId" = 1 AND "walletAddress" ~ '^0x[0-9a-f]{40}$')
);
CREATE INDEX "BlockedWallet_createdAt_idx" ON "BlockedWallet"("createdAt");

-- Serialize moderation and wallet association changes. No chain ledger is changed.
CREATE FUNCTION uglydex_wallet_block_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(194731, 671);
  RETURN NULL;
END $$;
CREATE TRIGGER wallet_block_lock BEFORE INSERT OR UPDATE OR DELETE ON "BlockedWallet"
FOR EACH STATEMENT EXECUTE FUNCTION uglydex_wallet_block_lock();
CREATE TRIGGER discovered_wallet_block_lock BEFORE INSERT OR UPDATE OR DELETE ON "DiscoveredWallet"
FOR EACH STATEMENT EXECUTE FUNCTION uglydex_wallet_block_lock();
CREATE TRIGGER verified_wallet_block_lock BEFORE INSERT OR DELETE OR UPDATE OF "collectorId", "chainId", "walletAddress", status, "revokedAt" ON "CollectorWallet"
FOR EACH STATEMENT EXECUTE FUNCTION uglydex_wallet_block_lock();
CREATE TRIGGER collector_visibility_block_lock BEFORE UPDATE OF "isPublic" ON "Collector"
FOR EACH STATEMENT EXECUTE FUNCTION uglydex_wallet_block_lock();

-- isPublic remains the effective visibility consumed by all public routes,
-- feeds, rankings and share cards. Keep the owner's preference separately.
CREATE FUNCTION uglydex_enforce_wallet_block() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "BlockedWallet" b WHERE
      EXISTS (SELECT 1 FROM "DiscoveredWallet" d WHERE d."collectorId"=NEW.id
        AND d."chainId"=b."chainId" AND d."walletAddress"=b."walletAddress")
      OR EXISTS (SELECT 1 FROM "CollectorWallet" w WHERE w."collectorId"=NEW.id
        AND w."chainId"=b."chainId" AND w."walletAddress"=b."walletAddress"
        AND w.status='ACTIVE' AND w."revokedAt" IS NULL)
  ) THEN
    NEW."walletBlockPublicPreference" := NEW."isPublic";
    NEW."isPublic" := false;
  ELSE
    NEW."walletBlockPublicPreference" := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collector_visibility_wallet_block BEFORE UPDATE OF "isPublic" ON "Collector"
FOR EACH ROW EXECUTE FUNCTION uglydex_enforce_wallet_block();

CREATE FUNCTION uglydex_refresh_wallet_block() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_collector uuid; new_collector uuid; address text; chain integer;
BEGIN
  IF TG_TABLE_NAME='BlockedWallet' THEN
    IF TG_OP='DELETE' THEN
      address := OLD."walletAddress"; chain := OLD."chainId";
    ELSE
      address := NEW."walletAddress"; chain := NEW."chainId";
    END IF;
    UPDATE "Collector" c SET "isPublic"=COALESCE(c."walletBlockPublicPreference", c."isPublic"), "updatedAt"=CURRENT_TIMESTAMP
    WHERE EXISTS (SELECT 1 FROM "DiscoveredWallet" d WHERE d."collectorId"=c.id AND d."walletAddress"=address AND d."chainId"=chain)
       OR EXISTS (SELECT 1 FROM "CollectorWallet" w WHERE w."collectorId"=c.id AND w."walletAddress"=address AND w."chainId"=chain);
  ELSE
    IF TG_OP<>'INSERT' THEN old_collector := OLD."collectorId"; END IF;
    IF TG_OP<>'DELETE' THEN new_collector := NEW."collectorId"; END IF;
    UPDATE "Collector" c SET "isPublic"=COALESCE(c."walletBlockPublicPreference", c."isPublic"), "updatedAt"=CURRENT_TIMESTAMP
    WHERE c.id=old_collector OR c.id=new_collector;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER refresh_blocked_wallet_visibility AFTER INSERT OR DELETE ON "BlockedWallet"
FOR EACH ROW EXECUTE FUNCTION uglydex_refresh_wallet_block();
CREATE TRIGGER refresh_discovered_wallet_visibility AFTER INSERT OR UPDATE OR DELETE ON "DiscoveredWallet"
FOR EACH ROW EXECUTE FUNCTION uglydex_refresh_wallet_block();
CREATE TRIGGER refresh_verified_wallet_visibility AFTER INSERT OR DELETE OR UPDATE OF "collectorId", "chainId", "walletAddress", status, "revokedAt" ON "CollectorWallet"
FOR EACH ROW EXECUTE FUNCTION uglydex_refresh_wallet_block();
