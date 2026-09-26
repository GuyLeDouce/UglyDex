import 'server-only';
import { zeroAddress } from 'viem';
import { db } from '@/server/db';
import { readEnv } from '@/server/env';
import {
  validateContract,
  getOwnershipBatch,
  type rpc,
} from '@/integrations/blockchain';
import { chainKey } from './provenance';
import { chainLock } from './transfers';
import { deriveWalletPeriods, retryRpc } from '@/domain/provenance';
import { SQUIGS_CONTRACT } from '@/domain/validation';
export async function verifyProvenance(
  client?: ReturnType<typeof rpc>,
  ownerReader = getOwnershipBatch,
) {
  return chainLock(async () => {
    const cursor = await db().chainCursor.findUnique({
      where: { key: chainKey },
    });
    if (!cursor?.startBlock || cursor.blockNumber < cursor.startBlock)
      throw new Error('LEDGER_NOT_STARTED');
    const reader = client ?? (await validateContract()),
      call = <T>(fn: () => Promise<T>) => retryRpc(fn, readEnv().RPC_RETRIES);
    const pinned = await call(() =>
      reader.getBlock({ blockNumber: cursor.blockNumber }),
    );
    if (pinned.hash !== cursor.blockHash)
      throw new Error('REORG_SYNC_REQUIRED');
    const report = {
      checked: 0,
      mints: 0,
      ownersMatched: 0,
      unavailableOwnerReads: 0,
      missingMetadata: 0,
      coverage:
        cursor.blockNumber === cursor.finalizedBlock
          ? 'CAUGHT_UP'
          : 'INCOMPLETE',
      block: cursor.blockNumber.toString(),
      anomalies: [] as { tokenId: number; reasons: string[] }[],
    };
    const verified: { squigId: string; matches: boolean | null }[] = [];
    for (let first = 1; first <= 4444; first += 100) {
      const tokens = Array.from(
        { length: Math.min(100, 4445 - first) },
        (_, i) => first + i,
      );
      const [squigs, owners] = await Promise.all([
        db().squig.findMany({
          where: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: { in: tokens },
          },
          include: { transfers: true, provenance: true, walletPeriods: true },
        }),
        call(() => ownerReader(reader, tokens, cursor.blockNumber)),
      ]);
      for (const [i, tokenId] of tokens.entries()) {
        report.checked++;
        const s = squigs.find((s) => s.tokenId === tokenId),
          reasons: string[] = [];
        if (!s || !s.metadataSourceHash) {
          reasons.push('MISSING_IMPORTED_METADATA');
          report.missingMetadata++;
        }
        const raw = deriveWalletPeriods(s?.transfers ?? []);
        reasons.push(...raw.issues);
        if (raw.mint) report.mints++;
        if (s?.provenance?.dirty) reasons.push('DERIVATION_PENDING');
        if (s?.provenance?.currentWallet !== raw.currentWallet)
          reasons.push('DERIVED_OWNER_MISMATCH');
        if (
          s?.walletPeriods.length !== raw.periods.length ||
          raw.periods.some(
            (p) =>
              !s?.walletPeriods.some(
                (q) =>
                  q.id === p.id &&
                  q.walletAddress === p.walletAddress &&
                  q.acquiredAt.getTime() === p.acquiredAt.getTime() &&
                  q.lostAt?.getTime() === p.lostAt?.getTime(),
              ),
          )
        )
          reasons.push('PERIOD_MISMATCH');
        let matches: boolean | null = null;
        if (owners[i].status === 'success') {
          matches =
            owners[i].result.toLowerCase() ===
            (raw.currentWallet ?? zeroAddress);
          if (matches) report.ownersMatched++;
          else reasons.push('OWNER_OF_MISMATCH');
        } else {
          // A revert is not proof of burn: retain raw burn evidence and report unavailable comparison.
          report.unavailableOwnerReads++;
          reasons.push('OWNER_OF_UNAVAILABLE');
        }
        if (s?.provenance) verified.push({ squigId: s.id, matches });
        if (reasons.length) report.anomalies.push({ tokenId, reasons });
      }
    }
    if (
      (await call(() => reader.getBlock({ blockNumber: cursor.blockNumber })))
        .hash !== cursor.blockHash
    )
      throw new Error('CHAIN_CHANGED_DURING_VERIFY');
    // Publish comparisons only after the final hash check; interrupted verification
    // must not leave unvalidated success badges in the public read model.
    for (const row of verified)
      await db().squigProvenance.update({
        where: { squigId: row.squigId },
        data: { verifiedAt: new Date(), ownerMatches: row.matches },
      });
    return report;
  });
}
