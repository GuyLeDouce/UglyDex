import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { stableJson } from './events';
export const charmDirtySchema = z
  .object({
    realmId: z.string().regex(/^[a-f0-9]{24}$/i),
    currencyId: z.string().regex(/^[a-f0-9]{24}$/i),
    dripMemberId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    discordId: z
      .string()
      .regex(/^\d{17,20}$/)
      .optional(),
    sourceSystem: z.enum(['uglybot', 'gauntlet']),
    operationReference: z.string().min(1).max(128),
    observedAt: z.iso.datetime(),
  })
  .strict()
  .refine((v) => !!v.dripMemberId || !!v.discordId);
export function dirtySignature(
  secret: string,
  timestamp: string,
  nonce: string,
  payload: unknown,
) {
  return createHmac('sha256', secret)
    .update(timestamp + '\n' + nonce + '\n' + stableJson(payload))
    .digest('hex');
}
export function verifyDirtySignature(
  secret: string,
  timestamp: string,
  nonce: string,
  payload: unknown,
  signature: string,
  now = Date.now(),
) {
  if (
    secret.length < 32 ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp) * 1000) > 120000 ||
    !z.uuid().safeParse(nonce).success ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(dirtySignature(secret, timestamp, nonce, payload), 'hex'),
  );
}
