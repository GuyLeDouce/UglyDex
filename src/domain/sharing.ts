import { z } from 'zod';
import { slugSchema } from './profile';
export const gallerySchema = z
  .object({
    id: z.uuid().optional(),
    revision: z.number().int().positive().optional(),
    slug: slugSchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).default(''),
    visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PRIVATE'),
    mode: z
      .enum(['CURRENT_COLLECTION', 'DISCOVERED_HISTORY'])
      .default('CURRENT_COLLECTION'),
    layout: z.enum(['GRID', 'EXHIBITION', 'COMPACT']).default('GRID'),
    coverTokenId: z.number().int().min(1).max(4444).nullable().default(null),
    featured: z.boolean().default(false),
    items: z
      .array(
        z.object({
          tokenId: z.number().int().min(1).max(4444),
          caption: z.string().trim().max(180).default(''),
          section: z.string().trim().max(40).default(''),
        }),
      )
      .max(100)
      .refine(
        (a) => new Set(a.map((i) => i.tokenId)).size === a.length,
        'Duplicate Squig',
      ),
  })
  .refine(
    (g) => !g.coverTokenId || g.items.some((i) => i.tokenId === g.coverTokenId),
    'Cover must be in gallery',
  );
export function galleryAccess(
  profilePublic: boolean,
  visibility: string,
  owner = false,
) {
  return (
    owner ||
    (profilePublic && (visibility === 'PUBLIC' || visibility === 'UNLISTED'))
  );
}
export const shareSchema = z
  .object({
    kind: z
      .enum([
        'collector',
        'completion',
        'trophy',
        'collage',
        'squig',
        'passport',
        'achievement',
        'set',
        'gallery',
        'discovery',
        'milestone',
      ])
      .default('collector'),
    entity: slugSchema.or(
      z
        .string()
        .regex(/^[1-9][0-9]{0,3}$/)
        .refine((s) => Number(s) <= 4444),
    ),
    key: z
      .string()
      .regex(/^[a-zA-Z0-9:_-]{1,100}$/)
      .optional(),
    ratio: z.enum(['landscape', 'square']).default('landscape'),
    template: z.enum(['clean', 'ugly', 'stats']).default('clean'),
    preset: z
      .enum(['featured', 'points', 'recent', 'random'])
      .default('featured'),
    count: z.coerce
      .number()
      .pipe(z.union([z.literal(4), z.literal(9), z.literal(16)]))
      .default(4),
    tokens: z
      .string()
      .regex(/^([1-9][0-9]{0,3})(,[1-9][0-9]{0,3}){0,15}$/)
      .optional(),
    seed: z
      .string()
      .regex(/^[a-z0-9-]{1,24}$/)
      .default('ugly'),
  })
  .strict();
export type ShareSpec = z.infer<typeof shareSchema>;
export type ShareCard = {
  title: string;
  eyebrow: string;
  description: string;
  stats: string[];
  badges: string[];
  tokens: number[];
  path: string;
  indexable: boolean;
  date?: string;
};
export function shareQuery(spec: Partial<ShareSpec> & { entity: string }) {
  return new URLSearchParams(
    Object.entries(spec)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
export function suggestedCopy(card: ShareCard) {
  return card.title + ' — ' + card.description;
}
export function stableShuffle(tokens: number[], seed: string) {
  const hash = (n: number) => {
    let h = 2166136261;
    for (const c of seed + ':' + n)
      h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  return [...tokens].sort((a, b) => hash(a) - hash(b) || a - b);
}
