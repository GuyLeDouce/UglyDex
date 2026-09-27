-- REVIEW ONLY: generated 2026-09-27T03:05:17.665Z; not executed.
-- Intended Railway service: Ugly Bot / Prizes
-- Service ID: ae120815-4eed-49cd-be25-0c5c72dd35b2; database: railway; schema: public.
-- Existing uglydex_reader observed: true.
-- Verify the intended Railway service before running; all eight use database railway.
-- This file stops on an existing role. It never changes bot accounts or source rows.
BEGIN;
SET LOCAL search_path = pg_catalog;
DO $guard$
BEGIN
  IF current_database() <> 'railway' THEN
    RAISE EXCEPTION 'Wrong database: verify the intended Railway service';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uglydex_reader') THEN
    RAISE EXCEPTION 'uglydex_reader already exists: inspect it; do not overwrite or alter its grants/password';
  END IF;
  IF to_regclass('public.bounty_draw_results') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: bounty_draw_results';
  END IF;
  IF to_regclass('public.bounty_pool_entries') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: bounty_pool_entries';
  END IF;
  IF to_regclass('public.bounty_submissions') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: bounty_submissions';
  END IF;
  IF to_regclass('public.madlib_operations') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: madlib_operations';
  END IF;
  IF to_regclass('public.madlib_publications') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: madlib_publications';
  END IF;
  IF to_regclass('public.madlib_sessions') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: madlib_sessions';
  END IF;
  IF to_regclass('public.malformed_marketplace_purchases') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: malformed_marketplace_purchases';
  END IF;
  IF to_regclass('public.marketplace_purchases') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: marketplace_purchases';
  END IF;
  IF to_regclass('public.maw_return_sessions') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: maw_return_sessions';
  END IF;
  IF to_regclass('public.maw_squig_pool') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: maw_squig_pool';
  END IF;
END;
$guard$;

CREATE ROLE uglydex_reader
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE "railway" TO uglydex_reader;
GRANT USAGE ON SCHEMA public TO uglydex_reader;
GRANT SELECT ON TABLE
  public."bounty_draw_results",
  public."bounty_pool_entries",
  public."bounty_submissions",
  public."madlib_operations",
  public."madlib_publications",
  public."madlib_sessions",
  public."malformed_marketplace_purchases",
  public."marketplace_purchases",
  public."maw_return_sessions",
  public."maw_squig_pool"
TO uglydex_reader;
ALTER ROLE uglydex_reader IN DATABASE "railway"
  SET default_transaction_read_only = on;
ALTER ROLE uglydex_reader IN DATABASE "railway"
  SET statement_timeout = '5s';

-- Evaluate effective/public permissions as the new reader, before committing.
SET LOCAL ROLE uglydex_reader;
DO $privileges$
BEGIN
  IF has_database_privilege(current_database(), 'CREATE') OR EXISTS (
    SELECT 1 FROM pg_database
    WHERE datname = current_database()
      AND datdba = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN RAISE EXCEPTION 'Unsafe database CREATE or ownership'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'
      AND (has_schema_privilege(oid, 'CREATE') OR
           nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user))
  ) THEN RAISE EXCEPTION 'Unsafe schema CREATE or ownership'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege(c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR has_any_column_privilege(c.oid, 'INSERT,UPDATE,REFERENCES')
           OR c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user))
  ) THEN RAISE EXCEPTION 'Unsafe table/column write privilege or ownership'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND c.relkind IN ('r','p','v','m','f')
      AND NOT (n.nspname = 'public' AND c.relname IN ('bounty_draw_results', 'bounty_pool_entries', 'bounty_submissions', 'madlib_operations', 'madlib_publications', 'madlib_sessions', 'malformed_marketplace_purchases', 'marketplace_purchases', 'maw_return_sessions', 'maw_squig_pool'))
      AND (has_table_privilege(c.oid, 'SELECT') OR has_any_column_privilege(c.oid, 'SELECT'))
  ) THEN RAISE EXCEPTION 'Unexpected read access outside the reviewed table allowlist'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND p.prosecdef AND has_function_privilege(p.oid, 'EXECUTE')
  ) THEN RAISE EXCEPTION 'Review executable user SECURITY DEFINER routines'; END IF;
  IF NOT has_table_privilege('public.bounty_draw_results', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: bounty_draw_results';
  END IF;
  IF NOT has_table_privilege('public.bounty_pool_entries', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: bounty_pool_entries';
  END IF;
  IF NOT has_table_privilege('public.bounty_submissions', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: bounty_submissions';
  END IF;
  IF NOT has_table_privilege('public.madlib_operations', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: madlib_operations';
  END IF;
  IF NOT has_table_privilege('public.madlib_publications', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: madlib_publications';
  END IF;
  IF NOT has_table_privilege('public.madlib_sessions', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: madlib_sessions';
  END IF;
  IF NOT has_table_privilege('public.malformed_marketplace_purchases', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: malformed_marketplace_purchases';
  END IF;
  IF NOT has_table_privilege('public.marketplace_purchases', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: marketplace_purchases';
  END IF;
  IF NOT has_table_privilege('public.maw_return_sessions', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: maw_return_sessions';
  END IF;
  IF NOT has_table_privilege('public.maw_squig_pool', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: maw_squig_pool';
  END IF;
END;
$privileges$;
RESET ROLE;
COMMIT;

-- Intentionally leave a newly created role NOLOGIN until its password is set safely.
-- AFTER APPROVAL and successful creation, use psql's interactive password command:
--   \password uglydex_reader
-- Then, as the source administrator, enable only this dedicated reader:
--   ALTER ROLE uglydex_reader LOGIN;
-- Never put its password in this file, a command argument, Git, or chat.
