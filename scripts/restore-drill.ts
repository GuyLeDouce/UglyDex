import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import {
  restoreTarget,
  databaseFingerprint,
  operationalIntent,
} from '../src/domain/deployment';
import { safeOperationalCode } from '../src/domain/operations';
const tables = [
  'Collector',
  'AuthSession',
  'CollectorAchievement',
  'SquigAchievement',
  'CollectionSnapshot',
  'EditionContract',
  'EditionCheckpoint',
  'Squig',
  'NftTransfer',
  'WalletOwnershipPeriod',
  'CollectorOwnershipPeriod',
  'CollectorActivity',
  'XpLedgerEntry',
  'SquigDiscovery',
  'CollectorTraitDiscovery',
  'CollectorGallery',
  'CollectorGalleryItem',
  'SquigCustom',
  'SquigEdition',
  'EditionTransfer',
  'EditionBalance',
  'WorkerControl',
  'LaunchGate',
  'ReplayProof',
  '_prisma_migrations',
] as const;
export async function restoreInventory(client: PoolClient) {
  const result: Record<string, { count: number; sha256: string }> = {};
  for (const table of tables) {
    // Constant identifiers only. Stream sorted row digests rather than holding the database in memory.
    await client.query(
      `DECLARE inventory NO SCROLL CURSOR FOR SELECT md5(row_to_json(t)::text) AS digest FROM "${table}" t ORDER BY md5(row_to_json(t)::text)`,
    );
    const hash = createHash('sha256');
    let count = 0;
    for (;;) {
      const rows = (
        await client.query<{ digest: string }>('FETCH 1000 FROM inventory')
      ).rows;
      if (!rows.length) break;
      for (const row of rows) {
        hash.update(row.digest + '\n');
        count++;
      }
    }
    await client.query('CLOSE inventory');
    result[table] = { count, sha256: hash.digest('hex') };
  }
  return result;
}
const fileHash = async (file: string) => {
  const h = createHash('sha256');
  for await (const c of createReadStream(file)) h.update(c);
  return h.digest('hex');
};
async function pgTool(binary: string, args: string[], url: URL) {
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get('sslmode') ?? 'prefer',
  };
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, {
      env,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', () => reject(new Error('POSTGRES_TOOL_UNAVAILABLE')));
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('POSTGRES_TOOL_FAILED')),
    );
  });
}
async function main() {
  const command = process.argv[2],
    file = process.argv[3];
  if (!file || !['backup', 'restore'].includes(command))
    throw new Error('BACKUP_FILE_REQUIRED');
  if (command === 'backup') {
    operationalIntent('backup');
    try {
      await stat(file);
      throw new Error('BACKUP_EXISTS');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      }),
      client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const snapshot = (
        await client.query<{ snapshot: string }>(
          'SELECT pg_export_snapshot() AS snapshot',
        )
      ).rows[0].snapshot;
      const inventory = await restoreInventory(client);
      await pgTool(
        process.env.PG_DUMP_BIN ?? 'pg_dump',
        [
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          `--snapshot=${snapshot}`,
          `--file=${file}`,
        ],
        new URL(process.env.DATABASE_URL!),
      );
      await client.query('COMMIT');
      await writeFile(
        file + '.inventory.json',
        JSON.stringify(
          {
            version: 1,
            source: databaseFingerprint(process.env.DATABASE_URL!),
            createdAt: new Date().toISOString(),
            archiveSha256: await fileHash(file),
            inventory,
          },
          null,
          2,
        ),
        { flag: 'wx', mode: 0o600 },
      );
      console.log(
        'PASS consistent backup and inventory created; protect both as private artifacts',
      );
    } finally {
      client.release();
      await pool.end();
    }
  } else {
    const target = restoreTarget(process.env);
    const manifest = JSON.parse(
      await readFile(file + '.inventory.json', 'utf8'),
    );
    if (
      manifest.version !== 1 ||
      manifest.source === databaseFingerprint(target.href) ||
      manifest.archiveSha256 !== (await fileHash(file))
    )
      throw new Error('BACKUP_INTEGRITY_FAILED');
    const pool = new Pool({ connectionString: target.href, max: 1 }),
      client = await pool.connect();
    try {
      const existing = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') LIMIT 1",
      );
      if (existing.rowCount) throw new Error('RESTORE_TARGET_NOT_EMPTY');
      await pgTool(
        process.env.PG_RESTORE_BIN ?? 'pg_restore',
        [
          '--single-transaction',
          '--exit-on-error',
          '--no-owner',
          '--no-privileges',
          '--dbname=' + decodeURIComponent(target.pathname.slice(1)),
          file,
        ],
        target,
      );
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const inventory = await restoreInventory(client);
      await client.query('COMMIT');
      if (JSON.stringify(inventory) !== JSON.stringify(manifest.inventory))
        throw new Error('RESTORED_INVENTORY_MISMATCH');
      // Contain restored automation before any app starts; original inventory was checked first.
      await client.query('UPDATE "WorkerControl" SET mode=\'DISABLED\'');
      await client.query('UPDATE "EditionContract" SET enabled=false');
      await client.query('DELETE FROM "DeploymentIdentity"');
      process.env.DATABASE_URL = target.href;
      process.env.APP_ENV = 'development';
      const { productionVerify } =
        await import('../src/server/production-verify');
      const { db } = await import('../src/server/db');
      const checks = await productionVerify();
      await db().$disconnect();
      for (const c of checks) console.log(`${c.status} ${c.name}: ${c.detail}`);
      if (checks.some((c) => c.status === 'FAIL'))
        throw new Error('RESTORED_VERIFICATION_FAILED');
      console.log(
        'PASS archive hash, all table inventories and restored integrity; workers disabled; database retained for manual privacy smoke',
      );
    } finally {
      client.release();
      await pool.end();
    }
  }
}
if (process.argv[1]?.endsWith('restore-drill.ts'))
  main().catch((e) => {
    console.error(safeOperationalCode(e));
    process.exitCode = 1;
  });
