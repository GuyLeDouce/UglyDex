import { db } from '../../src/server/db';
import {
  registerEditionContract,
  editionIndexBatch,
} from '../../src/server/edition-indexer';
import { verifyEditionIndex } from '../../src/server/edition-verify';
import { rpc } from '../../src/integrations/blockchain';
import { zero } from '../../src/domain/edition-history';
import { editionHistory } from '../../src/server/edition-history';
import { stageGate } from '../../src/server/stage-gates';
import {
  registerDeployment,
  assertOperation,
} from '../../src/server/deployment';
import { renderBaseline } from '../../scripts/capacity';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { restoreInventory } from '../../scripts/restore-drill';
import { productionEvidenceReport } from '../../src/server/production-report';
export async function phase8DatabaseTests(
  check: (v: unknown, m: string) => void,
) {
  const rejects = async (fn: () => Promise<unknown>, message: string) => {
    let rejected = false;
    try {
      await fn();
    } catch {
      rejected = true;
    }
    check(rejected, message);
  };
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const inventoryClient = await pool.connect();
  try {
    await inventoryClient.query(
      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    const first = await restoreInventory(inventoryClient),
      second = await restoreInventory(inventoryClient);
    check(
      JSON.stringify(first) === JSON.stringify(second),
      'restore inventory deterministic snapshot',
    );
    check(first.Squig.count === 4444, 'restore inventory proves full catalog');
    check(
      first._prisma_migrations.count === 10,
      'restore inventory includes full migration history',
    );
    await inventoryClient.query('COMMIT');
  } finally {
    inventoryClient.release();
    await pool.end();
  }
  await registerDeployment();
  const evidence = await productionEvidenceReport();
  check(
    evidence.provenance.catalog === 4444 &&
      evidence.duplicateCanonicalEvents === 0,
    'production report uses actual fixture counts and canonical event keys',
  );
  check(
    (await db().deploymentIdentity.findUnique({ where: { id: 'instance' } }))
      ?.environment === 'development',
    'phase8 deployment registration',
  );
  const old = process.env.APP_ENV;
  process.env.APP_ENV = 'production';
  await rejects(
    () => assertOperation('backfill'),
    'production intent required',
  );
  process.env.APP_ENV = old;
  check(
    (await stageGate('provenance')).some((c) => c.status === 'FAIL'),
    'incomplete provenance blocks downstream gates',
  );
  const a = '0x' + '8'.repeat(40),
    b = '0x' + '9'.repeat(40),
    address = '0x' + 'a'.repeat(40),
    address2 = '0x' + 'b'.repeat(40);
  let head = 101n,
    reorg = false;
  let rows: unknown[] = [];
  const hash = (n: bigint) =>
    '0x' + (reorg && n === 102n ? 'f' : n.toString(16)).padStart(64, '0');
  const client = {
    getChainId: async () => 1,
    getCode: async ({ blockNumber }: { blockNumber: bigint }) =>
      blockNumber < 100n ? '0x' : '0x1234',
    readContract: async () => true,
    getBlock: async ({ blockNumber }: { blockNumber?: bigint }) => ({
      number: blockNumber ?? head,
      hash: hash(blockNumber ?? head),
      timestamp: 1700000000n + (blockNumber ?? head),
    }),
    getContractEvents: async () => rows,
  } as unknown as ReturnType<typeof rpc>;
  const log = (
    eventName: string,
    args: unknown,
    blockNumber: bigint,
    logIndex = 0,
  ) => ({
    eventName,
    args,
    blockNumber,
    blockHash: hash(blockNumber),
    transactionHash: '0x' + blockNumber.toString(16).padStart(64, '0'),
    logIndex,
    removed: false,
  });
  const c = await registerEditionContract(
    {
      chainId: 1,
      address,
      standard: 'ERC721',
      startBlock: '100',
      tokenIds: ['1'],
      sourceReference: 'phase8 reviewed fixture',
    },
    'test',
    client,
  );
  check(
    c.status === 'VERIFIED' && !c.enabled,
    'registry verification leaves indexing disabled',
  );
  check(
    (await editionIndexBatch(c.id, client)).disabled,
    'disabled indexer makes no scan',
  );
  await db().editionContract.update({
    where: { id: c.id },
    data: { enabled: true },
  });
  rows = [log('Transfer', { from: zero, to: a, tokenId: 1n }, 101n)];
  await editionIndexBatch(c.id, client);
  check(
    (await db().editionBalance.findFirst({ where: { contractId: c.id } }))
      ?.quantity === '1',
    'ERC721 mint indexed',
  );
  const before = await db().editionTransfer.count();
  await editionIndexBatch(c.id, client);
  check(
    (await db().editionTransfer.count()) === before,
    'Edition cursor replay idempotent',
  );
  head = 102n;
  rows = [log('Transfer', { from: a, to: b, tokenId: 1n }, 102n)];
  await editionIndexBatch(c.id, client);
  check(
    (
      await db().editionBalance.findFirst({
        where: { contractId: c.id, walletAddress: b },
      })
    )?.quantity === '1',
    'ERC721 transfer indexed',
  );
  reorg = true;
  rows = [log('Transfer', { from: a, to: zero, tokenId: 1n }, 102n)];
  await editionIndexBatch(c.id, client);
  check(
    (await db().editionBalance.findMany({ where: { contractId: c.id } })).every(
      (b) => b.quantity === '0',
    ),
    'reorg removes old transfer and indexes burn',
  );
  check(
    (await db().operationalAudit.count({
      where: { subject: c.id, action: 'EDITION_REORG' },
    })) === 1,
    'reorg audit recorded',
  );
  const c2 = await registerEditionContract(
    {
      chainId: 1,
      address: address2,
      standard: 'ERC1155',
      startBlock: '100',
      tokenIds: ['1', '2'],
      sourceReference: 'phase8 reviewed fixture',
    },
    'test',
    client,
  );
  await db().editionContract.update({
    where: { id: c2.id },
    data: { enabled: true },
  });
  rows = [
    log(
      'TransferBatch',
      { from: zero, to: a, ids: [1n, 2n], values: [10n, 3n] },
      101n,
    ),
    log('TransferSingle', { from: a, to: b, id: 1n, value: 4n }, 102n),
  ];
  await editionIndexBatch(c2.id, client);
  check(
    (
      await db().editionBalance.findFirst({
        where: { contractId: c2.id, tokenId: '1', walletAddress: a },
      })
    )?.quantity === '6',
    'ERC1155 partial transfer',
  );
  check(
    (
      await db().editionBalance.findFirst({
        where: { contractId: c2.id, tokenId: '2', walletAddress: a },
      })
    )?.quantity === '3',
    'ERC1155 second batch token',
  );
  check(
    (
      await db().editionBalance.findFirst({
        where: { contractId: c2.id, tokenId: '1', walletAddress: b },
      })
    )?.quantity === '4',
    'ERC1155 multiple owners',
  );
  head = 103n;
  rows = [
    log('TransferSingle', { from: b, to: zero, id: 1n, value: 2n }, 103n),
  ];
  await editionIndexBatch(c2.id, client);
  check(
    (
      await db().editionBalance.findFirst({
        where: { contractId: c2.id, tokenId: '1', walletAddress: b },
      })
    )?.quantity === '2',
    'ERC1155 partial burn',
  );
  check(
    (await verifyEditionIndex()).every((c) => c.status === 'PASS'),
    'Edition ledger and balances verify',
  );
  head = 104n;
  rows = [log('TransferSingle', { from: b, to: a, id: 1n, value: 20n }, 104n)];
  await rejects(
    () => editionIndexBatch(c2.id, client),
    'underflow halts index',
  );
  const halted = await db().editionContract.findUniqueOrThrow({
    where: { id: c2.id },
  });
  check(
    !halted.enabled &&
      halted.cursor === 103n &&
      halted.errorCode === 'EDITION_HISTORY_GAP',
    'failed batch rolls back and kills index',
  );
  check(
    (await editionHistory('not-a-public-edition')) === null,
    'private or missing Edition history absent',
  );
  const report = await renderBaseline();
  await writeFile(
    '.data/phase8-render-capacity.json',
    JSON.stringify(report, null, 2),
  );
  check(
    report.rows.find((r) => r.label === 'cached-burst')?.failures === 0,
    'cached share burst reliable',
  );
  check(
    report.rows.every((r) => r.artworkFetches === 0),
    'capacity has no third-party gateway load',
  );
  // Retain test history but clear the intentional failure before wider verification.
  await db().editionContract.update({
    where: { id: c2.id },
    data: { errorCode: null },
  });
}
