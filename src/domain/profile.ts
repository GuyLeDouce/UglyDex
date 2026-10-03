import { z } from 'zod';
const reserved = new Set([
  'admin',
  'api',
  'me',
  'settings',
  'connect',
  'explore',
  'profile',
  'collection',
  'collector',
  'squig',
  'squigs',
  'login',
  'logout',
  'auth',
  'uglydex',
  'support',
  'help',
  'www',
  'about',
  'null',
  'undefined',
]);
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((s) => !reserved.has(s), 'This name is reserved.');
export const profileSchema = z.object({
  slug: slugSchema,
  displayName: z.string().trim().max(60),
  bio: z.string().trim().max(500),
  avatar: z.union([
    z.literal(''),
    z.url().refine((s) => {
      const u = new URL(s);
      return u.protocol === 'https:' && !u.username && !u.password;
    }, 'Use a public HTTPS image URL.'),
  ]),
  collectionVisibility: z.enum(['FULL', 'FEATURED_ONLY', 'HIDDEN']).optional(),
  isPublic: z.boolean(),
  showWallets: z.boolean(),
  showDiscord: z.boolean(),
  showCharmBalance: z.boolean().default(false),
  featuredTokenIds: z
    .array(z.number().int().min(1).max(4444))
    .max(6)
    .transform((a) => [...new Set(a)]),
});
export function publicIdentity(c: {
  slug: string;
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  showWallets: boolean;
  showDiscord: boolean;
  wallets: { walletAddress: string }[];
  identities: { username: string | null }[];
}) {
  return {
    slug: c.slug,
    displayName: c.displayName,
    bio: c.bio,
    avatar: c.avatar,
    wallets: c.showWallets ? c.wallets.map((w) => w.walletAddress) : [],
    discord: c.showDiscord
      ? c.identities.map((i) => i.username).filter((v): v is string => !!v)
      : [],
  };
}
