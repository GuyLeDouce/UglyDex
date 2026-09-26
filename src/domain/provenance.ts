import { zeroAddress } from 'viem';
import { z } from 'zod';

export type TransferFact = {
  id: string;
  fromAddress: string;
  toAddress: string;
  blockNumber: bigint;
  logIndex: number;
  transactionIndex: number;
  eventAt: Date;
};
export type WalletPeriod = {
  id: string;
  walletAddress: string;
  acquiredAt: Date;
  lostAt: Date | null;
  acquisitionEvent: string;
  lossEvent: string | null;
};
export type Attribution = {
  id: string;
  collectorId: string;
  walletAddress: string;
  status: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};
export function orderedTransfers<T extends TransferFact>(events: T[]) {
  return [...events].sort((a, b) =>
    a.blockNumber < b.blockNumber
      ? -1
      : a.blockNumber > b.blockNumber
        ? 1
        : a.logIndex - b.logIndex,
  );
}
export function deriveWalletPeriods(events: TransferFact[]) {
  const sorted = orderedTransfers(events),
    issues: string[] = [],
    periods: WalletPeriod[] = [];
  const seen = new Set<string>();
  let owner = zeroAddress as string,
    open: WalletPeriod | undefined,
    minted = false;
  for (const e of sorted) {
    if (seen.has(e.id)) {
      issues.push(`DUPLICATE:${e.id}`);
      continue;
    }
    seen.add(e.id);
    if (e.fromAddress === zeroAddress) {
      if (minted) issues.push(`MULTIPLE_MINTS:${e.id}`);
      minted = true;
    }
    if (e.fromAddress !== owner) issues.push(`CHAIN_GAP:${e.id}`);
    if (open && e.eventAt < open.acquiredAt)
      issues.push(`TIMESTAMP_ORDER:${e.id}`);
    // Self transfers are chain facts but do not interrupt wallet possession.
    if (e.fromAddress === e.toAddress && e.toAddress !== zeroAddress) continue;
    if (open) {
      open.lostAt = e.eventAt;
      open.lossEvent = e.id;
    }
    open = undefined;
    if (e.toAddress !== zeroAddress) {
      open = {
        id: e.id,
        walletAddress: e.toAddress,
        acquiredAt: e.eventAt,
        lostAt: null,
        acquisitionEvent: e.id,
        lossEvent: null,
      };
      periods.push(open);
    }
    owner = e.toAddress;
  }
  if (!minted) issues.push('MISSING_MINT');
  return {
    periods,
    issues,
    currentWallet: owner === zeroAddress ? null : owner,
    mint: sorted.find((e) => e.fromAddress === zeroAddress) ?? null,
  };
}
export function confident(a: Attribution) {
  return ['VERIFIED', 'REVIEWED', 'REVOKED'].includes(a.status);
}
export function holdingEventTypes(
  first: boolean,
  start: Date,
  end: Date | null,
  chainStart: Date | undefined,
  chainEnd: Date | undefined,
) {
  return {
    acquired: first
      ? 'SQUIG_DISCOVERED'
      : start.getTime() === chainStart?.getTime()
        ? 'SQUIG_ACQUIRED'
        : 'OWNERSHIP_CONFIRMED',
    lost:
      end && end.getTime() === chainEnd?.getTime()
        ? 'SQUIG_LOST'
        : 'ATTRIBUTION_ENDED',
  };
}
// Half-open evidence intervals. Cut at every boundary so overlaps never silently win.
export function deriveCollectorPeriods(
  periods: WalletPeriod[],
  evidence: Attribution[],
) {
  const pieces: {
    collectorId: string;
    acquiredAt: Date;
    lostAt: Date | null;
    evidenceIds: string[];
    walletAddresses: string[];
    acquisitionEvent: string;
    lossEvent: string | null;
  }[] = [];
  const conflicts = new Set<string>();
  for (const p of periods) {
    const end = p.lostAt?.getTime() ?? Infinity;
    const candidates = evidence.filter(
      (a) =>
        a.walletAddress === p.walletAddress &&
        a.status !== 'REJECTED' &&
        a.status !== 'INVALIDATED' &&
        a.effectiveFrom.getTime() <= end &&
        (a.effectiveTo?.getTime() ?? Infinity) > p.acquiredAt.getTime(),
    );
    const cuts = [
      ...new Set([
        p.acquiredAt.getTime(),
        end,
        ...candidates.flatMap((a) => [
          Math.max(p.acquiredAt.getTime(), a.effectiveFrom.getTime()),
          Math.min(end, a.effectiveTo?.getTime() ?? Infinity),
        ]),
      ]),
    ].sort((a, b) => a - b);
    if (cuts.length === 1) cuts.push(cuts[0]);
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i],
        finish = cuts[i + 1];
      const active = candidates.filter(
        (a) =>
          a.effectiveFrom.getTime() <= start &&
          (a.effectiveTo?.getTime() ?? Infinity) > start,
      );
      const owners = new Set(active.map((a) => a.collectorId));
      if (owners.size > 1) {
        conflicts.add(p.walletAddress);
        continue;
      }
      const trusted = active.filter(confident);
      if (!trusted.length) continue;
      pieces.push({
        collectorId: trusted[0].collectorId,
        acquiredAt: new Date(start),
        lostAt: finish === Infinity ? null : new Date(finish),
        evidenceIds: trusted.map((a) => a.id),
        walletAddresses: [p.walletAddress],
        acquisitionEvent: p.acquisitionEvent,
        lossEvent: p.lossEvent,
      });
    }
  }
  pieces.sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime());
  const merged: typeof pieces = [];
  for (const p of pieces) {
    const prior = merged.at(-1);
    if (
      prior?.collectorId === p.collectorId &&
      prior.lostAt?.getTime() === p.acquiredAt.getTime() &&
      (prior.lossEvent === p.acquisitionEvent ||
        prior.acquisitionEvent === p.acquisitionEvent)
    ) {
      prior.lostAt = p.lostAt;
      prior.lossEvent = p.lossEvent;
      prior.evidenceIds = [
        ...new Set([...prior.evidenceIds, ...p.evidenceIds]),
      ];
      prior.walletAddresses = [
        ...new Set([...prior.walletAddresses, ...p.walletAddresses]),
      ];
    } else merged.push({ ...p });
  }
  return { periods: merged, conflicts: [...conflicts] };
}
export function publicAttribution(
  c: {
    isPublic: boolean;
    showWallets: boolean;
    slug: string;
    displayName: string | null;
  } | null,
  resolved: boolean,
) {
  return resolved && c?.isPublic && c.showWallets
    ? { slug: c.slug, displayName: c.displayName }
    : null;
}
export const passportFilters = z.object({
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  order: z.enum(['newest', 'oldest']).catch('newest'),
  event: z.enum(['all', 'mint', 'transfer', 'burn']).catch('all'),
});
export function explorerTransaction(
  chainId: number,
  hash: string,
  base?: string,
) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) return null;
  const root =
    base ?? ({ 1: 'https://etherscan.io' } as Record<number, string>)[chainId];
  if (!root) return null;
  const url = new URL(root);
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return `${url.origin}${url.pathname.replace(/\/$/, '')}/tx/${hash}`;
}
export async function retryRpc<T>(
  run: () => Promise<T>,
  retries = 4,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
  onRetry: () => void = () => {},
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch {
      if (attempt >= retries) throw new Error('RPC_RETRIES_EXHAUSTED');
      onRetry();
      await sleep(Math.min(15000, 500 * 2 ** attempt));
    }
  }
}
export async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}
