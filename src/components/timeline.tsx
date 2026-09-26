import { activityLabels } from '@/domain/activity';
import Link from 'next/link';
export type TimelineEntry = {
  id: string;
  eventType: string;
  eventAt: string;
  tokenId?: number | null;
  description?: string;
  transaction?: string | null;
  details?: { label: string; value: string }[];
  category?: string;
  importance?: string;
};
const labels: Record<string, string> = {
  ...activityLabels,
  MINTED: 'Born ugly',
  BURNED: 'End of the chain',
  TRANSFERRED: 'New home',
  COLLECTOR_CHANGED: 'A new collector',
  WALLET_MOVE: 'Same collector. New wallet.',
  SELF_TRANSFER: 'Same wallet. Still home.',
  SQUIG_DISCOVERED: 'A new discovery',
  SQUIG_ACQUIRED: 'Welcome back',
  SQUIG_LOST: 'Off to a new home',
  OWNERSHIP_CONFIRMED: 'Holding confirmed',
  ATTRIBUTION_ENDED: 'Identity evidence ended',
  COLLECTOR_FIRST_DISCOVERY: 'Your first indexed discovery',
};
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return entries.length ? (
    <ol className="history-timeline">
      {entries.map((e) => (
        <li
          key={e.id}
          data-importance={e.importance}
          data-category={e.category}
        >
          <time dateTime={e.eventAt}>
            {new Date(e.eventAt).toLocaleString('en-US', {
              timeZone: 'UTC',
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            UTC
          </time>
          <div>
            <h3>
              {labels[e.eventType] ??
                e.eventType.replaceAll('_', ' ').toLowerCase()}
            </h3>
            {e.tokenId && (
              <Link href={`/squig/${e.tokenId}`}>Squig #{e.tokenId} ↗</Link>
            )}
            {e.description && <p>{e.description}</p>}
            {e.transaction && (
              <a
                className="text-link"
                href={e.transaction}
                target="_blank"
                rel="noreferrer"
              >
                View transaction ↗
              </a>
            )}
            {e.details && (
              <details className="chain-details">
                <summary>Event details</summary>
                <dl>
                  {e.details.map((d) => (
                    <div key={d.label}>
                      <dt>{d.label}</dt>
                      <dd>{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <p>No confirmed history indexed yet.</p>
  );
}
