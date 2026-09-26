import Link from 'next/link';
import type { passport } from '@/server/provenance';
import { Timeline } from './timeline';
type Data = Awaited<ReturnType<typeof passport>>;
const short = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
const date = (v: string) =>
  new Date(v).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
  });
export function Passport({ data, tokenId }: { data: Data; tokenId: number }) {
  const s = data.summary;
  const url = (page: number) =>
    `/squig/${tokenId}?${new URLSearchParams({ page: String(page), event: data.filters.event, order: data.filters.order })}#passport`;
  return (
    <section id="passport" className="passport">
      <p className="eyebrow">CHAIN OF CUSTODY / ETHEREUM</p>
      <h2>Every Squig has a story.</h2>
      {data.customs.length > 0 && (
        <div className="panel">
          <h3>Official Custom history</h3>
          {data.customs.map((c) => (
            <p key={c.key}>
              <strong>CUSTOM VERIFIED</strong> · {c.name} · {date(c.verifiedAt)}{' '}
              <Link href="#customs">View artwork ↗</Link>
            </p>
          ))}
        </div>
      )}
      {s ? (
        <>
          <p className="provenance-status">
            {s.complete
              ? 'Continuous mint-to-index history'
              : 'History needs review'}{' '}
            · Indexed through block {s.through ?? 'unknown'}
          </p>
          <dl className="provenance-summary">
            {s.mintAt && (
              <div>
                <dt>Born ugly</dt>
                <dd>{date(s.mintAt)}</dd>
                <dd>
                  {s.minterCollector ? (
                    <Link href={`/collector/${s.minterCollector.slug}`}>
                      {s.minterCollector.displayName ?? s.minterCollector.slug}
                    </Link>
                  ) : s.minter ? (
                    short(s.minter)
                  ) : (
                    'Unknown'
                  )}
                </dd>
                {s.mintTransaction && (
                  <dd>
                    <a
                      href={s.mintTransaction}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mint transaction ↗
                    </a>
                  </dd>
                )}
              </div>
            )}
            {s.complete && (
              <>
                <div>
                  <dt>Owner at indexed block</dt>
                  <dd>
                    {s.currentWallet
                      ? short(s.currentWallet)
                      : 'Burned / zero address'}
                  </dd>
                  {s.currentCollector && (
                    <dd>
                      <Link href={`/collector/${s.currentCollector.slug}`}>
                        {s.currentCollector.displayName ??
                          s.currentCollector.slug}
                      </Link>
                    </dd>
                  )}
                  {s.currentSince && <dd>Since {date(s.currentSince)}</dd>}
                </div>
                <div>
                  <dt>Transfers</dt>
                  <dd>{s.transferCount}</dd>
                </div>
                <div>
                  <dt>Unique wallets</dt>
                  <dd>{s.uniqueWallets}</dd>
                </div>
                <div>
                  <dt>Publicly attributed collectors</dt>
                  <dd>{s.knownPublicCollectors}</dd>
                </div>
                {s.longestHoldSeconds !== null && (
                  <div>
                    <dt>Longest indexed hold</dt>
                    <dd>
                      {Math.floor(
                        Number(s.longestHoldSeconds) / 86400,
                      ).toLocaleString()}{' '}
                      days
                    </dd>
                  </div>
                )}
                {s.mintAt && (
                  <div>
                    <dt>Age</dt>
                    <dd>{data.ageDays?.toLocaleString()} days</dd>
                  </div>
                )}
              </>
            )}
          </dl>
          {!s.complete && (
            <p>
              Ownership gaps were detected. Holding statistics are withheld
              until repaired.
            </p>
          )}
          {s.ownerMatches !== null && (
            <p>
              {s.ownerMatches
                ? 'Owner matched ownerOf at the verification block.'
                : 'Owner verification found a mismatch.'}
            </p>
          )}
        </>
      ) : (
        <p>
          Provenance is awaiting indexing or rebuilding. No mint date or holding
          duration is assumed.
        </p>
      )}
      <form className="passport-filters" action={`/squig/${tokenId}#passport`}>
        <label>
          Event
          <select
            name="event"
            aria-label="Passport event type"
            defaultValue={data.filters.event}
          >
            <option value="all">All chain events</option>
            <option value="mint">Mint</option>
            <option value="transfer">Transfers</option>
            <option value="burn">Burns</option>
          </select>
        </label>
        <label>
          Order
          <select
            name="order"
            aria-label="Passport order"
            defaultValue={data.filters.order}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button type="submit">View history</button>
      </form>
      <Timeline
        entries={data.entries.map((e) => ({
          ...e,
          details: [
            { label: 'From', value: e.fromAddress },
            { label: 'To', value: e.toAddress },
            { label: 'Block', value: e.block },
            { label: 'Log index', value: String(e.logIndex) },
          ],
          description:
            e.eventType === 'MINTED'
              ? `Squig #${tokenId} was minted to ${e.toCollector?.displayName ?? e.toCollector?.slug ?? short(e.toAddress)}.`
              : e.eventType === 'BURNED'
                ? `Transferred from ${e.fromCollector?.displayName ?? e.fromCollector?.slug ?? short(e.fromAddress)} to the zero address.`
                : `${e.fromCollector?.displayName ?? e.fromCollector?.slug ?? short(e.fromAddress)} → ${e.toCollector?.displayName ?? e.toCollector?.slug ?? short(e.toAddress)}`,
        }))}
      />
      <nav className="pagination" aria-label="Passport pages">
        {data.page > 1 && <Link href={url(data.page - 1)}>← Previous</Link>}
        <span>
          Page {data.page} of {data.pages} · {data.total} chain events
        </span>
        {data.page < data.pages && (
          <Link href={url(data.page + 1)}>Next →</Link>
        )}
      </nav>
      <p className="fine-print">
        Chain transfers do not prove a sale. Addresses are public chain data;
        collector links require reviewed or dated signature evidence and public
        wallet consent.
      </p>
    </section>
  );
}
