import { activitySchema, type NormalizedActivity } from '@/domain/events';
import { SQUIGS_CONTRACT, squigToken } from '@/domain/validation';
import type { ExternalRow } from '@/integrations/table';
export type Feed =
  | 'duels'
  | 'marketplace'
  | 'purchases'
  | 'bounty'
  | 'maw'
  | 'claimEvents'
  | 'runs'
  | 'survival'
  | 'submissions';
function asset(row: ExternalRow): number | undefined {
  if (
    String(row.contract_address).toLowerCase() !== SQUIGS_CONTRACT ||
    (row.chain && row.chain !== 'ethereum')
  )
    return undefined;
  return squigToken(row.token_id);
}
export function normalizeRow(
  feed: Feed,
  row: ExternalRow,
): NormalizedActivity[] {
  const events: unknown[] = [];
  const system = ['runs', 'survival'].includes(feed)
    ? 'gauntlet'
    : feed === 'submissions'
      ? 'images'
      : 'uglybot';
  const add = (
    id: unknown,
    type: string,
    at: unknown,
    metadata: ExternalRow,
    token?: number,
    sourceId = String(row.id),
  ) => {
    if (id === null || id === undefined) return;
    if (at === null || at === undefined) throw new Error('MISSING_EVENT_TIME');
    events.push({
      sourceSystem: system,
      sourceType: feed,
      sourceId,
      discordId: String(id),
      eventType: type,
      eventAt: at,
      metadata,
      ...(token ? { squigTokenId: token } : {}),
    });
  };
  if (feed === 'duels') {
    for (const role of ['challenger', 'opponent']) {
      const id = row[`${role}_id`];
      if (!id || !/^\d{17,20}$/.test(String(id))) continue; // Bot opponents are not Discord collectors.
      const token = row[`${role}_squig_token_id`];
      add(
        id,
        'DUEL_PARTICIPATED',
        row.completed_at ?? row.created_at,
        {
          status: row.status,
          winnerId: row.winner_id ?? null,
          wagerAmount: row.wager_amount ?? null,
          role,
          timeBasis: row.completed_at ? 'completed_at' : 'created_at',
        },
        token ? squigToken(token) : undefined,
      );
    }
  } else if (feed === 'marketplace')
    add(row.user_id, 'MARKETPLACE_ORDER', row.created_at, {
      status: row.status,
      itemKey: row.item_key,
      price: row.price,
      deliveredAt:
        row.delivered_at instanceof Date
          ? row.delivered_at.toISOString()
          : row.delivered_at,
    });
  else if (feed === 'purchases')
    add(row.discord_id, 'MARKETPLACE_PURCHASE', row.created_at, {
      spentAmount: row.spent_amount,
      quantity: row.quantity,
      refundedAmount: row.refunded_amount,
      refundedAt:
        row.refunded_at instanceof Date
          ? row.refunded_at.toISOString()
          : row.refunded_at,
    });
  else if (feed === 'bounty')
    add(
      row.sender_discord_id,
      'BOUNTY_SUBMITTED',
      row.created_at,
      {
        status: row.status,
        yesVotes: row.yes_votes,
        noVotes: row.no_votes,
        payoutStatus: row.charm_payout_status,
      },
      asset(row),
    );
  else if (feed === 'maw') {
    if (row.received_at)
      add(
        row.discord_user_id,
        'MAW_FEED',
        row.received_at,
        {
          status: row.status,
          payoutAmount: row.payout_amount,
          payoutStatus: row.payout_status,
          rarityTier: row.rarity_tier,
          disposition: row.squig_disposition,
        },
        asset(row),
      );
  } else if (feed === 'claimEvents')
    add(row.discord_id, 'CHARM_CLAIM_RECORDED', row.created_at, {
      amount: row.amount,
      nftCount: row.nft_count,
      payoutType: row.payout_type,
    });
  else if (feed === 'runs')
    add(row.user_id, 'GAUNTLET_COMPLETED', row.finished_at, {
      score: row.score,
      resultType: row.result_type,
      finalRound: row.final_round,
    });
  else if (feed === 'survival')
    add(
      row.user_id,
      'SURVIVAL_PARTICIPATED',
      row.started_at,
      {
        placement: row.placement,
        eliminations: row.eliminations,
        deaths: row.deaths,
        imagesUsed: row.images_used,
        timeBasis: 'game_started_at',
      },
      undefined,
      `${row.game_id}:${row.user_id}`,
    );
  else if (feed === 'submissions') {
    // One mutable lifecycle observation also reflects later decline/correction.
    add(row.discord_user_id, 'IMAGE_SUBMISSION', row.submitted_at, {
      status: row.status,
      rewardPoints: row.reward_points,
      eraKey: row.era_key,
      milestoneKey: row.milestone_key,
      milestoneNumber: row.milestone_number,
      reviewedAt:
        row.reviewed_at instanceof Date
          ? row.reviewed_at.toISOString()
          : row.reviewed_at,
    });
  }
  return events.map((event) => activitySchema.parse(event));
}
