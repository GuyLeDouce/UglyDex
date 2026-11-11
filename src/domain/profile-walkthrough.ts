import { z } from 'zod';

export const walkthroughInput = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('name'),
    name: z.string().trim().min(1).max(60),
  }),
  z.object({
    action: z.literal('avatar'),
    tokenId: z.number().int().min(1).max(4444).nullable(),
  }),
  z.object({ action: z.literal('sharing'), share: z.boolean() }),
]);

export function walkthroughStep(savedStep: number, dripVerified: boolean) {
  if (savedStep < 1) return 'NAME';
  if (!dripVerified) return 'DRIP';
  if (savedStep < 2) return 'AVATAR';
  return 'SHARING';
}

export function walkthroughSharing(share: boolean) {
  return {
    isPublic: true,
    showUsername: share,
    showWallets: true,
    showDiscord: true,
    showCommunityActivity: true,
    collectionVisibility: share ? ('FULL' as const) : ('HIDDEN' as const),
  };
}
