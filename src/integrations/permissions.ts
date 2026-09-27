import 'server-only';
import { readExternal } from './read-only';
import { bridgeConfigured } from './bridge-config';
import { bridgeRequest } from './bridge-client';
import type { Integration } from './registry';
export type SourcePermissions = {
  read_only: string;
  superuser: boolean;
  can_write: boolean;
  unsafe: boolean;
};
export async function sourcePermissions(
  integration: Integration,
  direct = false,
) {
  if (!direct && bridgeConfigured(integration))
    return bridgeRequest<SourcePermissions[]>(
      integration,
      `/v1/permissions/${integration}`,
    );
  return readExternal<SourcePermissions>(
    integration,
    `SELECT current_setting('transaction_read_only') AS read_only, r.rolsuper AS superuser,
    EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f') AND (has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(c.oid,'INSERT,UPDATE,REFERENCES') OR c.relowner=r.oid)) AS can_write,
    (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR has_database_privilege(current_database(),'CREATE')
    OR EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=r.oid)
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema' AND (nspowner=r.oid OR has_schema_privilege(oid,'CREATE')))
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND p.prosecdef AND has_function_privilege(p.oid,'EXECUTE'))) AS unsafe
    FROM pg_roles r WHERE rolname=current_user`,
  );
}
export function safeSourceRole(value: SourcePermissions | undefined) {
  return (
    !!value &&
    value.read_only === 'on' &&
    !value.superuser &&
    !value.can_write &&
    !value.unsafe
  );
}
