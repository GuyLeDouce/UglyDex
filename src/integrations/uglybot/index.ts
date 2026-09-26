import 'server-only';
import { discordId, squigToken } from '@/domain/validation';
import { readPage } from '../table';
import { readExternal } from '../read-only';
import { tables } from '../registry';
export function getCollectorDuelHistory(id: string) {
  return readExternal(
    'uglybot',
    'SELECT id, challenger_id, opponent_id, challenger_squig_token_id, opponent_squig_token_id, winner_id, status, completed_at FROM public.squig_duels WHERE challenger_id = $1 OR opponent_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100',
    [discordId.parse(id)],
  );
}
export function getSquigDuelHistory(token: string) {
  return readExternal(
    'uglybot',
    'SELECT id, challenger_squig_token_id, opponent_squig_token_id, status, completed_at FROM public.squig_duels WHERE challenger_squig_token_id = $1 OR opponent_squig_token_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100',
    [String(squigToken(token))],
  );
}
export function getCollectorMarketplaceHistory(id: string) {
  return readPage(tables.marketplace, undefined, {
    user_id: discordId.parse(id),
  });
}
export function getCollectorBountyHistory(id: string) {
  return readPage(tables.bounty, undefined, {
    sender_discord_id: discordId.parse(id),
  });
}
export function getCollectorMawHistory(id: string) {
  return readPage(tables.maw, undefined, {
    discord_user_id: discordId.parse(id),
  });
}
