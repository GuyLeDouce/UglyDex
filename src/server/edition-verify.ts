import 'server-only';
import { db } from './db';
import {
  contractManifest,
  applyEditionEvents,
  editionHoldingPeriods,
} from '@/domain/edition-history';
import type { Check } from '@/domain/operations';
export async function verifyEditionIndex(): Promise<Check[]> {
  const checks: Check[] = [];
  const contracts = await db().editionContract.findMany();
  for (const c of contracts) {
    const valid = contractManifest.safeParse({
      chainId: c.chainId,
      address: c.address,
      standard: c.standard,
      startBlock: c.startBlock.toString(),
      tokenIds: c.tokenIds,
      sourceReference: c.sourceReference,
    }).success;
    let failures = valid ? 0 : 1;
    let holdingPeriods = 0;
    for (const tokenId of c.tokenIds) {
      const events = await db().editionTransfer.findMany({
        where: { contractId: c.id, tokenId },
        orderBy: [
          { blockNumber: 'asc' },
          { logIndex: 'asc' },
          { batchIndex: 'asc' },
        ],
        take: 50001,
      });
      if (events.length > 50000) {
        checks.push({
          name: 'editions.replay_limit',
          status: 'WARN',
          detail: `${c.id} token ${tokenId} needs a larger reviewed streaming verification`,
        });
        continue;
      }
      try {
        holdingPeriods += editionHoldingPeriods(c.standard, events).length;
        const expected = applyEditionEvents(c.standard, [], events),
          actual = await db().editionBalance.findMany({
            where: { contractId: c.id, tokenId },
          });
        if (
          expected.length !== actual.length ||
          expected.some(
            (b) =>
              !actual.some(
                (a) =>
                  a.walletAddress === b.walletAddress &&
                  a.quantity === b.quantity &&
                  a.maximumQuantity === b.maximumQuantity &&
                  a.firstAcquiredAt.getTime() === b.firstAcquiredAt.getTime() &&
                  a.lastAcquiredAt.getTime() === b.lastAcquiredAt.getTime(),
              ),
          )
        )
          failures++;
        const e = await db().squigEdition.findFirst({
          where: {
            chainId: c.chainId,
            contractAddress: c.address,
            tokenId,
            status: 'VERIFIED',
          },
          select: { supply: true, standard: true },
        });
        if (
          e &&
          (e.standard !== c.standard ||
            (e.supply !== null &&
              expected.reduce((n, b) => n + BigInt(b.quantity), 0n) >
                BigInt(e.supply)))
        )
          failures++;
      } catch {
        failures++;
      }
    }
    checks.push({
      name: `editions.index.${c.id}`,
      status:
        failures || c.errorCode
          ? 'FAIL'
          : c.cursor === null || c.cursor !== c.finalizedBlock
            ? 'WARN'
            : 'PASS',
      detail: `${failures} inconsistencies; ${holdingPeriods} derived holding periods; ${c.tokenIds.length} reviewed IDs; cursor ${c.cursor ?? 'not started'}; ${c.errorCode ?? 'no error'}`,
    });
  }
  if (!contracts.length)
    checks.push({
      name: 'editions.registry',
      status: 'WARN',
      detail:
        'No reviewed official contracts; historical ownership unavailable',
    });
  return checks;
}
