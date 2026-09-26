import { factory, money } from '../activity';
import type { ExternalRow } from '../table';
export function marketplaceEvents(feed: string, row: ExternalRow) {
  const add = factory('uglybot', feed, row, 'MARKETPLACE'),
    classic = feed === 'purchases',
    who = classic ? row.discord_id : row.user_id;
  const confirmed =
    classic ||
    ['paid_pending_delivery', 'delivered'].includes(String(row.status));
  const amount = money(classic ? row.spent_amount : row.price);
  const events = [
    add(
      'purchase',
      'MARKETPLACE_PURCHASE',
      row.created_at,
      who,
      {
        status: classic ? 'purchased' : row.status,
        item: row.item_name ?? row.item_key ?? String(row.item_id),
        quantity: row.quantity ?? 1,
        itemIdentity: `${feed}:${String(classic ? row.item_id : row.item_key)}`,
        confirmed,
      },
      {
        visibility: confirmed ? 'PUBLIC' : 'PRIVATE',
        ...(confirmed && amount
          ? { amount, currency: 'CHARM', direction: 'SPEND' }
          : {}),
      },
    ),
  ];
  if (classic && row.refunded_at && money(row.refunded_amount))
    events.push(
      add(
        'refund',
        'MARKETPLACE_REFUND',
        row.refunded_at,
        who,
        {},
        {
          amount: money(row.refunded_amount),
          currency: 'CHARM',
          direction: 'REFUND',
        },
      ),
    );
  return events;
}
