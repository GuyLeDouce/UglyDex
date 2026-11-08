import { describe, expect, it } from 'vitest';
import { catalogLink, tokenSearch } from '../src/domain/catalog-navigation';
import { SQUIGS_CONTRACT } from '../src/domain/validation';
import {
  ALBUM_PAGE_SIZE,
  filterSchema,
  PAGE_SIZE,
} from '../src/domain/collection';

describe('Squig reference search', () => {
  it.each([
    '1497',
    '#1497',
    ' Squig #1497 ',
    '/squig/1497',
    'https://uglydex-production.up.railway.app/squig/1497?source=share',
    `https://opensea.io/assets/ethereum/${SQUIGS_CONTRACT}/1497`,
    `https://opensea.io/item/ethereum/${SQUIGS_CONTRACT}/1497`,
  ])('resolves %s to the same token', (value) => {
    expect(tokenSearch(value)).toEqual({ token: 1497, invalid: false });
    expect(filterSchema.parse({ q: value }).q).toBe('1497');
  });
  it.each([
    '0',
    '#4445',
    '1 OR 1=1',
    'https://example.com/squig/1497',
    'https://opensea.io/assets/ethereum/0x0000000000000000000000000000000000000000/1497',
    'javascript:alert(1)',
  ])('rejects %s without broadening search', (value) => {
    expect(tokenSearch(value)).toEqual({ token: null, invalid: true });
  });
  it('distinguishes an empty query from an invalid query', () => {
    expect(tokenSearch('  ')).toEqual({ token: null, invalid: false });
    expect(tokenSearch(undefined)).toEqual({ token: null, invalid: false });
  });
});
describe('catalog navigation', () => {
  it('preserves search and sort when turning a viewer page', () => {
    const link = catalogLink(
      '/collection',
      { q: '#1497', sort: 'rank', view: 'album', page: '2', inspect: 'last' },
      { page: '3', inspect: 'first' },
    );
    const url = new URL(link, 'https://example.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: '#1497',
      sort: 'rank',
      view: 'album',
      page: '3',
      inspect: 'first',
    });
  });
  it('removes one filter and resets pagination without dropping other choices', () => {
    expect(
      catalogLink(
        '/collection',
        { rarity: 'rare', og: '1', sort: 'rank', page: '2', inspect: 'last' },
        { rarity: null, page: null },
      ),
    ).toBe('/collection?og=1&sort=rank');
  });
  it('preserves existing page size and supports an entire collection in album pages', () => {
    expect(PAGE_SIZE).toBe(24);
    expect(ALBUM_PAGE_SIZE).toBe(6);
    expect(filterSchema.parse({ page: '741', view: 'album' })).toMatchObject({
      page: 741,
      view: 'album',
    });
  });
});
