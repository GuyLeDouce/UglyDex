import 'server-only';
import { discordId, squigToken } from '@/domain/validation';
import { readPage } from '../table';
import { readSourceQuery } from '../queries';
import { tables } from '../registry';
export function getCollectorDuelHistory(id: string) {
  return readSourceQuery('collectorDuels', [discordId.parse(id)]);
}
export function getSquigDuelHistory(token: string) {
  return readSourceQuery('squigDuels', [String(squigToken(token))]);
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
