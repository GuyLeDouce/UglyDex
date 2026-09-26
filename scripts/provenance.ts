import 'dotenv/config';
import { db } from '../src/server/db';
import { readEnv } from '../src/server/env';
import { chainStatus } from '../src/server/provenance';
import { chainLock } from '../src/sync/transfers';
import { derivePending, seedAttributions } from '../src/sync/provenance';
import { verifyProvenance } from '../src/sync/verify-provenance';
import { squigToken } from '../src/domain/validation';
import { validateContract } from '../src/integrations/blockchain';
import { retryRpc } from '../src/domain/provenance';
try {
  readEnv();
  const command = process.argv[2];
  if (command === 'status')
    console.log(JSON.stringify(await chainStatus(), null, 2));
  else if (command === 'verify') {
    const report = await verifyProvenance();
    console.log(JSON.stringify(report, null, 2));
    if (!report || report.anomalies.length || report.coverage !== 'CAUGHT_UP')
      process.exitCode = 1;
  } else if (command === 'rebuild') {
    const tokenAt = process.argv.indexOf('--token'),
      blockAt = process.argv.indexOf('--from-block');
    if (tokenAt < 0 === blockAt < 0)
      throw new Error('SELECT_TOKEN_OR_FROM_BLOCK');
    const token =
      tokenAt >= 0 ? squigToken(process.argv[tokenAt + 1]) : undefined;
    const from = blockAt >= 0 ? process.argv[blockAt + 1] : undefined;
    if (from !== undefined && !/^\d+$/.test(from))
      throw new Error('INVALID_BLOCK');
    const result = await chainLock(async () => {
      await seedAttributions();
      const rows = token
        ? await db().squig.findMany({
            where: {
              tokenId: token,
              chainId: 1,
              contractAddress: readEnv().SQUIGS_CONTRACT_ADDRESS,
            },
            select: { id: true },
          })
        : await db().squig.findMany({
            where: {
              transfers: { some: { blockNumber: { gte: BigInt(from!) } } },
            },
            select: { id: true },
          });
      for (const s of rows)
        await db().squigProvenance.upsert({
          where: { squigId: s.id },
          create: { squigId: s.id },
          update: { dirty: true },
        });
      while (await derivePending()) {}
      return { rebuilt: rows.length, rawLedgerChanged: false };
    });
    if (!result) throw new Error('WORKER_BUSY');
    console.log(JSON.stringify(result));
  } else if (command === 'discover-start') {
    const c = await validateContract(),
      env = readEnv(),
      call = <T>(fn: () => Promise<T>) => retryRpc(fn, env.RPC_RETRIES);
    let lo = 0n,
      hi = (await call(() => c.getBlock({ blockTag: 'finalized' }))).number;
    while (lo < hi) {
      const mid = (lo + hi) / 2n,
        code = await call(() =>
          c.getCode({ address: env.SQUIGS_CONTRACT_ADDRESS, blockNumber: mid }),
        );
      if (code && code !== '0x') hi = mid;
      else lo = mid + 1n;
    }
    const block = await call(() => c.getBlock({ blockNumber: lo }));
    console.log(
      JSON.stringify({
        deploymentBlock: lo.toString(),
        blockHash: block.hash,
        timestamp: block.timestamp.toString(),
        instruction:
          'Set SQUIGS_START_BLOCK to this deployment block. Requires an archive-capable RPC.',
      }),
    );
  } else throw new Error('UNKNOWN_COMMAND');
} catch (e) {
  console.error(
    JSON.stringify({
      error:
        e instanceof Error && /^[A-Z_]+$/.test(e.message)
          ? e.message
          : 'PROVENANCE_COMMAND_FAILED',
    }),
  );
  process.exitCode = 1;
} finally {
  await db().$disconnect();
}
