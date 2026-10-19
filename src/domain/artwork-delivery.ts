import { SQUIG_ART_CID, resolveAsset } from './assets';

export const artworkWidths = [96, 384, 768, 1536] as const;
export type ArtworkSize = 'original' | (typeof artworkWidths)[number];
export function canonicalArtworkToken(value: string | null) {
  const url = resolveAsset(value);
  const prefix = `https://gateway.pinata.cloud/ipfs/${SQUIG_ART_CID}/`;
  if (!url?.startsWith(prefix)) return null;
  const token = url.slice(prefix.length);
  return /^[1-9][0-9]{0,3}$/.test(token) && Number(token) <= 4444
    ? Number(token)
    : null;
}
export function artworkUrl(token: number, width: number) {
  const size = artworkWidths.find((size) => size >= width) ?? 1536;
  return `/api/artwork/squigs/${SQUIG_ART_CID}/${token}/${size}`;
}
