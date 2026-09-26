import 'server-only';
import { readExternal, type IntegrationResult } from './read-only';
import type { TableSpec } from './registry';
export type ExternalRow = Record<string, unknown>;
export function identifier(value: string) {
  if (!/^[a-z_][a-z_0-9]*$/.test(value))
    throw new Error('INVALID_SQL_IDENTIFIER');
  return `"${value}"`;
}
export async function tableColumns(spec: TableSpec) {
  return readExternal<{ column_name: string }>(
    spec.integration,
    'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position',
    ['public', spec.table],
  );
}
export async function readPage(
  spec: TableSpec,
  after?: unknown[],
  filters: Record<string, unknown> = {},
  limit = 200,
): Promise<IntegrationResult<ExternalRow[]>> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new Error('INVALID_PAGE_SIZE');
  const found = await tableColumns(spec);
  if (!found.ok) return found;
  const names = new Set(found.data.map((c) => c.column_name));
  if (spec.required.some((c) => !names.has(c)))
    return { ok: false, reason: 'schema_mismatch' };
  const columns = [...spec.required, ...spec.optional];
  const selection = columns
    .map((c) => (names.has(c) ? identifier(c) : `NULL AS ${identifier(c)}`))
    .join(', ');
  const values: unknown[] = [];
  const predicates: string[] = [];
  if (after) {
    if (after.length !== spec.keys.length) throw new Error('INVALID_CURSOR');
    values.push(...after);
    predicates.push(
      `(${spec.keys.map(identifier).join(',')}) > (${after.map((_, i) => `$${i + 1}`).join(',')})`,
    );
  }
  for (const [key, value] of Object.entries(filters)) {
    if (!columns.includes(key) || !names.has(key))
      return { ok: false, reason: 'schema_mismatch' };
    values.push(value);
    predicates.push(`${identifier(key)} = $${values.length}`);
  }
  values.push(limit);
  return readExternal(
    spec.integration,
    `SELECT ${selection} FROM public.${identifier(spec.table)} ${predicates.length ? `WHERE ${predicates.join(' AND ')}` : ''} ORDER BY ${spec.keys.map(identifier).join(',')} LIMIT $${values.length}`,
    values,
  );
}
