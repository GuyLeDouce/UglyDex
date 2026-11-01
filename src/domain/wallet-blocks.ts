import { z } from 'zod';
export const walletBlockInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('block'),
      walletAddress: z
        .string()
        .trim()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .transform((s) => s.toLowerCase()),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal('unblock'),
      walletAddress: z
        .string()
        .trim()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .transform((s) => s.toLowerCase()),
      blockedAt: z.iso.datetime(),
    })
    .strict(),
]);
