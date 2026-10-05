import { formatAmount } from '@/domain/activity';
import type { balanceView } from '@/domain/charm';
export function CharmBalanceCard({
  value,
}: {
  value: ReturnType<typeof balanceView>;
}) {
  const minutes = value.ageMinutes;
  return (
    <section className="panel charm-balance">
      <p className="eyebrow">CURRENT $CHARM</p>
      <h2>
        {value.balance === null
          ? 'Balance unavailable'
          : `${formatAmount(value.balance)} $CHARM`}
      </h2>
      <p>
        {minutes === null
          ? 'No verified balance yet.'
          : `Updated ${minutes === 0 ? 'less than a minute' : `${minutes} minutes`} ago.`}{' '}
        {value.stale && value.balance !== null
          ? 'Last known balance · refresh pending.'
          : ''}
      </p>
      <p>Authoritative balance from DRIP. Private by default.</p>
    </section>
  );
}
