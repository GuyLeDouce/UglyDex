import 'server-only';
import { SQUIG_ART_CID, squigArtwork } from '@/domain/assets';
import { inspectCollectibleArtwork } from './collectible-art';

// Prefer the collection website mirror for delivery; retain canonical IPFS
// metadata and gateway fallbacks. Every source must pass the same size, MIME,
// signature and complete-image decoding checks. Mirror URLs are never supplied
// by callers, and redirects are rejected.
export async function fetchCanonicalArtwork(token: number) {
  if (!Number.isInteger(token) || token < 1 || token > 4444)
    throw new Error('INVALID_ARTWORK');
  const gateways = [
    { url: `https://squigs.io/images/images/${token}.png`, timeout: 4000 },
    {
      url: `https://gateway.pinata.cloud/ipfs/${SQUIG_ART_CID}/${token}`,
      timeout: 4000,
    },
    { url: `https://ipfs.io/ipfs/${SQUIG_ART_CID}/${token}`, timeout: 8000 },
  ];
  for (const [index, gateway] of gateways.entries()) {
    try {
      return await inspectCollectibleArtwork(
        squigArtwork(token),
        (_url, init) =>
          fetch(gateway.url, {
            ...init,
            signal: AbortSignal.timeout(gateway.timeout),
          }),
      );
    } catch (error) {
      if (index === gateways.length - 1) throw error;
    }
  }
  throw new Error('ARTWORK_UNAVAILABLE');
}
