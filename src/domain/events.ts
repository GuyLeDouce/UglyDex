import { createHash } from 'node:crypto';
import { z } from 'zod';
import { discordId } from './validation';
export const activitySchema = z.object({
  sourceSystem: z.enum(['uglybot', 'gauntlet', 'images', 'blockchain']),
  sourceType: z.string().min(1).max(100),
  sourceId: z.string().min(1).max(300),
  discordId,
  eventType: z.string().regex(/^[A-Z_]+$/),
  eventAt: z.coerce.date(),
  squigTokenId: z.number().int().min(1).max(4444).optional(),
  metadata: z.record(z.string(), z.json()),
});
export type NormalizedActivity = z.infer<typeof activitySchema>;
export function stableJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const hash = (value: unknown) =>
  createHash('sha256').update(stableJson(value)).digest('hex');
export function eventKey(event: NormalizedActivity) {
  return hash([
    event.sourceSystem,
    event.sourceType,
    event.sourceId,
    `discord:${event.discordId}`,
    event.eventType,
  ]);
}
