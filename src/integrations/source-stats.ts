import 'server-only';
import { tables } from './registry';
import { type SourceFeed } from './bridge-protocol';
import { bridgeConfigured } from './bridge-config';
import { bridgeRequest } from './bridge-client';
import { tableColumns, identifier } from './table';
import { readExternal } from './read-only';
export async function sourceStats(feed: SourceFeed, direct = false) {
  const spec = tables[feed];
  type Stats = { rows: string; earliest: string | null; latest: string | null };
  if (!direct && bridgeConfigured(spec.integration))
    return bridgeRequest<Stats[]>(spec.integration, `/v1/feeds/${feed}/stats`);
  const columns = await tableColumns(spec, true);
  if (!columns.ok) return columns;
  if (spec.required.some((c) => !columns.data.some((r) => r.column_name === c)))
    return { ok: false, reason: 'schema_mismatch' } as const;
  const date = ['created_at', 'submitted_at', 'added_at', 'started_at'].find(
    (c) => columns.data.some((r) => r.column_name === c),
  );
  return readExternal<Stats>(
    spec.integration,
    `SELECT count(*)::text AS rows, ${date ? `min(${identifier(date)})::text` : 'NULL::text'} AS earliest, ${date ? `max(${identifier(date)})::text` : 'NULL::text'} AS latest FROM public.${identifier(spec.table)}`,
  );
}
