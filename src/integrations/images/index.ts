import 'server-only';
import { discordId } from '@/domain/validation';
import { readPage } from '../table';
import { tables } from '../registry';
export function getCollectorImageContributions(id: string) {
  return readPage(tables.submissions, undefined, {
    discord_user_id: discordId.parse(id),
    status: 'approved',
  });
}
