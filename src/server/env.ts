import { z } from 'zod';
import { SQUIGS_CONTRACT } from '@/domain/validation';
const optional = <T extends z.ZodType>(type: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), type.optional());
const pg = z
  .string()
  .url()
  .refine((s) => /^postgres(ql)?:\/\//.test(s), 'PostgreSQL URL required');
const http = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//.test(s), 'HTTP URL required');
export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: pg,
    DB_POOL_MAX: z.coerce.number().int().min(1).max(30).default(8),
    WORKER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(300000)
      .default(15000),
    PUBLIC_BASE_URL: http.default('http://localhost:3000'),
    AUTH_SECRET: optional(z.string().min(32)),
    ADMIN_DIAGNOSTICS_TOKEN: optional(z.string().min(32)),
    WALLET_LINKS_DATABASE_URL: optional(pg),
    UGLYBOT_DATABASE_URL: optional(pg),
    UGLYBOT_PRIZES_DATABASE_URL: optional(pg),
    UGLYBOT_CLAIMS_DATABASE_URL: optional(pg),
    UGLYBOT_POINTS_DATABASE_URL: optional(pg),
    GAUNTLET_DATABASE_URL: optional(pg),
    GAUNTLET_SURVIVAL_DATABASE_URL: optional(pg),
    GAUNTLET_IMAGE_DATABASE_URL: optional(pg),
    IMAGE_SUBMIT_DATABASE_URL: optional(pg),
    UGLYBOT_BRIDGE_URL: optional(http),
    UGLYBOT_BRIDGE_SECRET: optional(z.string().min(32)),
    GAUNTLET_BRIDGE_URL: optional(http),
    GAUNTLET_BRIDGE_SECRET: optional(z.string().min(32)),
    IMAGE_BRIDGE_URL: optional(http),
    IMAGE_BRIDGE_SECRET: optional(z.string().min(32)),
    ECOSYSTEM_GUILD_ID: optional(z.string().regex(/^\d{17,20}$/)),
    ETH_RPC_URL: optional(http),
    ETH_EXPLORER_URL: optional(z.string().url().startsWith('https://')),
    RPC_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
    RPC_RETRIES: z.coerce.number().int().min(0).max(8).default(4),
    RPC_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
    REORG_REWIND_BLOCKS: z.coerce.number().int().min(1).max(10000).default(128),
    ADMIN_DISCORD_IDS: z
      .string()
      .regex(/^(\d{17,20}(,\d{17,20})*)?$/)
      .default(''),
    SQUIGS_CONTRACT_ADDRESS: z
      .literal(SQUIGS_CONTRACT)
      .default(SQUIGS_CONTRACT),
    SQUIGS_START_BLOCK: optional(z.coerce.bigint().nonnegative()),
    TRANSFER_BLOCK_BATCH: z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(1000),
    DISCORD_CLIENT_ID: optional(z.string().regex(/^\d{17,20}$/)),
    DISCORD_CLIENT_SECRET: optional(z.string().min(1)),
    DISCORD_REDIRECT_URI: optional(http),
    SQUIG_IMAGE_BASE_URL: optional(http),
  })
  .superRefine((env, ctx) => {
    for (const prefix of ['UGLYBOT', 'GAUNTLET', 'IMAGE'] as const) {
      const value = env[`${prefix}_BRIDGE_URL`],
        secret = env[`${prefix}_BRIDGE_SECRET`];
      if (!!value !== !!secret)
        ctx.addIssue({
          code: 'custom',
          path: [`${prefix}_BRIDGE_URL`],
          message: 'Bridge URL and secret must be paired',
        });
      if (value) {
        const url = new URL(value);
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          url.pathname !== '/' ||
          url.search ||
          url.hash
        )
          ctx.addIssue({
            code: 'custom',
            path: [`${prefix}_BRIDGE_URL`],
            message: 'Bridge requires a credential-free HTTPS origin',
          });
      }
    }
    const base = new URL(env.PUBLIC_BASE_URL);
    if (
      base.pathname !== '/' ||
      base.search ||
      base.hash ||
      base.username ||
      base.password
    )
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_BASE_URL'],
        message: 'Origin only',
      });
    if (env.NODE_ENV === 'production' && base.protocol !== 'https:')
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_BASE_URL'],
        message: 'HTTPS required',
      });
    if (
      env.DISCORD_REDIRECT_URI &&
      env.DISCORD_REDIRECT_URI !== `${base.origin}/api/auth/discord/callback`
    )
      ctx.addIssue({
        code: 'custom',
        path: ['DISCORD_REDIRECT_URI'],
        message: 'Canonical callback required',
      });
    const own = databaseIdentity(env.DATABASE_URL);
    for (const [key, value] of Object.entries(env))
      if (
        key.endsWith('_DATABASE_URL') &&
        typeof value === 'string' &&
        databaseIdentity(value) === own
      )
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'External and UglyDex databases must be separate',
        });
  });
export function databaseIdentity(value: string) {
  const url = new URL(value);
  return `${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`;
}
export function readEnv(
  input: Record<string, string | undefined> = process.env,
) {
  const result = environmentSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${[...new Set(result.error.issues.map((i) => i.path.join('.')))].join(', ')}`,
    );
  return result.data;
}
