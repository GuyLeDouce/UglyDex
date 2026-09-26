import { factory, token, money } from '../activity';
import type { ExternalRow } from '../table';
export function bountyEvents(feed: string, row: ExternalRow) {
  const add = factory('uglybot', feed, row, 'BOUNTY');
  if (feed === 'bountyEntries')
    return [
      add(
        'entry',
        'BOUNTY_ENTRY',
        row.added_at,
        null,
        { status: row.status, month: row.month_key },
        {
          squigTokenId: token(row),
          importance: 'STANDARD',
          visibility: row.status === 'active' ? 'PUBLIC' : 'PRIVATE',
        },
      ),
    ];
  if (feed === 'bountyResults')
    return [
      add(
        'winner',
        'BOUNTY_WON',
        row.revealed_at ?? row.created_at,
        row.winner_discord_id,
        {
          prizeType: row.prize_type ?? null,
          prizeProject: row.prize_project ?? null,
          prizeToken: row.prize_token ?? null,
          deliveryStatus: row.delivery_status ?? null,
          payoutStatus: row.payout_status ?? null,
          timeBasis: row.revealed_at ? 'revealed_at' : 'created_at',
        },
        {
          squigTokenId: token(
            row,
            'winning_entry_contract',
            'winning_entry_token_id',
          ),
          walletAddress: row.winner_wallet
            ? String(row.winner_wallet).toLowerCase()
            : undefined,
          importance: 'MAJOR',
          visibility: row.revealed_at ? 'PUBLIC' : 'PRIVATE',
          ...(row.payout_status === 'paid' && money(row.charm_amount)
            ? {
                amount: money(row.charm_amount),
                currency: 'CHARM',
                direction: 'PAYOUT',
              }
            : {}),
        },
      ),
    ];
  return [
    add(
      'donation',
      row.accepted_at
        ? 'BOUNTY_ACCEPTED'
        : row.rejected_at
          ? 'BOUNTY_REJECTED'
          : 'BOUNTY_SUBMITTED',
      row.accepted_at ?? row.rejected_at ?? row.created_at,
      row.sender_discord_id,
      {
        status: row.status,
        project: row.project_name ?? null,
        donatedToken: row.token_id ?? null,
        yesVotes: row.yes_votes ?? null,
        noVotes: row.no_votes ?? null,
        payoutStatus: row.charm_payout_status ?? null,
      },
      { visibility: row.accepted_at ? 'PUBLIC' : 'PRIVATE' },
    ),
  ];
}
