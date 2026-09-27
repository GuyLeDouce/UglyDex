import { z } from 'zod';
import { tables, type TableSpec } from './registry';
export type SourceFeed = keyof typeof tables;
export const pageInput = z
  .object({
    order: z.enum(['key', 'updated']).default('key'),
    after: z
      .array(
        z.union([
          z.string().max(512),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ]),
      )
      .min(1)
      .max(5)
      .optional(),
    limit: z.number().int().min(1).max(500).default(200),
    since: z.iso.datetime({ offset: true }).optional(),
    scope: z
      .object({
        guild: z
          .string()
          .regex(/^\d{17,20}$/)
          .optional(),
        user: z
          .string()
          .regex(/^\d{17,20}$/)
          .optional(),
        verified: z.literal(true).optional(),
        approved: z.literal(true).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export const scopeColumns: Partial<Record<SourceFeed, Record<string, string>>> =
  {
    links: { guild: 'guild_id', user: 'discord_id', verified: 'verified' },
    marketplace: { user: 'user_id' },
    bounty: { user: 'sender_discord_id' },
    maw: { user: 'discord_user_id' },
    submissions: { user: 'discord_user_id', approved: 'status' },
  };
export function feedKey(spec: TableSpec): SourceFeed {
  const key = (Object.keys(tables) as SourceFeed[]).find(
    (k) =>
      tables[k].table === spec.table &&
      tables[k].integration === spec.integration,
  );
  if (!key) throw new Error('UNKNOWN_SOURCE_FEED');
  return key;
}
export function effectivePage(
  feed: SourceFeed,
  input: z.infer<typeof pageInput>,
) {
  const base = tables[feed];
  if (input.order === 'updated' && !base.optional.includes('updated_at'))
    throw new Error('INVALID_CURSOR_ORDER');
  const spec: TableSpec =
    input.order === 'updated'
      ? {
          ...base,
          keys: ['updated_at', ...base.keys],
          required: [...new Set([...base.required, 'updated_at'])],
          optional: base.optional.filter((c) => c !== 'updated_at'),
        }
      : base;
  if (input.after && input.after.length !== spec.keys.length)
    throw new Error('INVALID_CURSOR');
  const filters: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input.scope)) {
    const column = scopeColumns[feed]?.[name];
    if (!column) throw new Error('INVALID_SCOPE');
    filters[column] = name === 'approved' ? 'approved' : value;
  }
  const column =
    input.order === 'updated'
      ? 'updated_at'
      : base.required.includes('submitted_at')
        ? 'submitted_at'
        : base.required.includes('added_at')
          ? 'added_at'
          : 'created_at';
  return {
    spec,
    filters,
    since: input.since ? { column, value: new Date(input.since) } : undefined,
  };
}
