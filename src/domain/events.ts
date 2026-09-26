import { createHash } from 'node:crypto';
import { z } from 'zod';
import { discordId } from './validation';
export const activitySchema = z.object({
  sourceSystem: z.enum(['uglybot', 'gauntlet', 'images', 'blockchain']),
  sourceType: z.string().min(1).max(100),
  sourceId: z.string().min(1).max(300),
  discordId: discordId.optional(),
  walletAddress: z
    .string()
    .regex(/^0x[a-f0-9]{40}$/)
    .optional(),
  subject: z.string().min(1).max(100).optional(),
  slot: z.string().min(1).max(100).optional(),
  category: z
    .enum([
      'SQUIGS',
      'DUELS',
      'SURVIVAL',
      'BOUNTY',
      'MAW',
      'MARKETPLACE',
      'CREATOR',
      'MADLIBS',
      'OTHER',
    ])
    .default('OTHER'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  importance: z.enum(['MAJOR', 'STANDARD', 'DETAIL']).default('STANDARD'),
  recordStatus: z.enum(['ACTIVE', 'RETRACTED']).default('ACTIVE'),
  amount: z
    .string()
    .regex(/^\d{1,20}(\.\d{1,8})?$/)
    .optional(),
  currency: z.string().max(100).optional(),
  direction: z.enum(['EARN', 'SPEND', 'WAGER', 'PAYOUT', 'REFUND']).optional(),
  sourceCreatedAt: z.coerce.date().optional(),
  sourceUpdatedAt: z.coerce.date().optional(),
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
    event.subject ??
      (event.discordId
        ? `discord:${event.discordId}`
        : event.walletAddress
          ? `wallet:${event.walletAddress}`
          : 'record'),
    event.slot ?? event.eventType,
  ]);
}
