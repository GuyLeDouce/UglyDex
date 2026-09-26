import { z } from 'zod';
import { SQUIGS_CONTRACT } from './validation';
export const zero = '0x' + '0'.repeat(40);
const uint = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,77})$/)
  .refine((s) => BigInt(s) < 2n ** 256n);
export const contractManifest = z
  .object({
    chainId: z.literal(1),
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .transform((s) => s.toLowerCase())
      .refine((s) => s !== zero && s !== SQUIGS_CONTRACT),
    standard: z.enum(['ERC721', 'ERC1155']),
    startBlock: z.string().regex(/^[1-9][0-9]{0,15}$/),
    tokenIds: z
      .array(uint)
      .min(1)
      .max(1000)
      .refine((a) => new Set(a).size === a.length),
    sourceReference: z.string().trim().min(5).max(250),
  })
  .strict();
export type EditionEvent = {
  id: string;
  tokenId: string;
  fromAddress: string;
  toAddress: string;
  quantity: string;
  eventAt: Date;
};
export type Balance = {
  walletAddress: string;
  quantity: string;
  maximumQuantity: string;
  firstAcquiredAt: Date;
  lastAcquiredAt: Date;
};
export function applyEditionEvents(
  standard: string,
  previous: Balance[],
  events: EditionEvent[],
) {
  const balances = new Map(previous.map((b) => [b.walletAddress, { ...b }]));
  for (const e of events) {
    const amount = BigInt(uint.parse(e.quantity));
    if (standard === 'ERC721' && amount !== 1n)
      throw new Error('ERC721_QUANTITY_INVALID');
    if (e.fromAddress === zero && e.toAddress === zero) {
      if (amount === 0n) continue;
      throw new Error('ZERO_TO_ZERO_TRANSFER');
    }
    if (amount === 0n) continue;
    if (
      standard === 'ERC721' &&
      e.fromAddress === zero &&
      [...balances.values()].some((b) => BigInt(b.quantity) > 0n)
    )
      throw new Error('DUPLICATE_EDITION_MINT');
    if (e.fromAddress !== zero) {
      const from = balances.get(e.fromAddress);
      if (!from || BigInt(from.quantity) < amount)
        throw new Error('EDITION_HISTORY_GAP');
      from.quantity = (BigInt(from.quantity) - amount).toString();
    }
    if (e.toAddress !== zero) {
      const to = balances.get(e.toAddress) ?? {
        walletAddress: e.toAddress,
        quantity: '0',
        maximumQuantity: '0',
        firstAcquiredAt: e.eventAt,
        lastAcquiredAt: e.eventAt,
      };
      const quantity = BigInt(to.quantity) + amount;
      if (quantity >= 2n ** 256n || (standard === 'ERC721' && quantity > 1n))
        throw new Error('EDITION_QUANTITY_OVERFLOW');
      to.quantity = quantity.toString();
      if (quantity > BigInt(to.maximumQuantity))
        to.maximumQuantity = to.quantity;
      to.lastAcquiredAt = e.eventAt;
      balances.set(to.walletAddress, to);
    }
  }
  return [...balances.values()];
}

// Derived from the immutable event ledger, so reorg replay cannot leave stale periods.
export function editionHoldingPeriods(
  standard: string,
  events: EditionEvent[],
) {
  let balances: Balance[] = [];
  const periods: {
    walletAddress: string;
    acquiredAt: Date;
    lostAt: Date | null;
    acquisitionEvent: string;
    lossEvent: string | null;
    maximumQuantity: string;
  }[] = [];
  for (const event of events) {
    const before = new Map(
      balances.map((b) => [b.walletAddress, BigInt(b.quantity)]),
    );
    balances = applyEditionEvents(standard, balances, [event]);
    for (const walletAddress of new Set([event.fromAddress, event.toAddress])) {
      if (walletAddress === zero) continue;
      const quantity = BigInt(
          balances.find((b) => b.walletAddress === walletAddress)?.quantity ??
            '0',
        ),
        prior = before.get(walletAddress) ?? 0n;
      if (prior === 0n && quantity > 0n)
        periods.push({
          walletAddress,
          acquiredAt: event.eventAt,
          lostAt: null,
          acquisitionEvent: event.id,
          lossEvent: null,
          maximumQuantity: quantity.toString(),
        });
      const open = periods.findLast(
        (p) => p.walletAddress === walletAddress && p.lostAt === null,
      );
      if (open && quantity > BigInt(open.maximumQuantity))
        open.maximumQuantity = quantity.toString();
      if (open && prior > 0n && quantity === 0n) {
        open.lostAt = event.eventAt;
        open.lossEvent = event.id;
      }
    }
  }
  return periods;
}
