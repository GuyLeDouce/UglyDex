import { db } from '../../src/server/db';
import {
  launchReport,
  recordGate,
  attestGate,
  launchText,
} from '../../src/server/launch';
import {
  semanticFingerprints,
  fingerprintDiff,
} from '../../src/server/replay-proof';
import { Pool } from 'pg';
import { evidenceAudit } from '../../src/server/evidence-audit';
export async function phase9DatabaseTests(
  check: (v: unknown, m: string) => void,
) {
  const before = process.env.APP_COMMIT;
  process.env.APP_COMMIT = 'a'.repeat(40);
  try {
    check(
      (await launchReport()).overall === 'NOT_READY',
      'empty registry never ready',
    );
    await recordGate(
      'BACKUP',
      'VERIFIED',
      'Reviewed archive hash',
      { sha256: 'b'.repeat(64) },
      'private operator note',
    );
    let report = await launchReport();
    check(
      report.gates.find((g) => g.key === 'BACKUP')?.status === 'VERIFIED',
      'persistent evidence readable in same context',
    );
    check(
      !JSON.stringify(report).includes('private operator note'),
      'export excludes private notes',
    );
    check(
      !JSON.stringify(report).includes(process.env.DATABASE_URL!),
      'export excludes database URL',
    );
    check(
      launchText(report).includes('BACKUP: VERIFIED'),
      'text shares gate state',
    );
    process.env.APP_COMMIT = 'c'.repeat(40);
    check(
      (await launchReport()).gates.find((g) => g.key === 'BACKUP')?.status ===
        'PENDING',
      'changed revision invalidates proof',
    );
    process.env.APP_COMMIT = 'a'.repeat(40);
    await db().launchGate.update({
      where: { key: 'BACKUP' },
      data: { checkedAt: new Date(0) },
    });
    check(
      (await launchReport()).gates.find((g) => g.key === 'BACKUP')?.status ===
        'PENDING',
      'expired proof cannot close launch',
    );
    let denied = false;
    try {
      await attestGate(
        {
          key: 'DERIVED_REPLAY_STABLE',
          status: 'VERIFIED',
          reference: 'review-1',
          sha256: 'a'.repeat(64),
        },
        true,
      );
    } catch {
      denied = true;
    }
    check(denied, 'manual claim cannot bypass replay');
    await recordGate('DERIVED_REPLAY_STABLE', 'FAILED', 'Semantic mismatch', {
      table: 'XpLedgerEntry',
    });
    report = await launchReport();
    check(report.overall === 'BLOCKED', 'replay failure blocks launch');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      }),
      client = await pool.connect();
    try {
      const { restoreInventory } = await import('../../scripts/restore-drill');
      const originalTimezone = (
        await client.query("SELECT current_setting('TimeZone') AS timezone")
      ).rows[0].timezone;
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      const utcInventory = await restoreInventory(client);
      await client.query("SET LOCAL TIME ZONE 'America/Toronto'");
      const torontoInventory = await restoreInventory(client);
      check(
        utcInventory._prisma_migrations.count > 0 &&
          JSON.stringify(utcInventory) === JSON.stringify(torontoInventory),
        'populated restore inventory is identical across session timezones',
      );
      await client.query('ROLLBACK');
      check(
        (await client.query("SELECT current_setting('TimeZone') AS timezone"))
          .rows[0].timezone === originalTimezone,
        'inventory timezone normalization stays inside the transaction',
      );
      const a = await semanticFingerprints(client, 'derived');
      await db().collectorProgress.updateMany({
        data: { calculatedAt: new Date() },
      });
      const b = await semanticFingerprints(client, 'derived');
      check(
        fingerprintDiff(a, b).length === 0,
        'processing timestamps excluded from semantic hash',
      );
      const subject = await db().collectorProgress.findFirst();
      if (subject) {
        await db().collectorProgress.update({
          where: { collectorId: subject.collectorId },
          data: { xp: { increment: 1 } },
        });
        check(
          fingerprintDiff(
            b,
            await semanticFingerprints(client, 'derived'),
          ).includes('CollectorProgress'),
          'equal-row-count XP mutation detected',
        );
        await db().collectorProgress.update({
          where: { collectorId: subject.collectorId },
          data: { xp: subject.xp },
        });
      }
      check(
        Object.keys(await semanticFingerprints(client, 'input')).length > 10,
        'input fingerprint covers provenance identity source and catalogs',
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
    const audit = await evidenceAudit();
    check(audit.duplicateCanonicalEvents === 0, 'canonical duplicate audit');
    check(
      !JSON.stringify(audit.pilots).includes('discordId'),
      'pilot comparison exports counters only',
    );
    await db().launchGate.deleteMany();
  } finally {
    if (before === undefined) delete process.env.APP_COMMIT;
    else process.env.APP_COMMIT = before;
  }
}
