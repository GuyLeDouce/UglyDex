'use client';
import { useEffect, useState } from 'react';
import {
  squigOpenSeaUrl,
  unavailableListings,
  type OpenSeaListings,
  type SquigListing,
} from '@/domain/opensea';

let cached: OpenSeaListings | null = null;
let expires = 0;
let pending: Promise<OpenSeaListings> | null = null;
async function fetchListings() {
  if (cached && Date.now() < expires) return cached;
  if (!pending)
    pending = fetch('/api/opensea/listings', {
      signal: AbortSignal.timeout(15000),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as OpenSeaListings;
      })
      .catch(() => unavailableListings)
      .then((data) => {
        cached = data;
        expires = data.checkedAt
          ? Date.parse(data.checkedAt) + 60000
          : Date.now() + 60000;
        return data;
      })
      .finally(() => {
        pending = null;
      });
  return pending;
}
export function useOpenSeaListings() {
  const [data, setData] = useState<OpenSeaListings | null>(null);
  useEffect(() => {
    let active = true;
    const update = async () => {
      if (document.hidden) return;
      const result = await fetchListings();
      if (active)
        setData({
          ...result,
          listings: result.listings.filter(
            (l) => Date.parse(l.expiresAt) > Date.now(),
          ),
        });
    };
    void update();
    const timer = setInterval(() => void update(), 15000);
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return data;
}

export function OpenSeaLink({
  tokenId,
  listing,
  status,
  complete,
  checkedAt,
  detail = false,
}: {
  tokenId: number;
  listing?: SquigListing;
  status?: OpenSeaListings['status'];
  complete?: boolean;
  checkedAt?: string | null;
  detail?: boolean;
}) {
  // The shared loader removes expired listings before projecting them into cards.
  const active = listing?.tokenId === tokenId;
  return (
    <div className={`opensea-listing${detail ? ' opensea-detail' : ''}`}>
      <span className="opensea-price">
        {active && listing ? (
          <>
            <strong>
              {listing.amount} {listing.currency}
            </strong>
            <small>Listed on OpenSea</small>
          </>
        ) : status === 'unavailable' ? (
          'Listings unavailable'
        ) : status === 'available' && complete ? (
          'Unlisted'
        ) : (
          'Check listings on OpenSea'
        )}
      </span>
      <a
        href={squigOpenSeaUrl(tokenId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View Squig #${tokenId} on OpenSea (opens in a new tab)`}
      >
        {active ? 'View listing' : 'OpenSea'} <span aria-hidden>↗</span>
      </a>
      {detail && (
        <small className="opensea-note">
          {checkedAt && (
            <>
              Checked{' '}
              <time dateTime={checkedAt}>
                {new Date(checkedAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })}{' '}
                UTC
              </time>
              .{' '}
            </>
          )}
          Prices and availability can change. Confirm on OpenSea.
        </small>
      )}
    </div>
  );
}
export function SquigMarket({ tokenId }: { tokenId: number }) {
  const data = useOpenSeaListings();
  return (
    <OpenSeaLink
      tokenId={tokenId}
      listing={data?.listings.find((l) => l.tokenId === tokenId)}
      status={data?.status}
      complete={data?.complete}
      checkedAt={data?.checkedAt}
      detail
    />
  );
}
