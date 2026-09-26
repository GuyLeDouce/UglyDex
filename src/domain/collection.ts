import { z } from 'zod';
import { canonicalTokens } from './dex-catalog';
import { normalizeTrait } from './dex';
import type { Prisma } from '@/generated/prisma/client';
export const filterSchema = z.object({
  dex: z.enum(['', 'undiscovered', 'traits', 'advances']).catch(''),
  set: z.string().max(100).catch(''),
  page: z.coerce.number().int().min(1).max(186).catch(1),
  sort: z
    .enum([
      'token',
      'points-desc',
      'points-asc',
      'rank',
      'recent',
      'og',
      'legendary',
    ])
    .catch('token'),
  q: z
    .string()
    .regex(/^\d{0,4}$/)
    .catch(''),
  og: z.enum(['1', '']).catch(''),
  legendary: z.enum(['1', '']).catch(''),
  rarity: z
    .enum(['', 'common', 'uncommon', 'rare', 'epic', 'legendary'])
    .catch(''),
  trait: z.string().max(80).catch(''),
  value: z.string().max(120).catch(''),
  min: z
    .preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().min(0).max(1000000).optional(),
    )
    .catch(undefined),
  max: z
    .preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().min(0).max(1000000).optional(),
    )
    .catch(undefined),
});
export type Filters = z.infer<typeof filterSchema>;
export function collectionWhere(f: Filters): Prisma.SquigWhereInput {
  return {
    ...(f.q ? { tokenId: Number(f.q) } : {}),
    ...(f.og ? { og: true } : {}),
    ...(f.legendary ? { legendary: true } : {}),
    ...(f.rarity ? { rarityTier: f.rarity } : {}),
    ...(f.min !== undefined || f.max !== undefined
      ? { uglyPoints: { gte: f.min, lte: f.max } }
      : {}),
    ...(f.trait || f.value
      ? {
          traits: {
            some: {
              ...(f.trait ? { traitType: f.trait } : {}),
              ...(f.value
                ? {
                    value: traitFilterValues(f.trait, f.value),
                  }
                : {}),
            },
          },
        }
      : {}),
  };
}
export function collectionOrder(
  sort: Filters['sort'],
): Prisma.SquigOrderByWithRelationInput[] {
  const first: Prisma.SquigOrderByWithRelationInput =
    sort === 'points-desc'
      ? { uglyPoints: { sort: 'desc', nulls: 'last' } }
      : sort === 'points-asc'
        ? { uglyPoints: { sort: 'asc', nulls: 'last' } }
        : sort === 'rank'
          ? { mawRank: { sort: 'asc', nulls: 'last' } }
          : sort === 'og'
            ? { og: { sort: 'desc', nulls: 'last' } }
            : sort === 'legendary'
              ? { legendary: { sort: 'desc', nulls: 'last' } }
              : { tokenId: 'asc' };
  return [first, { tokenId: 'asc' }];
}
export const PAGE_SIZE = 24;

function traitFilterValues(type: string, value: string) {
  const values = [
    ...new Set([
      value,
      ...canonicalTokens.flatMap((t) =>
        Object.entries(t.traits)
          .filter(
            ([key, v]) =>
              (!type || key === type) &&
              normalizeTrait(v) === normalizeTrait(value),
          )
          .map(([, v]) => v),
      ),
    ]),
  ];
  return values.length === 1 ? value : { in: values };
}
