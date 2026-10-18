import { SQUIGS_CONTRACT, squigToken } from './validation';

export const OPENSEA_COLLECTION_URL =
  'https://opensea.io/collection/squigs-reloaded';
export function squigOpenSeaUrl(tokenId: number) {
  return `https://opensea.io/assets/ethereum/${SQUIGS_CONTRACT}/${squigToken(tokenId)}`;
}
export type SquigListing = {
  tokenId: number;
  amount: string;
  currency: string;
  expiresAt: string;
};
export type ListingSort = 'price-asc' | 'price-desc';
export function isListingSort(sort: string): sort is ListingSort {
  return sort === 'price-asc' || sort === 'price-desc';
}
// The collection reader preserves OpenSea's ascending price order across currencies.
// Reverse the full result set before pagination; never compare raw currency amounts.
export function sortedListings(
  listings: readonly SquigListing[],
  sort: ListingSort,
) {
  return sort === 'price-desc' ? [...listings].reverse() : [...listings];
}
export type OpenSeaListings = {
  status: 'available' | 'unavailable';
  checkedAt: string | null;
  complete: boolean;
  listings: SquigListing[];
};
export const unavailableListings: OpenSeaListings = {
  status: 'unavailable',
  checkedAt: null,
  complete: false,
  listings: [],
};

// Keep base-unit precision; small asking prices must never round down to zero.
export function listingAmount(value: string, decimals: number) {
  const digits = BigInt(value)
    .toString()
    .padStart(decimals + 1, '0');
  if (!decimals) return digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}
