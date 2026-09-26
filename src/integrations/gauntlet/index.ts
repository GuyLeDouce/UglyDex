import 'server-only';
import { discordId } from '@/domain/validation';
import { readExternal } from '../read-only';
export function getCollectorSurvivalHistory(id: string) {
  return readExternal(
    'survival',
    'SELECT p.game_id, p.user_id, p.placement, p.eliminations, p.deaths, p.images_used, g.started_at FROM public.squig_survival_game_players p JOIN public.squig_survival_games g ON g.id = p.game_id WHERE p.user_id = $1 ORDER BY p.game_id DESC LIMIT 100',
    [discordId.parse(id)],
  );
}
export function getCollectorSurvivalStats(id: string) {
  return readExternal(
    'survival',
    'SELECT count(*)::text AS games, count(*) FILTER (WHERE placement = 1)::text AS firsts, count(*) FILTER (WHERE placement = 2)::text AS seconds, count(*) FILTER (WHERE placement = 3)::text AS thirds, sum(eliminations)::text AS eliminations, sum(deaths)::text AS deaths, sum(images_used)::text AS images_used FROM public.squig_survival_game_players WHERE user_id = $1',
    [discordId.parse(id)],
  );
}
