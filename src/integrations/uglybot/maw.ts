import { factory, token, money } from '../activity';
import type { ExternalRow } from '../table';
export function mawEvents(row: ExternalRow) {
  if (!row.received_at) return [];
  const add = factory('uglybot', 'maw', row, 'MAW'),
    squigTokenId = token(row);
  const events = [
    add(
      'feed',
      row.squig_disposition === 'swallowed'
        ? 'MAW_SWALLOWED'
        : row.squig_disposition === 'regurgitated'
          ? 'MAW_REGURGITATED'
          : 'MAW_FED',
      row.received_at,
      row.discord_user_id,
      {
        status: row.status,
        rarityTier: row.rarity_tier ?? null,
        mawRank: row.overall_rank ?? null,
        tickets: row.ticket_count ?? null,
        jackpotContribution: row.jackpot_contribution_charm ?? null,
        payoutStatus: row.payout_status ?? null,
        transactionHash: row.received_tx_hash ?? null,
        timeBasis: 'received_at',
      },
      {
        squigTokenId,
        importance: 'MAJOR',
        ...(row.payout_status === 'paid' && money(row.payout_amount)
          ? {
              amount: money(row.payout_amount),
              currency: 'CHARM',
              direction: 'PAYOUT',
            }
          : {}),
      },
    ),
  ];
  if (
    row.burn_confirmed_at &&
    /^0x[a-fA-F0-9]{64}$/.test(String(row.burn_transaction_hash)) &&
    ['burn_verified', 'receipt_failed', 'digested'].includes(
      String(row.digestion_status),
    )
  )
    events.push(
      add(
        'burn',
        'MAW_DIGESTED',
        row.burn_confirmed_at,
        row.discord_user_id,
        {
          transactionHash: String(row.burn_transaction_hash).toLowerCase(),
          confirmation: 'source_verified_burn',
        },
        { squigTokenId, importance: 'MAJOR' },
      ),
    );
  return events;
}

export function mawPrizeEvents(row: ExternalRow) {
  if (row.status !== 'delivered') return [];
  return [
    factory('uglybot', 'mawPrizes', row, 'MAW')(
      'prize',
      'MAW_PRIZE_DELIVERED',
      row.updated_at,
      row.delivered_to_discord_id,
      {
        transactionHash: row.delivered_tx_hash ?? null,
        timeBasis: 'last_source_update',
        rarityTier: row.rarity_tier ?? null,
      },
      { squigTokenId: token(row), importance: 'MAJOR' },
    ),
  ];
}
