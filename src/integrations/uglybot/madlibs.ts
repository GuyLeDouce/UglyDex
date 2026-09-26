import { factory, money } from '../activity';
import type { ExternalRow } from '../table';
export function madlibEvents(feed: string, row: ExternalRow) {
  const add = factory('uglybot', feed, row, 'MADLIBS');
  if (feed === 'madlibPublications')
    return [
      add(
        'publication',
        'MADLIB_PUBLISHED',
        row.created_at,
        row.user_id,
        { status: row.status, timeBasis: 'publication_created_at' },
        {
          visibility:
            row.status === 'published' && row.suspended !== true
              ? 'PUBLIC'
              : 'PRIVATE',
        },
      ),
    ];
  return [
    add(
      'operation',
      'MADLIB_PAYMENT',
      row.confirmed_at ?? row.created_at,
      row.user_id,
      { state: row.state, kind: row.kind, currencyId: row.currency_id },
      {
        visibility: 'PRIVATE',
        ...(row.state === 'confirmed_success' && money(row.amount)
          ? {
              amount: money(row.amount),
              currency: 'CHARM',
              direction:
                row.kind === 'debit'
                  ? 'SPEND'
                  : row.kind === 'refund'
                    ? 'REFUND'
                    : 'EARN',
            }
          : {}),
      },
    ),
  ];
}
