import 'server-only';
import { createHash } from 'node:crypto';
import { zeroAddress } from 'viem';
import { validateContract, squigsAbi } from '@/integrations/blockchain';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { readEnv } from './env';
import { assertDeploymentBinding } from './deployment';
import { recordGate } from './launch';
import { retryRpc } from '@/domain/provenance';
import { decideStartBlock } from '@/domain/start-block';
import { launchContext } from './launch';
import { effectiveGateStatus } from '@/domain/launch';
// Explicit bounded probe. No token-1 deployment inference and no automatic multi-million-block log scan.
export async function verifyLaunchRpc() {
  await assertDeploymentBinding();
  if (!process.env.ETH_RPC_URL) {
    await recordGate('ARCHIVE_RPC', 'PENDING', 'RPC is not configured', {});
    return;
  }
  const started = Date.now();
  try {
    const env = readEnv();
    let retryCount = 0;
    const call = <T>(fn: () => Promise<T>) =>
      retryRpc(fn, env.RPC_RETRIES, undefined, () => retryCount++);
    const client = await call(validateContract);
    const finalized = await call(() =>
      client.getBlock({ blockTag: 'finalized' }),
    );
    let low = 0n,
      high = finalized.number;
    while (low < high) {
      const middle = (low + high) / 2n;
      const code = await call(() =>
        client.getCode({ address: SQUIGS_CONTRACT, blockNumber: middle }),
      );
      if (code && code !== '0x') high = middle;
      else low = middle + 1n;
    }
    const block = await call(() => client.getBlock({ blockNumber: low }));
    const before = low
      ? await call(() =>
          client.getCode({ address: SQUIGS_CONTRACT, blockNumber: low - 1n }),
        )
      : undefined;
    const at = await call(() =>
      client.getCode({ address: SQUIGS_CONTRACT, blockNumber: low }),
    );
    if (!at || at === '0x' || (before && before !== '0x'))
      throw new Error('ARCHIVE_BOUNDARY_INVALID');
    // Probe a single deployment-adjacent range; absence of mint logs remains PARTIAL.
    const end = low + BigInt(env.TRANSFER_BLOCK_BATCH) - 1n;
    const logs = await call(() =>
      client.getContractEvents({
        address: SQUIGS_CONTRACT,
        abi: squigsAbi,
        eventName: 'Transfer',
        fromBlock: low,
        toBlock: end < finalized.number ? end : finalized.number,
        strict: true,
      }),
    );
    const first = logs
      .filter((l) => l.args.from === zeroAddress)
      .sort((a, b) =>
        a.blockNumber < b.blockNumber
          ? -1
          : a.blockNumber > b.blockNumber
            ? 1
            : a.logIndex - b.logIndex,
      )[0];
    if (
      (await call(() => client.getBlock({ blockNumber: low }))).hash !==
      block.hash
    )
      throw new Error('CHAIN_CHANGED_DURING_VERIFY');
    const { db } = await import('./db');
    const context = launchContext();
    const storedMintEvidence = await db().$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          {
            tokenCount: bigint;
            distinctTokens: bigint;
            minTokenId: number | null;
            maxTokenId: number | null;
            earliestMintBlock: bigint | null;
            invalidProvenance: bigint;
          }[]
        >`WITH token_ledger AS (
          SELECT s."id", s."tokenId", p."dirty", p."complete", p."mintAt",
            p."mintBlock", p."mintTransaction", p."verifiedAt", p."ownerMatches",
            p."derivedThrough", count(t."id") AS mint_count,
            min(t."blockNumber") AS canonical_mint_block,
            min(t."transactionHash") AS canonical_mint_transaction
          FROM "Squig" s
          LEFT JOIN "SquigProvenance" p ON p."squigId" = s."id"
          LEFT JOIN "NftTransfer" t ON t."squigId" = s."id"
            AND t."chainId" = 1
            AND lower(t."contractAddress") = lower(${SQUIGS_CONTRACT})
            AND lower(t."fromAddress") = lower(${zeroAddress})
            AND t."finalized" = true
          WHERE s."chainId" = 1 AND lower(s."contractAddress") = lower(${SQUIGS_CONTRACT})
          GROUP BY s."id", s."tokenId", p."dirty", p."complete", p."mintAt",
            p."mintBlock", p."mintTransaction", p."verifiedAt", p."ownerMatches", p."derivedThrough"
        )
        SELECT count(*)::bigint AS "tokenCount",
          count(DISTINCT "tokenId")::bigint AS "distinctTokens",
          min("tokenId") AS "minTokenId", max("tokenId") AS "maxTokenId",
          min(canonical_mint_block) AS "earliestMintBlock",
          count(*) FILTER (WHERE mint_count <> 1 OR dirty IS DISTINCT FROM false
            OR complete IS DISTINCT FROM true OR "mintAt" IS NULL OR "mintBlock" IS NULL
            OR "verifiedAt" IS NULL OR "ownerMatches" IS DISTINCT FROM true
            OR "derivedThrough" IS NULL OR "mintBlock" IS DISTINCT FROM canonical_mint_block
            OR "mintTransaction" IS DISTINCT FROM canonical_mint_transaction)::bigint AS "invalidProvenance"
        FROM token_ledger`;
        const gates = await tx.launchGate.findMany({
          where: {
            key: { in: ['MINT_COVERAGE', 'OWNERSHIP_CONTINUITY', 'OWNER_OF'] },
          },
        });
        const rowsByKey = new Map(gates.map((gate) => [gate.key, gate]));
        const currentProvenanceGates = [
          'MINT_COVERAGE',
          'OWNERSHIP_CONTINUITY',
          'OWNER_OF',
        ].every((key) => {
          const gate = rowsByKey.get(key);
          return (
            !!gate &&
            gate.environment === context.environment &&
            gate.databaseFingerprint === context.databaseFingerprint &&
            gate.commit === context.commit &&
            effectiveGateStatus(gate.status, true, gate.checkedAt) ===
              'VERIFIED'
          );
        });
        const row = rows[0];
        const tokenCount = Number(row?.tokenCount ?? 0n);
        const distinctTokens = Number(row?.distinctTokens ?? 0n);
        const invalidProvenance = Number(row?.invalidProvenance ?? 0n);
        return {
          complete:
            tokenCount === 4444 &&
            distinctTokens === 4444 &&
            row?.minTokenId === 1 &&
            row?.maxTokenId === 4444,
          count: tokenCount,
          distinctTokens,
          minTokenId: row?.minTokenId ?? null,
          maxTokenId: row?.maxTokenId ?? null,
          earliestMintBlock: row?.earliestMintBlock ?? null,
          invalidProvenance,
          currentProvenanceGates,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    const decision = decideStartBlock({
      deploymentBlock: low,
      configuredStartBlock: env.SQUIGS_START_BLOCK,
      archiveBoundaryValid: !!at && at !== '0x' && (!before || before === '0x'),
      boundedMintBlock: first?.blockNumber ?? null,
      ledger: storedMintEvidence,
    });
    const evidence = {
      deploymentBlock: low.toString(),
      deploymentHash: block.hash,
      finalized: finalized.number.toString(),
      firstObservedMint: first
        ? {
            block: first.blockNumber.toString(),
            transaction: first.transactionHash,
            token: first.args.tokenId.toString(),
          }
        : null,
      probeLogs: logs.length,
      range: env.TRANSFER_BLOCK_BATCH,
      storedMintLedger: {
        count: storedMintEvidence.count,
        distinctTokens: storedMintEvidence.distinctTokens,
        minTokenId: storedMintEvidence.minTokenId,
        maxTokenId: storedMintEvidence.maxTokenId,
        earliestMintBlock:
          storedMintEvidence.earliestMintBlock?.toString() ?? null,
        invalidProvenance: storedMintEvidence.invalidProvenance,
        currentProvenanceGates: storedMintEvidence.currentProvenanceGates,
      },
      startBlockEvidence: decision.evidence,
      retryCount,
      durationMs: Date.now() - started,
      providerFingerprint: createHash('sha256')
        .update(new URL(process.env.ETH_RPC_URL).origin)
        .digest('hex'),
    };
    await recordGate(
      'ARCHIVE_RPC',
      'VERIFIED',
      'Chain, ERC721, historical bytecode and bounded historical logs verified',
      evidence,
    );
    await recordGate(
      'START_BLOCK',
      decision.status,
      `Archive deployment boundary ${low}; ${decision.evidence}`,
      evidence,
    );
    await db().operationalAudit.create({
      data: {
        actor: 'launch:rpc',
        action: 'RPC_BOUNDARY',
        subject: SQUIGS_CONTRACT,
        detail: evidence,
      },
    });
  } catch {
    await recordGate(
      'ARCHIVE_RPC',
      'FAILED',
      'RPC/chain/archive probe failed; inspect provider configuration',
      {},
    );
    await recordGate(
      'START_BLOCK',
      'PENDING',
      'Boundary must be revalidated',
      {},
    );
    throw new Error('RPC_VALIDATION_FAILED');
  }
}
