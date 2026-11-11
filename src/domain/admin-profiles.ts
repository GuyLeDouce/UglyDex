import { z } from 'zod';
import { slugSchema } from './profile';
export const supportStatuses = ['ACTIVE', 'ERROR', 'UPDATING'] as const;
export const adminProfileInput = z
  .object({
    id: z.uuid(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    updatedAt: z.iso.datetime(),
    slug: z.string().trim().min(3).max(64),
    displayName: z.string().trim().max(60),
    wallets: z
      .array(
        z
          .string()
          .trim()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .transform((v) => v.toLowerCase()),
      )
      .max(100),
    discordIds: z
      .array(
        z
          .string()
          .trim()
          .regex(/^\d{17,20}$/),
      )
      .max(10),
    dripId: z.union([
      z.literal(''),
      z
        .string()
        .regex(/^[a-f0-9]{24}$/i)
        .transform((v) => v.toLowerCase()),
    ]),
    notes: z.string().trim().max(2000),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.wallets).size !== v.wallets.length ||
      new Set(v.discordIds).size !== v.discordIds.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Remove duplicate wallets or Discord IDs.',
      });
  });
export { slugSchema };
/** Ambiguous/missing owner configuration fails closed. */
export function configuredAdminOwner(
  owner: string | undefined,
  legacy: string,
) {
  const ids = [
    ...new Set(
      (owner || legacy)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  return ids.length === 1 && /^\d{17,20}$/.test(ids[0]) ? ids[0] : null;
}
