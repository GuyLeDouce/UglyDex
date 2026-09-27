import 'server-only';
import { createHash } from 'node:crypto';
import { zeroAddress } from 'viem';
import { validateContract, squigsAbi } from '@/integrations/blockchain';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { readEnv } from './env';
import { assertDeploymentBinding } from './deployment';
import { recordGate } from './launch';
import { retryRpc } from '@/domain/provenance';
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
    const configured = env.SQUIGS_START_BLOCK;
    await recordGate(
      'START_BLOCK',
      configured === low && !!first ? 'VERIFIED' : 'PARTIAL',
      `Archive deployment boundary ${low}; ${first ? 'mint observed in probe range' : 'mint boundary needs further bounded evidence'}; configured boundary ${configured === low ? 'matches' : 'does not match'}`,
      evidence,
    );
    const { db } = await import('./db');
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
