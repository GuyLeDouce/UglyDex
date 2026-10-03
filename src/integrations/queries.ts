import 'server-only';
import { z } from 'zod';
import { readExternal } from './read-only';
import { bridgeConfigured } from './bridge-config';
import { bridgeRequest } from './bridge-client';
import type { Integration } from './registry';
const id = z.string().regex(/^\d{17,20}$/),
  token = z.string().regex(/^\d{1,4}$/);
const ids = z
  .array(z.union([z.string().min(1).max(100), z.number().int().safe()]))
  .max(500);
// Fixed application lookups, never client-provided SQL or identifiers.
export const sourceQueries = {
  walletIdentity: {
    integration: 'links',
    input: z.tuple([z.string().regex(/^0x[a-f0-9]{40}$/), id]),
    sql: 'SELECT discord_id, guild_id FROM public.wallet_links WHERE lower(wallet_address) = $1 AND guild_id = $2 AND verified = true ORDER BY discord_id LIMIT 200',
  },
  collectorDuels: {
    integration: 'uglybot',
    input: z.tuple([id]),
    sql: 'SELECT id, challenger_id, opponent_id, challenger_squig_token_id, opponent_squig_token_id, winner_id, status, completed_at FROM public.squig_duels WHERE challenger_id = $1 OR opponent_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100',
  },
  squigDuels: {
    integration: 'uglybot',
    input: z.tuple([token]),
    sql: 'SELECT id, challenger_squig_token_id, opponent_squig_token_id, status, completed_at FROM public.squig_duels WHERE challenger_squig_token_id = $1 OR opponent_squig_token_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100',
  },
  survivalHistory: {
    integration: 'survival',
    input: z.tuple([id]),
    sql: 'SELECT p.game_id, p.user_id, p.placement, p.eliminations, p.deaths, p.images_used, g.started_at FROM public.squig_survival_game_players p JOIN public.squig_survival_games g ON g.id = p.game_id WHERE p.user_id = $1 ORDER BY p.game_id DESC LIMIT 100',
  },
  survivalStats: {
    integration: 'survival',
    input: z.tuple([id]),
    sql: 'SELECT count(*)::text AS games, count(*) FILTER (WHERE placement = 1)::text AS firsts, count(*) FILTER (WHERE placement = 2)::text AS seconds, count(*) FILTER (WHERE placement = 3)::text AS thirds, sum(eliminations)::text AS eliminations, sum(deaths)::text AS deaths, sum(images_used)::text AS images_used FROM public.squig_survival_game_players WHERE user_id = $1',
  },
  bountyParents: {
    integration: 'prizes',
    input: z.tuple([ids]),
    sql: 'SELECT id,project_name,token_id FROM public.bounty_submissions WHERE id=ANY($1::bigint[])',
  },
  survivalParents: {
    integration: 'survival',
    input: z.tuple([ids]),
    sql: 'SELECT id,started_at FROM public.squig_survival_games WHERE id = ANY($1::bigint[])',
  },
  duelRounds: {
    integration: 'uglybot',
    input: z.tuple([ids]),
    sql: 'SELECT duel_id,count(*)::int AS rounds FROM public.squig_duel_rounds WHERE duel_id = ANY($1::text[]) GROUP BY duel_id',
  },
} satisfies Record<
  string,
  { integration: Integration; input: z.ZodType; sql: string }
>;
export type SourceQuery = keyof typeof sourceQueries;
export async function readSourceQuery<
  T extends Record<string, unknown> = Record<string, unknown>,
>(key: SourceQuery, values: unknown[], direct = false) {
  const query = sourceQueries[key];
  const input = query.input.parse(values);
  if (!direct && bridgeConfigured(query.integration))
    return bridgeRequest<T[]>(query.integration, `/v1/lookups/${key}`, {
      args: input,
    });
  return readExternal<T>(query.integration, query.sql, input);
}
