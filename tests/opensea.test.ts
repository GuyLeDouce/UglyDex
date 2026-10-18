import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createOpenSeaReader, parseSquigListing } from '../src/server/opensea';
import {
  listingAmount,
  squigOpenSeaUrl,
  sortedListings,
} from '../src/domain/opensea';
import { SQUIGS_CONTRACT } from '../src/domain/validation';
import { OpenSeaLink } from '../src/components/opensea';
import { SquigCard } from '../src/components/collection';

const now = Date.UTC(2026, 9, 18);
function fixture(token = 1, price = '1400000000000000') {
  return {
    chain: 'ethereum',
    status: 'ACTIVE',
    remaining_quantity: 1,
    price: { current: { currency: 'ETH', decimals: 18, value: price } },
    protocol_data: {
      parameters: {
        startTime: String(now / 1000 - 100),
        endTime: String(now / 1000 + 3600),
        offer: [
          {
            itemType: 2,
            token: String(SQUIGS_CONTRACT),
            identifierOrCriteria: String(token),
            startAmount: '1',
            endAmount: '1',
          },
        ],
      },
    },
  };
}
const response = (listings: unknown[], next?: string) =>
  Response.json({ listings, next });
afterEach(() => vi.unstubAllEnvs());

describe('OpenSea listing projection', () => {
  it('orders the full listing set before pagination without mutating shared data', () => {
    const listings = Array.from({ length: 30 }, (_, i) => ({
      tokenId: i + 1,
      amount: String(i + 1),
      currency: 'ETH',
      expiresAt: '2099-01-01T00:00:00Z',
    }));
    expect(
      sortedListings(listings, 'price-desc')
        .slice(0, 24)
        .map((l) => l.tokenId),
    ).toEqual(Array.from({ length: 24 }, (_, i) => 30 - i));
    expect(
      sortedListings(listings, 'price-desc')
        .slice(24)
        .map((l) => l.tokenId),
    ).toEqual([6, 5, 4, 3, 2, 1]);
    expect(sortedListings(listings, 'price-asc')).toEqual(listings);
    expect(listings[0].tokenId).toBe(1);
  });
  it('preserves OpenSea cross-currency ordering instead of comparing nominal amounts', () => {
    const listings = [
      {
        tokenId: 1,
        amount: '10',
        currency: 'USDC',
        expiresAt: '2099-01-01T00:00:00Z',
      },
      {
        tokenId: 2,
        amount: '0.1',
        currency: 'ETH',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    ];
    expect(sortedListings(listings, 'price-asc').map((l) => l.tokenId)).toEqual(
      [1, 2],
    );
    expect(
      sortedListings(listings, 'price-desc').map((l) => l.tokenId),
    ).toEqual([2, 1]);
  });
  it('uses the canonical contract for every Squig link', () => {
    for (let token = 1; token <= 4444; token++)
      expect(squigOpenSeaUrl(token)).toBe(
        `https://opensea.io/assets/ethereum/${SQUIGS_CONTRACT}/${token}`,
      );
    for (const token of [0, 4445, -1, 1.5, NaN])
      expect(() => squigOpenSeaUrl(token)).toThrow();
  });
  it('preserves base-unit precision without floating point rounding', () => {
    expect(listingAmount('1400000000000000', 18)).toBe('0.0014');
    expect(listingAmount('1', 18)).toBe('0.000000000000000001');
    expect(listingAmount('1234567890123456789012345678', 18)).toBe(
      '1234567890.123456789012345678',
    );
    expect(listingAmount('120', 0)).toBe('120');
  });
  it('projects only public display fields', () => {
    expect(parseSquigListing(fixture(), now)).toEqual({
      tokenId: 1,
      amount: '0.0014',
      currency: 'ETH',
      expiresAt: new Date(now + 3600000).toISOString(),
    });
  });
  it.each(['CANCELLED', 'EXPIRED', 'INACTIVE', 'FULFILLED'])(
    'rejects %s orders',
    (status) =>
      expect(parseSquigListing({ ...fixture(), status }, now)).toBeNull(),
  );
  it('rejects wrong chain, contract, quantities, malformed prices, and token IDs', () => {
    const badContract = fixture();
    badContract.protocol_data.parameters.offer[0].token =
      '0x0000000000000000000000000000000000000000';
    const badItem = fixture();
    badItem.protocol_data.parameters.offer[0].itemType = 4;
    const bundle = fixture();
    bundle.protocol_data.parameters.offer.push(
      bundle.protocol_data.parameters.offer[0],
    );
    const badAmount = fixture();
    badAmount.price.current.decimals = 300;
    const badQuantity = fixture();
    badQuantity.protocol_data.parameters.offer[0].endAmount = '2';
    for (const raw of [
      null,
      {},
      { ...fixture(), chain: 'base' },
      badContract,
      badItem,
      bundle,
      badAmount,
      badQuantity,
      fixture(4445),
      fixture(1, '-1'),
      fixture(1, '0'),
      { ...fixture(), remaining_quantity: 0 },
    ])
      expect(parseSquigListing(raw, now)).toBeNull();
  });
  it('excludes future and expired listings', () => {
    expect(parseSquigListing(fixture(), now + 3600000)).toBeNull();
    expect(parseSquigListing(fixture(), now - 200000)).toBeNull();
  });
});

describe('bounded listing reads', () => {
  it('leaves links usable without a key and makes no network request', async () => {
    vi.stubEnv('OPENSEA_API_KEY', '');
    const fetcher = vi.fn();
    expect((await createOpenSeaReader(fetcher)()).status).toBe('unavailable');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('paginates, deduplicates, caches, and coalesces requests with server-only authentication', async () => {
    vi.stubEnv('OPENSEA_API_KEY', 'test-secret');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([fixture()], 'page2'))
      .mockResolvedValueOnce(
        response([fixture(1, '2000000000000000'), fixture(2)]),
      );
    const read = createOpenSeaReader(fetcher, () => now);
    const [first, second] = await Promise.all([read(), read()]);
    expect(first).toEqual(second);
    expect(first.complete).toBe(true);
    expect(first.listings.map((l) => l.tokenId)).toEqual([1, 2]);
    expect(first.listings[0].amount).toBe('0.0014');
    await read();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      fetcher.mock.calls[0][0].searchParams.get('include_private_listings'),
    ).toBe('false');
    expect(fetcher.mock.calls[1][0].searchParams.get('next')).toBe('page2');
    expect(fetcher.mock.calls[0][1].headers['x-api-key']).toBe('test-secret');
    expect(JSON.stringify(first)).not.toContain('test-secret');
  });
  it('drops expired listings even within the cache window', async () => {
    vi.stubEnv('OPENSEA_API_KEY', 'test');
    let time = now;
    const raw = fixture();
    raw.protocol_data.parameters.endTime = String(now / 1000 + 10);
    const fetcher = vi.fn().mockResolvedValue(response([raw]));
    const read = createOpenSeaReader(fetcher, () => time);
    expect((await read()).listings).toHaveLength(1);
    time += 11000;
    expect((await read()).listings).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('honors rate-limit reset without retrying on every page view', async () => {
    vi.stubEnv('OPENSEA_API_KEY', 'test');
    let time = now;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 429,
          headers: {
            'retry-after': '120',
            'x-ratelimit-reset': String(now / 1000 + 180),
          },
        }),
      )
      .mockResolvedValueOnce(response([]));
    const read = createOpenSeaReader(fetcher, () => time);
    expect((await read()).status).toBe('unavailable');
    time += 121000;
    await read();
    expect(fetcher).toHaveBeenCalledTimes(1);
    time += 60000;
    expect((await read()).status).toBe('available');
  });
  it.each([401, 403, 404, 500])(
    'does not mislabel HTTP %s as not listed',
    async (status) => {
      vi.stubEnv('OPENSEA_API_KEY', 'test');
      const result = await createOpenSeaReader(
        vi.fn().mockResolvedValue(new Response('', { status })),
        () => now,
      )();
      expect(result).toMatchObject({
        status: 'unavailable',
        complete: false,
        checkedAt: null,
        listings: [],
      });
    },
  );
  it('handles invalid payloads, connection failures, and cursor loops', async () => {
    vi.stubEnv('OPENSEA_API_KEY', 'test');
    for (const fetcher of [
      vi.fn().mockResolvedValue(Response.json({})),
      vi.fn().mockRejectedValue(new Error('network')),
      vi.fn().mockImplementation(() => response([fixture()], 'repeat')),
    ]) {
      expect((await createOpenSeaReader(fetcher, () => now)()).status).toBe(
        'unavailable',
      );
    }
  });
  it('bounds pagination and explicitly marks partial results', async () => {
    vi.stubEnv('OPENSEA_API_KEY', 'test');
    let page = 0;
    const fetcher = vi
      .fn()
      .mockImplementation(() => response([fixture(++page)], String(page)));
    const result = await createOpenSeaReader(fetcher, () => now)();
    expect(fetcher).toHaveBeenCalledTimes(10);
    expect(result.complete).toBe(false);
    expect(result.listings).toHaveLength(10);
  });
  it('does not serve a stale asking price when refresh fails', async () => {
    vi.stubEnv('OPENSEA_API_KEY', 'test');
    let time = now;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([fixture()]))
      .mockRejectedValueOnce(new Error('offline'));
    const read = createOpenSeaReader(fetcher, () => time);
    expect((await read()).listings).toHaveLength(1);
    time += 61000;
    expect(await read()).toMatchObject({ status: 'unavailable', listings: [] });
  });
});

describe('OpenSea card presentation', () => {
  it('keeps the detail link and external marketplace link as separate keyboard targets', () => {
    const html = renderToStaticMarkup(
      createElement(SquigCard, {
        item: {
          tokenId: 1,
          name: 'Squig #1',
          image: null,
          uglyPoints: null,
          mawRank: null,
          rarity: null,
          og: false,
          legendary: false,
          traits: [],
        },
      }),
    );
    expect(html).toContain('href="/squig/1"');
    expect(html).toContain(squigOpenSeaUrl(1));
    expect(html).toContain('opens in a new tab');
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>).)*<a\b/s);
  });
  it('distinguishes unavailable data and shows precise listed prices', () => {
    const html = renderToStaticMarkup(
      createElement(OpenSeaLink, { tokenId: 1, status: 'unavailable' }),
    );
    expect(html).toContain('Listings unavailable');
    expect(html).not.toContain('Unlisted');
    const listed = renderToStaticMarkup(
      createElement(OpenSeaLink, {
        tokenId: 1,
        listing: {
          tokenId: 1,
          amount: '0.0014',
          currency: 'ETH',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      }),
    );
    expect(listed).toContain('0.0014');
    expect(listed).toContain('Listed on OpenSea');
    expect(listed).toContain('View listing');
  });
  it('only calls a token Unlisted after a complete successful lookup', () => {
    for (const complete of [false, undefined, true]) {
      const html = renderToStaticMarkup(
        createElement(OpenSeaLink, {
          tokenId: 1,
          status: 'available',
          complete,
        }),
      );
      expect(html.includes('Unlisted')).toBe(complete === true);
      expect(html).toContain(squigOpenSeaUrl(1));
    }
    expect(
      renderToStaticMarkup(createElement(OpenSeaLink, { tokenId: 1 })),
    ).not.toContain('Unlisted');
  });
});
