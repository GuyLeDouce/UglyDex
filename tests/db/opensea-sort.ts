import { db } from '../../src/server/db';
import { catalogScope, collectionPage } from '../../src/server/collections';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import catalog from '../../data/squigs.json';
import { createOpenSeaReader } from '../../src/server/opensea';
import { listedSquigPage } from '../../src/server/listed-squigs';
import { COLLECTION_RULESET } from '../../src/domain/dex';

export async function openSeaSortTests(check: (v: unknown, m: string) => void) {
  const key = process.env.OPENSEA_API_KEY;
  try {
    delete process.env.OPENSEA_API_KEY;
    const unavailable = await collectionPage({ sort: 'price-asc' });
    check(
      unavailable.market?.status === 'unavailable' &&
        unavailable.items.length === 0,
      'price sorting does not substitute unlisted tokens during an API outage',
    );
    for (const record of catalog.records.slice(0, 31)) {
      const identity = {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: record.tokenId,
      };
      await db().squig.upsert({
        where: { chainId_contractAddress_tokenId: identity },
        create: {
          ...identity,
          name: record.name,
          rarityTier: record.rarityTier,
        },
        update: {},
      });
    }
    const tokens = await db().squig.findMany({
      where: catalogScope,
      select: { tokenId: true, rarityTier: true },
      orderBy: { tokenId: 'asc' },
      take: 31,
    });
    check(tokens.length === 31, 'listing sort fixture covers multiple pages');
    const listed = tokens.slice(0, 30).reverse();
    const now = Math.floor(Date.now() / 1000);
    process.env.OPENSEA_API_KEY = 'test-only';
    const readListings = createOpenSeaReader(async () =>
      Response.json({
        listings: listed.map((r, i) => ({
          chain: 'ethereum',
          status: 'ACTIVE',
          remaining_quantity: 1,
          price: {
            current: {
              currency: 'ETH',
              decimals: 18,
              value: String(BigInt(i + 1) * 1000000000000000n),
            },
          },
          protocol_data: {
            parameters: {
              startTime: String(now - 60),
              endTime: String(now + 3600),
              offer: [
                {
                  itemType: 2,
                  token: SQUIGS_CONTRACT,
                  identifierOrCriteria: String(r.tokenId),
                  startAmount: '1',
                  endAmount: '1',
                },
              ],
            },
          },
        })),
        next: null,
      }),
    );
    const readPage = (params: Record<string, string>) =>
      collectionPage(params, undefined, false, undefined, readListings);
    for (const [i, token] of tokens.entries()) {
      await db().squig.updateMany({
        where: { ...catalogScope, tokenId: token.tokenId },
        data: {
          uglyPoints: i === 0 ? null : 1000 - i,
          mawRank: i === 0 ? null : i,
        },
      });
    }
    for (const sort of [
      'points-asc',
      'points-desc',
      'rank',
      'rank-desc',
    ] as const) {
      const market = await readListings();
      const first = await listedSquigPage(market, sort);
      const second = await listedSquigPage(market, sort, 2);
      const combined = [...first.items, ...second.items];
      check(
        combined.length === 30 &&
          new Set(combined.map((s) => s.tokenId)).size === 30,
        `${sort} sorts all listed Squigs across pages`,
      );
      const expected = [...tokens.slice(1, 30)];
      if (sort === 'points-asc' || sort === 'rank-desc') expected.reverse();
      expected.push(tokens[0]);
      check(
        JSON.stringify(combined.map((s) => s.tokenId)) ===
          JSON.stringify(expected.map((s) => s.tokenId)),
        `${sort} uses canonical stats with null values last`,
      );
      check(
        !combined.some((s) => s.tokenId === tokens[30].tokenId),
        `${sort} never adds an unlisted Squig`,
      );
    }
    for (const sort of ['price-asc', 'price-desc'] as const) {
      const expected = sort === 'price-asc' ? listed : [...listed].reverse();
      const first = await readPage({ sort });
      const second = await readPage({ sort, page: '2' });
      check(
        first.total === 30 &&
          first.pages === 2 &&
          first.items.length === 24 &&
          second.items.length === 6,
        `${sort} counts listed results and paginates the full set`,
      );
      check(
        JSON.stringify(
          [...first.items, ...second.items].map((r) => r.tokenId),
        ) === JSON.stringify(expected.map((r) => r.tokenId)),
        `${sort} preserves global price order across pages`,
      );
      const rarity = listed[0].rarityTier!;
      const filtered = await readPage({ sort, rarity });
      check(
        filtered.total ===
          listed.filter((r) => r.rarityTier === rarity).length &&
          filtered.items.every((r) => r.rarity === rarity),
        `${sort} intersects existing class filters`,
      );
      const token = await readPage({
        sort,
        q: String(listed[0].tokenId),
      });
      check(
        token.total === 1 && token.items[0].tokenId === listed[0].tokenId,
        `${sort} retains token filters`,
      );
      const unlisted = await readPage({
        sort,
        q: String(tokens[30].tokenId),
      });
      check(
        unlisted.total === 0 && unlisted.items.length === 0,
        `${sort} excludes an unlisted token`,
      );
      const clamped = await readPage({ sort, page: '186' });
      check(
        clamped.page === 2 && clamped.items.length === 6,
        `${sort} clamps pagination to listed results`,
      );
    }
    const collector = await db().collector.create({
      data: { slug: 'listing-personalization' },
    });
    try {
      const candidates = Object.fromEntries(
        tokens.map((t, i) => [
          t.tokenId,
          {
            discovered: i < 10,
            owned: i < 2,
            missingTraits: i < 27 ? 2 : 0,
            sets:
              i === 0
                ? []
                : i >= 25
                  ? ['first-specimen', 'og-archive']
                  : ['first-specimen'],
          },
        ]),
      );
      await db().collectionSnapshot.create({
        data: {
          collectorId: collector.id,
          ruleset: COLLECTION_RULESET,
          discovered: 10,
          traits: 0,
          historicalSets: 0,
          currentSets: 0,
          overall: 0,
          discoveredTokenIds: [],
          currentTokenIds: [],
          candidates,
        },
      });
      await db().collectionJob.deleteMany({
        where: { collectorId: collector.id },
      });
      const market = await readListings();
      const byImpact = (a: { tokenId: number }, b: { tokenId: number }) =>
        candidates[b.tokenId].sets.length - candidates[a.tokenId].sets.length ||
        a.tokenId - b.tokenId;
      const listedFirst = await listedSquigPage(
        market,
        'sets-desc',
        1,
        collector.id,
      );
      const listedSecond = await listedSquigPage(
        market,
        'sets-desc',
        2,
        collector.id,
      );
      check(
        JSON.stringify(
          [...listedFirst.items, ...listedSecond.items].map((c) => c.tokenId),
        ) ===
          JSON.stringify(
            [...tokens.slice(0, 30)].sort(byImpact).map((t) => t.tokenId),
          ),
        'most sets advanced globally orders listed tokens before pagination with stable ties',
      );
      const setPage = (page: string) =>
        collectionPage(
          { sort: 'sets-desc', dex: 'advances', page },
          undefined,
          false,
          collector.id,
          readListings,
        );
      const setFirst = await setPage('1');
      const setSecond = await setPage('2');
      const expectedSets = tokens
        .filter((t) => candidates[t.tokenId].sets.length > 0)
        .sort(byImpact);
      check(
        setFirst.total === expectedSets.length &&
          setFirst.items.length === 24 &&
          JSON.stringify(
            [...setFirst.items, ...setSecond.items].map((c) => c.tokenId),
          ) === JSON.stringify(expectedSets.map((t) => t.tokenId)),
        'catalog set sort intersects personal filters and sorts globally before pagination',
      );
      const searchedSet = await collectionPage(
        { sort: 'sets-desc', q: String(tokens[29].tokenId) },
        undefined,
        false,
        collector.id,
        readListings,
      );
      check(
        searchedSet.total === 1 &&
          searchedSet.items[0].tokenId === tokens[29].tokenId,
        'set sorting retains token search',
      );
      for (const sort of [
        'sets-desc',
        'price-asc',
        'price-desc',
        'points-asc',
        'points-desc',
        'rank',
        'rank-desc',
      ] as const) {
        const all = await listedSquigPage(market, sort, 1, collector.id);
        check(
          all.items.every(
            (c) =>
              c.personalization?.missingTraits ===
                candidates[c.tokenId].missingTraits &&
              c.personalization?.advances === candidates[c.tokenId].sets.length,
          ),
          `${sort} cards retain personal missing traits and set progress`,
        );
        for (const dex of ['traits', 'advances', 'undiscovered'] as const) {
          const first = await listedSquigPage(
            market,
            sort,
            1,
            collector.id,
            dex,
          );
          const second =
            first.pages > 1
              ? await listedSquigPage(market, sort, 2, collector.id, dex)
              : null;
          const expected = [
            ...all.items,
            ...(await listedSquigPage(market, sort, 2, collector.id)).items,
          ].filter((c) =>
            dex === 'traits'
              ? c.personalization!.missingTraits > 0
              : dex === 'advances'
                ? c.personalization!.advances > 0
                : !c.personalization!.discovered,
          );
          check(
            JSON.stringify(
              [...first.items, ...(second?.items ?? [])].map((c) => c.tokenId),
            ) === JSON.stringify(expected.map((c) => c.tokenId)) &&
              first.total === expected.length,
            `${sort} applies ${dex} before pagination without changing order`,
          );
        }
      }
      const anonymous = await listedSquigPage(market, 'price-asc');
      check(
        anonymous.items.every((c) => !c.personalization),
        'anonymous listings have no collector personalization',
      );
      await db().collectionJob.create({ data: { collectorId: collector.id } });
      const pendingSets = await collectionPage(
        { sort: 'sets-desc' },
        undefined,
        false,
        collector.id,
        readListings,
      );
      const pendingListedSets = await listedSquigPage(
        market,
        'sets-desc',
        1,
        collector.id,
      );
      check(
        pendingSets.setSortUnavailable &&
          pendingSets.items.every((c) => !c.personalization),
        'catalog set sorting does not use stale snapshot during recalculation',
      );
      check(
        pendingListedSets.personalizationPending &&
          JSON.stringify(pendingListedSets.items.map((c) => c.tokenId)) ===
            JSON.stringify(tokens.slice(0, 24).map((t) => t.tokenId)),
        'listed set sorting falls back to token order while recalculation is pending',
      );
      const anonymousSets = await collectionPage({ sort: 'sets-desc' });
      check(
        anonymousSets.setSortUnavailable &&
          anonymousSets.items.every((c) => !c.personalization),
        'anonymous requests cannot obtain personalized set rankings',
      );
      const pending = await listedSquigPage(
        market,
        'price-asc',
        1,
        collector.id,
      );
      const pendingFiltered = await listedSquigPage(
        market,
        'price-asc',
        1,
        collector.id,
        'traits',
      );
      check(
        pending.personalizationPending &&
          pending.items.length === 24 &&
          pending.items.every((c) => !c.personalization),
        'pending projection keeps listings but suppresses stale personalization',
      );
      check(
        pendingFiltered.total === 0 && pendingFiltered.personalizationPending,
        'pending projection never invents matching missing traits',
      );
    } finally {
      await db().collector.delete({ where: { id: collector.id } });
    }
  } finally {
    if (key === undefined) delete process.env.OPENSEA_API_KEY;
    else process.env.OPENSEA_API_KEY = key;
  }
}
