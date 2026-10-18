import 'server-only';
import { z } from 'zod';
import { SQUIGS_CONTRACT, squigToken } from '@/domain/validation';
import {
  listingAmount,
  unavailableListings,
  type OpenSeaListings,
  type SquigListing,
} from '@/domain/opensea';

const uint = z.string().regex(/^\d{1,78}$/);
const item = z.object({
  itemType: z.number(),
  token: z.string(),
  identifierOrCriteria: uint,
  startAmount: uint,
  endAmount: uint,
});
const order = z.object({
  chain: z.literal('ethereum'),
  status: z.literal('ACTIVE'),
  remaining_quantity: z.literal(1),
  price: z.object({
    current: z.object({
      currency: z.string().regex(/^[A-Za-z0-9._-]{1,16}$/),
      decimals: z.number().int().min(0).max(36),
      value: uint,
    }),
  }),
  protocol_data: z.object({
    parameters: z.object({
      startTime: uint,
      endTime: uint,
      offer: z.array(item).length(1),
    }),
  }),
});
const pageSchema = z.object({
  listings: z.array(z.unknown()).max(200),
  next: z.string().max(4096).nullish(),
});

export function parseSquigListing(
  value: unknown,
  now: number,
): SquigListing | null {
  const parsed = order.safeParse(value);
  if (!parsed.success) return null;
  const o = parsed.data,
    p = o.protocol_data.parameters,
    nft = p.offer[0];
  const start = Number(p.startTime) * 1000,
    end = Number(p.endTime) * 1000;
  if (
    nft.itemType !== 2 ||
    nft.token.toLowerCase() !== SQUIGS_CONTRACT ||
    nft.startAmount !== '1' ||
    nft.endAmount !== '1' ||
    start > now ||
    end <= now ||
    !Number.isSafeInteger(end) ||
    end > 8640000000000000 ||
    BigInt(o.price.current.value) <= 0n
  )
    return null;
  try {
    return {
      tokenId: squigToken(nft.identifierOrCriteria),
      amount: listingAmount(o.price.current.value, o.price.current.decimals),
      currency: o.price.current.currency,
      expiresAt: new Date(end).toISOString(),
    };
  } catch {
    return null;
  }
}

// One bounded, coalesced collection read per cache window, not one API call per card.
// Railway runs a persistent Node web service. Each replica maintains its own cache.
export function createOpenSeaReader(
  fetcher: typeof fetch = fetch,
  now = Date.now,
) {
  let cached: OpenSeaListings = unavailableListings;
  let retryAt = 0;
  let pending: Promise<OpenSeaListings> | undefined;
  const current = () => ({
    ...cached,
    listings: cached.listings.filter((l) => Date.parse(l.expiresAt) > now()),
  });
  return async function read(): Promise<OpenSeaListings> {
    const key = process.env.OPENSEA_API_KEY?.trim();
    if (!key) return unavailableListings;
    if (now() < retryAt) return current();
    if (pending) return pending;
    pending = (async () => {
      const listings = new Map<number, SquigListing>();
      const seen = new Set<string>();
      let cursor: string | undefined;
      let complete = false;
      const signal = AbortSignal.timeout(10000);
      try {
        for (let page = 0; page < 10; page++) {
          const url = new URL(
            'https://api.opensea.io/api/v2/listings/collection/squigs-reloaded/best',
          );
          url.searchParams.set('limit', '200');
          url.searchParams.set('include_private_listings', 'false');
          if (cursor) url.searchParams.set('next', cursor);
          const response = await fetcher(url, {
            headers: { 'x-api-key': key, Accept: 'application/json' },
            cache: 'no-store',
            redirect: 'error',
            signal,
          });
          if (response.status === 429) {
            const wait = Number(response.headers.get('retry-after'));
            const reset =
              Number(response.headers.get('x-ratelimit-reset')) * 1000;
            retryAt = Math.max(
              now() + 60000,
              Number.isFinite(wait) ? now() + Math.max(0, wait) * 1000 : 0,
              Number.isFinite(reset) ? reset : 0,
            );
          }
          if (!response.ok) throw new Error('OPENSEA_UNAVAILABLE');
          const result = pageSchema.parse(await response.json());
          for (const raw of result.listings) {
            const listing = parseSquigListing(raw, now());
            // OpenSea returns price-ascending orders; preserve its order across currencies.
            if (listing && !listings.has(listing.tokenId))
              listings.set(listing.tokenId, listing);
          }
          if (!result.next) {
            complete = true;
            break;
          }
          if (seen.has(result.next)) throw new Error('OPENSEA_CURSOR_LOOP');
          seen.add(result.next);
          cursor = result.next;
        }
        cached = {
          status: 'available',
          checkedAt: new Date(now()).toISOString(),
          complete,
          listings: [...listings.values()],
        };
        retryAt = now() + 60000;
      } catch {
        // Never turn an outage, malformed payload, or expired cache into "not listed".
        cached = unavailableListings;
        retryAt = Math.max(retryAt, now() + 60000);
      }
      return current();
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
export const openSeaListings = createOpenSeaReader();
