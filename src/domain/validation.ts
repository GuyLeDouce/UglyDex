import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
export const SQUIGS_CONTRACT =
  '0x8c9a02c0585200c4c65608df6b8def543d33792a' as const;
export const discordId = z.string().regex(/^\d{17,20}$/);
export function normalizeWallet(value: string): `0x${string}` {
  if (!isAddress(value, { strict: false })) throw new Error('INVALID_WALLET');
  return value.toLowerCase() as `0x${string}`;
}
export function walletDisplay(value: string) {
  return getAddress(normalizeWallet(value));
}
export function squigToken(value: unknown): number {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^[1-9]\d{0,3}$/.test(String(value))
  )
    throw new Error('INVALID_SQUIG_TOKEN');
  const n = Number(value);
  if (n > 4444) throw new Error('INVALID_SQUIG_TOKEN');
  return n;
}
