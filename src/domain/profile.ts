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
  slug: z.union([z.literal(''), slugSchema]),
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
  showUsername: z.boolean().optional(),
  isPublic: z.boolean(),
  showWallets: z.boolean(),
  showDiscord: z.boolean(),
  showCharmBalance: z.boolean().default(false),
  showCommunityActivity: z.boolean().optional(),
  featuredTokenIds: z
    .array(z.number().int().min(1).max(4444))
    .max(6)
    .transform((a) => [...new Set(a)]),
});
export function hasCollectorUsername(slug: string) {
  return !!slug && !/^(collector|holder)-[0-9a-f-]{36}$/i.test(slug);
}
export function shortWallet(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function publicIdentity(c: {
  slug: string;
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  showWallets: boolean;
  showDiscord: boolean;
  showUsername?: boolean;
  claimedAt?: Date | null;
  discoveredWallets?: { walletAddress: string }[];
  wallets: { walletAddress: string; isPrimary?: boolean; chainId?: number }[];
  identities: { username: string | null }[];
}) {
  const primary =
    c.wallets.find((w) => w.isPrimary)?.walletAddress ??
    c.wallets[0]?.walletAddress;
  const discovered =
    !c.claimedAt && !c.wallets.length
      ? (c.discoveredWallets?.map((w) => w.walletAddress) ?? [])
      : [];
  const addresses = c.showWallets
    ? [...new Set([...c.wallets.map((w) => w.walletAddress), ...discovered])]
    : [];
  return {
    slug: c.slug,
    displayName:
      c.showUsername === undefined
        ? c.displayName
        : c.showUsername
          ? c.displayName || c.slug
          : addresses[0]
            ? shortWallet(primary ?? addresses[0])
            : 'Collector',
    ...(c.claimedAt !== undefined
      ? {
          unclaimed:
            c.claimedAt === null && !c.wallets.length && !c.identities.length,
        }
      : {}),
    bio: c.bio,
    avatar: c.avatar,
    wallets: addresses,
    discord: c.showDiscord
      ? c.identities.map((i) => i.username).filter((v): v is string => !!v)
      : [],
  };
}
