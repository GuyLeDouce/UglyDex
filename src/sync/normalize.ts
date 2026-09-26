import type { ExternalRow } from '@/integrations/table';
import { duelEvents } from '@/integrations/uglybot/duels';
import { gauntletEvents } from '@/integrations/gauntlet/survival';
import { bountyEvents } from '@/integrations/uglybot/bounty';
import { mawEvents, mawPrizeEvents } from '@/integrations/uglybot/maw';
import { marketplaceEvents } from '@/integrations/uglybot/marketplace';
import { imageEvents } from '@/integrations/images/activity';
import { madlibEvents } from '@/integrations/uglybot/madlibs';
import { factory } from '@/integrations/activity';
export const feeds = [
  'duels',
  'marketplace',
  'purchases',
  'bounty',
  'bountyEntries',
  'bountyResults',
  'maw',
  'mawPrizes',
  'claimEvents',
  'runs',
  'survival',
  'onlineRewards',
  'imageUses',
  'submissions',
  'liveImages',
  'madlibPublications',
  'madlibOperations',
] as const;
export type Feed = (typeof feeds)[number];
export function normalizeRow(feed: Feed, row: ExternalRow) {
  switch (feed) {
    case 'duels':
      return duelEvents(row);
    case 'bounty':
    case 'bountyEntries':
    case 'bountyResults':
      return bountyEvents(feed, row);
    case 'maw':
      return mawEvents(row);
    case 'mawPrizes':
      return mawPrizeEvents(row);
    case 'marketplace':
    case 'purchases':
      return marketplaceEvents(feed, row);
    case 'runs':
    case 'survival':
    case 'onlineRewards':
    case 'imageUses':
      return gauntletEvents(feed, row);
    case 'submissions':
    case 'liveImages':
      return imageEvents(feed, row);
    case 'madlibPublications':
    case 'madlibOperations':
      return madlibEvents(feed, row);
    case 'claimEvents':
      return [
        factory('uglybot', feed, row, 'OTHER')(
          'claim',
          'CHARM_CLAIM_RECORDED',
          row.created_at,
          row.discord_id,
          { amountRecorded: row.amount, payoutType: row.payout_type ?? null },
          { visibility: 'PRIVATE' },
        ),
      ];
  }
}
