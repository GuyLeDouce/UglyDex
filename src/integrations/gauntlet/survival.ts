import { factory, money } from '../activity';
import type { ExternalRow } from '../table';
export function gauntletEvents(feed: string, row: ExternalRow) {
  const add = factory('gauntlet', feed, row, 'SURVIVAL');
  if (feed === 'runs')
    return [
      add('run', 'GAUNTLET_COMPLETED', row.finished_at, row.user_id, {
        score: row.score,
        resultType: row.result_type ?? null,
        finalRound: row.final_round ?? null,
      }),
    ];
  if (feed === 'onlineRewards')
    return [
      add(
        'reward',
        'GAUNTLET_REWARD',
        row.processed_at ?? row.created_at,
        row.discord_user_id,
        { status: row.status },
        {
          visibility: 'PRIVATE',
          ...(row.status === 'paid' && money(row.amount)
            ? {
                amount: money(row.amount),
                currency: 'CHARM',
                direction: 'PAYOUT',
              }
            : {}),
        },
      ),
    ];
  if (feed === 'imageUses')
    return [
      add(
        'use',
        'SURVIVAL_IMAGE_USED',
        row.used_at,
        row.user_id,
        { imageUrl: row.image_url, gameId: String(row.game_id) },
        { importance: 'DETAIL' },
      ),
    ];
  for (const key of ['eliminations', 'deaths', 'images_used'])
    if (!Number.isInteger(Number(row[key])) || Number(row[key]) < 0)
      throw new Error('INVALID_GAME_METRIC');
  return [
    add(
      'player',
      'SURVIVAL_PLAYED',
      row.started_at,
      row.user_id,
      {
        placement: row.placement == null ? null : Number(row.placement),
        eliminations: Number(row.eliminations),
        deaths: Number(row.deaths),
        imagesUsed: Number(row.images_used),
        timeBasis: 'game_started_at',
      },
      { visibility: row.placement != null ? 'PUBLIC' : 'PRIVATE' },
    ),
  ];
}
