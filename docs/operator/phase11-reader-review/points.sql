-- REVIEW ONLY: generated 2026-09-27T03:05:17.665Z; not executed.
-- Intended Railway service: Ugly Bot / Points Mapping
-- Service ID: 02f08441-2ef8-4f7b-b1bb-442c8a1c95d8; database: railway; schema: public.
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
  IF to_regclass('public.holder_point_mappings') IS NULL THEN
    RAISE EXCEPTION 'Required reviewed table is absent: holder_point_mappings';
  END IF;
END;
$guard$;

CREATE ROLE uglydex_reader
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE "railway" TO uglydex_reader;
GRANT USAGE ON SCHEMA public TO uglydex_reader;
GRANT SELECT ON TABLE
  public."holder_point_mappings"
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
      AND NOT (n.nspname = 'public' AND c.relname IN ('holder_point_mappings'))
      AND (has_table_privilege(c.oid, 'SELECT') OR has_any_column_privilege(c.oid, 'SELECT'))
  ) THEN RAISE EXCEPTION 'Unexpected read access outside the reviewed table allowlist'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND p.prosecdef AND has_function_privilege(p.oid, 'EXECUTE')
  ) THEN RAISE EXCEPTION 'Review executable user SECURITY DEFINER routines'; END IF;
  IF NOT has_table_privilege('public.holder_point_mappings', 'SELECT') THEN
    RAISE EXCEPTION 'Required SELECT privilege missing: holder_point_mappings';
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
