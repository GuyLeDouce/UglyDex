import 'server-only';
import { SQUIG_ART_CID, squigArtwork } from '@/domain/assets';
import { inspectCollectibleArtwork } from './collectible-art';

// Both gateways address the same immutable CID and token. Each response must
// pass the existing size, MIME, signature and complete-image decoding checks.
export async function fetchCanonicalArtwork(token: number) {
  if (!Number.isInteger(token) || token < 1 || token > 4444)
    throw new Error('INVALID_ARTWORK');
  const gateways = [
    { origin: 'https://gateway.pinata.cloud', timeout: 4000 },
    { origin: 'https://ipfs.io', timeout: 8000 },
  ];
  for (const [index, gateway] of gateways.entries()) {
    try {
      return await inspectCollectibleArtwork(
        squigArtwork(token),
        (_url, init) =>
          fetch(`${gateway.origin}/ipfs/${SQUIG_ART_CID}/${token}`, {
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
