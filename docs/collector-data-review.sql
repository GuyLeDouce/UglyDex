-- Read-only aggregate triage. Candidates are NOT proof of incorrect attribution.
-- Use a read-only database role; do not attach raw identity records to public issues.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

-- Older unclaimed shells with personal discoveries need provenance review.
-- Any credential (including revoked credentials) excludes the shell from this
-- narrow candidate list so unlinking is not mistaken for absence of past proof.
SELECT count(*) AS discovery_rows_requiring_review,
       count(DISTINCT d."collectorId") AS collectors_requiring_review
FROM "SquigDiscovery" d
JOIN "Collector" c ON c.id = d."collectorId"
JOIN "Squig" s ON s.id = d."squigId"
WHERE d."everOwned" AND d."attributionStatus" IN ('OBSERVED', 'CONFIRMED')
  AND s."chainId" = 1
  AND s."contractAddress" = '0x8c9a02c0585200c4c65608df6b8def543d33792a'
  AND c."claimedAt" IS NULL AND c."mergedIntoCollectorId" IS NULL
  AND EXISTS (SELECT 1 FROM "DiscoveredWallet" w WHERE w."collectorId" = c.id)
  AND NOT EXISTS (SELECT 1 FROM "CollectorWallet" w WHERE w."collectorId" = c.id)
  AND NOT EXISTS (SELECT 1 FROM "ExternalIdentity" i WHERE i."collectorId" = c.id);

-- A pending job explains temporary ranking exclusion; it does not prove failure.
SELECT count(*) AS queued_collectors,
       count(*) FILTER (WHERE "errorCode" IS NOT NULL) AS jobs_with_errors,
       min("queuedAt") AS oldest_queued_at,
       max(attempts) AS highest_attempt_count
FROM "CollectionJob";

SELECT
  count(*) AS public_profiles,
  count(*) FILTER (WHERE j."collectorId" IS NOT NULL) AS pending_profiles,
  count(*) FILTER (WHERE s."collectorId" IS NULL) AS profiles_without_snapshot,
  count(*) FILTER (WHERE j."collectorId" IS NULL AND s."collectorId" IS NOT NULL)
    AS profiles_with_snapshot_and_no_pending_job
FROM "Collector" c
LEFT JOIN "CollectionJob" j ON j."collectorId" = c.id
LEFT JOIN "CollectionSnapshot" s ON s."collectorId" = c.id
  AND s.ruleset = 'uglydex-collection-v3'
WHERE c."isPublic" AND c."mergedIntoCollectorId" IS NULL;

-- Internal consistency of each materialized snapshot (not a claim about live
-- ownership freshness). Compare sets, never only array lengths.
SELECT count(*) AS internally_inconsistent_snapshots
FROM "CollectionSnapshot" s
WHERE s.ruleset = 'uglydex-collection-v3' AND (
  s.discovered <> (SELECT count(DISTINCT token) FROM unnest(s."discoveredTokenIds") token)
  OR NOT (s."currentTokenIds" <@ s."discoveredTokenIds")
);
ROLLBACK;
