import { z } from 'zod';
import { slugSchema } from './profile';
import { SQUIGS_CONTRACT } from './validation';
export const collectibleStatus = z.enum(['DRAFT', 'VERIFIED', 'RETIRED']);
export const artworkUri = z
  .string()
  .max(300)
  .regex(
    /^ipfs:\/\/(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{20,100})(\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,100}){0,3}$/,
  )
  .refine((s) => !s.includes('..'));
export function collectibleImageUrl(uri: string) {
  return 'https://gateway.pinata.cloud/ipfs/' + artworkUri.parse(uri).slice(7);
}
const text = (n: number) =>
  z
    .string()
    .trim()
    .max(n)
    .refine(
      (s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),
      'Control characters forbidden',
    );
const common = {
  name: text(100).min(1),
  description: text(1000).default(''),
  artist: text(100).nullable().default(null),
  imageUri: artworkUri,
  imageSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  issuedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  source: text(80).min(1),
  sourceReference: text(250).min(1),
  status: collectibleStatus.default('DRAFT'),
  revision: z.number().int().positive().optional(),
};
export const customSchema = z
  .object({
    ...common,
    key: slugSchema,
    tokenId: z.number().int().min(1).max(4444),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
export const editionSchema = z
  .object({
    ...common,
    slug: slugSchema,
    supply: z.number().int().min(1).max(1000000000).nullable().default(null),
    standard: z.enum(['NONE', 'ERC721', 'ERC1155']).default('NONE'),
    chainId: z
      .number()
      .int()
      .positive()
      .max(2147483647)
      .nullable()
      .default(null),
    contractAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .transform((s) => s.toLowerCase())
      .nullable()
      .default(null),
    tokenId: z
      .string()
      .regex(/^(0|[1-9][0-9]{0,77})$/)
      .refine((s) => BigInt(s) < 2n ** 256n)
      .nullable()
      .default(null),
    relatedTokens: z
      .array(z.number().int().min(1).max(4444))
      .max(100)
      .default([])
      .refine((v) => new Set(v).size === v.length),
  })
  .strict()
  .superRefine((e, ctx) => {
    const complete =
      e.chainId !== null && e.contractAddress !== null && e.tokenId !== null;
    if (e.standard !== 'NONE' && !complete)
      ctx.addIssue({
        code: 'custom',
        message: 'On-chain editions require chain, contract and token',
      });
    if (
      e.standard === 'NONE' &&
      (e.chainId !== null || e.contractAddress !== null || e.tokenId !== null)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Catalog editions must omit chain references',
      });
    if (
      e.contractAddress === SQUIGS_CONTRACT ||
      e.contractAddress === '0x' + '0'.repeat(40)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'An Edition cannot reuse the Reloaded or zero contract',
      });
    if (e.standard === 'ERC721' && e.supply !== null && e.supply !== 1)
      ctx.addIssue({ code: 'custom', message: 'ERC721 token supply is one' });
  });
export const collectibleManifest = z.discriminatedUnion('kind', [
  z
    .object({
      version: z.literal(1),
      kind: z.literal('CUSTOM'),
      records: z.array(customSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      kind: z.literal('EDITION'),
      records: z.array(editionSchema).min(1).max(100),
    })
    .strict(),
]);
export type CustomInput = z.infer<typeof customSchema>;
export type EditionInput = z.infer<typeof editionSchema>;
