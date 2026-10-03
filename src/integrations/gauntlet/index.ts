import 'server-only';
import { discordId } from '@/domain/validation';
import { readSourceQuery } from '../queries';
export function getCollectorSurvivalHistory(id: string) {
  return readSourceQuery('survivalHistory', [discordId.parse(id)]);
}
export function getCollectorSurvivalStats(id: string) {
  return readSourceQuery('survivalStats', [discordId.parse(id)]);
}
