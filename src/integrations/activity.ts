import { activitySchema, type NormalizedActivity } from '@/domain/events';
import { SQUIGS_CONTRACT, squigToken } from '@/domain/validation';
import type { ExternalRow } from './table';
export function token(
  row: ExternalRow,
  contract = 'contract_address',
  key = 'token_id',
) {
  if (
    String(row[contract]).toLowerCase() !== SQUIGS_CONTRACT ||
    (row.chain && row.chain !== 'ethereum')
  )
    return undefined;
  return squigToken(row[key]);
}
export function money(v: unknown) {
  return v != null && /^\d{1,20}(\.\d{1,8})?$/.test(String(v))
    ? String(v)
    : undefined;
}
export function factory(
  system: 'uglybot' | 'gauntlet' | 'images',
  feed: string,
  row: ExternalRow,
  category: string,
) {
  return (
    slot: string,
    type: string,
    at: unknown,
    who: unknown,
    metadata: ExternalRow = {},
    extra: Record<string, unknown> = {},
  ): NormalizedActivity => {
    if (!at) throw new Error('MISSING_EVENT_TIME');
    const id =
      row.id ??
      row.event_id ??
      (row.game_id != null ? `${row.game_id}:${row.user_id}` : undefined);
    if (id == null || String(id) === '') throw new Error('MISSING_SOURCE_ID');
    if (who != null && !/^\d{17,20}$/.test(String(who)))
      throw new Error('INVALID_DISCORD_ID');
    return activitySchema.parse({
      sourceSystem: system,
      sourceType: feed,
      sourceId: String(id),
      subject: slot,
      slot,
      discordId: who == null ? undefined : String(who),
      eventType: type,
      eventAt: at,
      category,
      visibility: 'PUBLIC',
      metadata: JSON.parse(JSON.stringify(metadata)),
      ...(row.created_at ? { sourceCreatedAt: row.created_at } : {}),
      ...(row.updated_at ? { sourceUpdatedAt: row.updated_at } : {}),
      ...extra,
    });
  };
}
