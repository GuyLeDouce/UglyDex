-- Reviewed Phase 11 provisioning template. See README.md for execution status.
-- Intended Railway service: Ugly Bot / Prizes. Verify the connected service first.
-- This creates only a new reader role. It does not change bot accounts or data.
-- Stop if public/inherited privileges make this role writable; do not revoke
-- shared grants automatically. Have the database owner review them separately.
\set ON_ERROR_STOP on
\echo 'Intended service: Ugly Bot / Prizes'
\conninfo
\prompt 'Type prizes after verifying this is the intended service: ' approved_service
SELECT :'approved_service' = 'prizes' AS approved \gset
\if :approved
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='uglydex_reader') THEN
  RAISE EXCEPTION 'Reader already exists: inspect it; do not overwrite its grants/password';
 END IF;
 IF to_regclass('public.malformed_marketplace_purchases') IS NULL THEN RAISE EXCEPTION 'Missing required table malformed_marketplace_purchases'; END IF;
 IF to_regclass('public.marketplace_purchases') IS NULL THEN RAISE EXCEPTION 'Missing required table marketplace_purchases'; END IF;
 IF to_regclass('public.bounty_submissions') IS NULL THEN RAISE EXCEPTION 'Missing required table bounty_submissions'; END IF;
 IF to_regclass('public.bounty_draw_results') IS NULL THEN RAISE EXCEPTION 'Missing required table bounty_draw_results'; END IF;
 IF to_regclass('public.maw_return_sessions') IS NULL THEN RAISE EXCEPTION 'Missing required table maw_return_sessions'; END IF;
 IF to_regclass('public.madlib_sessions') IS NULL THEN RAISE EXCEPTION 'Missing required table madlib_sessions'; END IF;
 IF to_regclass('public.bounty_pool_entries') IS NULL THEN RAISE EXCEPTION 'Missing required table bounty_pool_entries'; END IF;
 IF to_regclass('public.madlib_publications') IS NULL THEN RAISE EXCEPTION 'Missing required table madlib_publications'; END IF;
 IF to_regclass('public.madlib_operations') IS NULL THEN RAISE EXCEPTION 'Missing required table madlib_operations'; END IF;
 IF to_regclass('public.maw_squig_pool') IS NULL THEN RAISE EXCEPTION 'Missing required table maw_squig_pool'; END IF;
END $$;
CREATE ROLE uglydex_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
 NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE :"DBNAME" TO uglydex_reader;
GRANT USAGE ON SCHEMA public TO uglydex_reader;
GRANT SELECT ON TABLE public."malformed_marketplace_purchases",
 public."marketplace_purchases",
 public."bounty_submissions",
 public."bounty_draw_results",
 public."maw_return_sessions",
 public."madlib_sessions",
 public."bounty_pool_entries",
 public."madlib_publications",
 public."madlib_operations",
 public."maw_squig_pool" TO uglydex_reader;
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
 IF NOT has_table_privilege('public.malformed_marketplace_purchases','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on malformed_marketplace_purchases'; END IF;
 IF NOT has_table_privilege('public.marketplace_purchases','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on marketplace_purchases'; END IF;
 IF NOT has_table_privilege('public.bounty_submissions','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on bounty_submissions'; END IF;
 IF NOT has_table_privilege('public.bounty_draw_results','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on bounty_draw_results'; END IF;
 IF NOT has_table_privilege('public.maw_return_sessions','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on maw_return_sessions'; END IF;
 IF NOT has_table_privilege('public.madlib_sessions','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on madlib_sessions'; END IF;
 IF NOT has_table_privilege('public.bounty_pool_entries','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on bounty_pool_entries'; END IF;
 IF NOT has_table_privilege('public.madlib_publications','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on madlib_publications'; END IF;
 IF NOT has_table_privilege('public.madlib_operations','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on madlib_operations'; END IF;
 IF NOT has_table_privilege('public.maw_squig_pool','SELECT') THEN RAISE EXCEPTION 'Missing SELECT on maw_squig_pool'; END IF;
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
