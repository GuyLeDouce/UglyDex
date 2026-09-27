-- Reviewed Phase 11 provisioning template. See README.md for execution status.
-- Intended Railway service: Ugly Bot / NFTs Claims. Verify the connected service first.
-- This creates only a new reader role. It does not change bot accounts or data.
-- Stop if public/inherited privileges make this role writable; do not revoke
-- shared grants automatically. Have the database owner review them separately.
\set ON_ERROR_STOP on
\echo 'Intended service: Ugly Bot / NFTs Claims'
\conninfo
\prompt 'Type claims after verifying this is the intended service: ' approved_service
SELECT :'approved_service' = 'claims' AS approved \gset
\if :approved
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='uglydex_reader') THEN
  RAISE EXCEPTION 'Reader already exists: inspect it; do not overwrite its grants/password';
 END IF;
 IF to_regclass('public.claim_events') IS NULL THEN RAISE EXCEPTION 'Missing required table claim_events'; END IF;
 IF to_regclass('public.nft_claims') IS NULL THEN RAISE EXCEPTION 'Missing required table nft_claims'; END IF;
END $$;
CREATE ROLE uglydex_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
 NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE :"DBNAME" TO uglydex_reader;
GRANT USAGE ON SCHEMA public TO uglydex_reader;
GRANT SELECT ON TABLE public."claim_events",
 public."nft_claims" TO uglydex_reader;
ALTER ROLE uglydex_reader IN DATABASE :"DBNAME" SET default_transaction_read_only=on;
ALTER ROLE uglydex_reader IN DATABASE :"DBNAME" SET statement_timeout='5s';
SET LOCAL ROLE uglydex_reader;
DO $$ BEGIN
 IF has_database_privilege(current_database(),'CREATE') OR EXISTS(
  SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)
 ) THEN RAISE EXCEPTION 'Unsafe database create/ownership privilege'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema'
  AND (has_schema_privilege(oid,'CREATE') OR nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)))
 THEN RAISE EXCEPTION 'Unsafe schema create/ownership privilege'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND c.relkind IN ('r','p','v','m','f')
  AND (has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege(c.oid,'INSERT,UPDATE,REFERENCES')
       OR c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)))
 THEN RAISE EXCEPTION 'Unsafe table write/ownership privilege'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prosecdef AND has_function_privilege(p.oid,'EXECUTE'))
 THEN RAISE EXCEPTION 'Review executable SECURITY DEFINER routines before approving reader'; END IF;
 IF NOT has_table_privilege('public.claim_events','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on claim_events'; END IF;
 IF NOT has_table_privilege('public.nft_claims','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on nft_claims'; END IF;
END $$;
RESET ROLE;
COMMIT;
-- Enter a generated password only at the psql prompt; it is not stored in this file.
\password uglydex_reader
ALTER ROLE uglydex_reader LOGIN;
\echo 'Configure only UglyDex with this reader; retain existing bot logins. Rerun source validation.'
\else
\echo 'Service confirmation did not match; no change made.'
\quit
\endif
