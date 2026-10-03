import 'server-only';
import { integrationEnv, tables, type Integration } from './registry';
import { readExternal } from './read-only';
import { bridgeConfigured, integrationConfigured } from './bridge-config';
import { bridgeRequest } from './bridge-client';
export type SourceInspection = {
  integration: Integration;
  configured: boolean;
  status: string;
  transport: 'postgres' | 'bridge';
  reachable: boolean;
  authenticated: boolean;
  tables: {
    table: string;
    present: boolean;
    expectedColumns: string[];
    columns: string[];
    missingRequired: string[];
    missingOptional: string[];
    estimatedRows: string | null;
  }[];
};
export async function inspectIntegrations(
  direct = false,
  selected = Object.keys(integrationEnv) as Integration[],
): Promise<SourceInspection[]> {
  const reports: SourceInspection[] = [];
  for (const integration of selected) {
    reports.push(
      await (async (): Promise<SourceInspection> => {
        if (!direct && bridgeConfigured(integration)) {
          const result = await bridgeRequest<SourceInspection>(
            integration,
            `/v1/status/${integration}`,
          );
          return result.ok
            ? {
                ...result.data,
                transport: 'bridge',
                reachable: true,
                authenticated: true,
              }
            : {
                integration,
                configured: integrationConfigured(integration),
                status: result.reason,
                transport: 'bridge',
                reachable: false,
                authenticated: false,
                tables: [],
              };
        }
        const specs = Object.values(tables).filter(
          (t) => t.integration === integration,
        );
        const result = await readExternal<{
          table_name: string;
          column_name: string;
          estimated_rows: string | null;
        }>(
          integration,
          `SELECT c.table_name, c.column_name, p.reltuples::bigint::text AS estimated_rows FROM information_schema.columns c LEFT JOIN pg_namespace n ON n.nspname = c.table_schema LEFT JOIN pg_class p ON p.relnamespace = n.oid AND p.relname = c.table_name WHERE c.table_schema = $1 AND c.table_name = ANY($2::text[]) ORDER BY c.table_name, c.ordinal_position`,
          ['public', specs.map((s) => s.table)],
        );
        return {
          integration,
          configured: !!process.env[integrationEnv[integration]],
          transport: 'postgres',
          reachable: result.ok,
          authenticated: result.ok,
          status: result.ok ? 'connected' : result.reason,
          tables: result.ok
            ? specs.map((spec) => {
                const rows = result.data.filter(
                  (r) => r.table_name === spec.table,
                );
                const columns = rows
                  .map((r) => r.column_name)
                  .filter((c) =>
                    [...spec.required, ...spec.optional].includes(c),
                  );
                return {
                  table: spec.table,
                  present: rows.length > 0,
                  expectedColumns: spec.required,
                  columns,
                  missingRequired: spec.required.filter(
                    (c) => !columns.includes(c),
                  ),
                  missingOptional: spec.optional.filter(
                    (c) => !columns.includes(c),
                  ),
                  estimatedRows: rows[0]?.estimated_rows ?? null,
                };
              })
            : [],
        };
      })(),
    );
  }
  return reports;
}
