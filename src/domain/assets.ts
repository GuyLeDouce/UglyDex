// Verified Ethereum tokenURI metadata, QmPmicAfPKQzmortxrfZEpDSN6s6aNSBpf1VbmKbzNs8FU/1.
// Preserve the artwork; this is a delivery URL, not a mutation of NFT metadata.
export const SQUIG_ART_CID = 'QmTVMmCGAYyRZ7QhdR6khzv4yvJwoVvtuc2Uq5eRuUVoFQ';
export function resolveAsset(
  value: string | null | undefined,
  gateway = 'https://gateway.pinata.cloud/ipfs/',
) {
  if (!value) return null;
  if (value.startsWith('ipfs://')) {
    const path = value.slice(7).replace(/^ipfs\//, '');
    if (
      !/^[a-zA-Z0-9]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path) ||
      path.split('/').includes('..')
    )
      return null;
    return gateway + path;
  }
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function squigArtwork(tokenId: number) {
  return `ipfs://${SQUIG_ART_CID}/${tokenId}`;
}
