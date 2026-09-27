import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import { db } from '../src/server/db';
import {
  assertOperation,
  registerDeployment,
  deploymentChecks,
} from '../src/server/deployment';
import { databaseFingerprint } from '../src/domain/deployment';
import { preflight } from '../src/server/production';
import { safeOperationalCode } from '../src/domain/operations';
import { closeExternalPools } from '../src/integrations/read-only';
import { z } from 'zod';
const [command, ...args] = process.argv.slice(2);
const value = (key: string) => args[args.indexOf(key) + 1];
try {
  if (command === 'report') {
    const { productionEvidenceReport } =
      await import('../src/server/production-report');
    console.log(JSON.stringify(await productionEvidenceReport(), null, 2));
  } else if (command === 'fingerprint')
    console.log(databaseFingerprint(process.env.DATABASE_URL!));
  else if (command === 'register') {
    await registerDeployment();
    console.log('PASS deployment identity registered');
  } else if (command === 'staging') {
    const checks = [
      ...(await deploymentChecks(true)),
      ...(await preflight({
        external: !args.includes('--offline'),
        render: !args.includes('--offline'),
      })),
    ];
    for (const c of checks) console.log(`${c.status} ${c.name}: ${c.detail}`);
    if (checks.some((c) => c.status === 'FAIL')) process.exitCode = 1;
  } else if (command === 'pilot') {
    await assertOperation('pilot');
    const { feeds } = await import('../src/sync/normalize');
    const feed = z.enum(feeds).parse(value('--feed'));
    const since = z.coerce.date().parse(value('--since'));
    const { runActivityFeed } = await import('../src/sync/activity');
    const source = await db().integrationSource.findUnique({
      where: { id: feed },
    });
    if (!source?.schemaValid || source.warning === 'ROLE_HAS_WRITE_PRIVILEGES')
      throw new Error('SOURCE_VALIDATION_REQUIRED');
    const counts = await runActivityFeed(feed, { since, maxPages: 1 });
    const checkedSource = await db().integrationSource.findUniqueOrThrow({
      where: { id: feed },
    });
    const pilot = await db().operationalAudit.create({
      data: {
        actor: 'cli:operator',
        action: 'PILOT_IMPORT',
        subject: feed,
        detail: {
          since: since.toISOString(),
          schemaFingerprint: checkedSource.schemaFingerprint,
          ...counts,
        },
      },
    });
    console.log(
      JSON.stringify({
        run: pilot.id,
        feed,
        limit: 200,
        ...counts,
        reviewRequired: true,
      }),
    );
    if (counts.failed) process.exitCode = 1;
  } else if (command === 'pilot-approve') {
    await assertOperation('pilot');
    const run = await db().operationalAudit.findUniqueOrThrow({
      where: { id: z.uuid().parse(value('--run')) },
    });
    const detail = run.detail as {
      failed?: number;
      scanned?: number;
      schemaFingerprint?: string;
    };
    if (
      run.action !== 'PILOT_IMPORT' ||
      detail.failed !== 0 ||
      !detail.scanned ||
      !args.includes('--reviewed')
    )
      throw new Error('PILOT_REVIEW_REQUIRED');
    const source = await db().integrationSource.findUniqueOrThrow({
      where: { id: run.subject },
    });
    if (source.schemaFingerprint !== detail.schemaFingerprint)
      throw new Error('PILOT_SCHEMA_CHANGED');
    await db().operationalAudit.create({
      data: {
        actor: 'cli:operator',
        action: 'PILOT_APPROVED',
        subject: run.subject,
        detail: { run: run.id, schemaFingerprint: source.schemaFingerprint },
      },
    });
    console.log(
      'PASS pilot approval recorded; unresolved identities and rejection gates remain enforced',
    );
  } else if (command === 'contract') {
    if (!args.includes('--reviewed'))
      throw new Error('OFFICIAL_REVIEW_REQUIRED');
    const file = value('--file');
    if (!file || (await stat(file)).size > 100000)
      throw new Error('INVALID_MANIFEST');
    const { registerEditionContract } =
      await import('../src/server/edition-indexer');
    const row = await registerEditionContract(
      JSON.parse(await readFile(file, 'utf8')),
      'cli:reviewed',
    );
    console.log(
      JSON.stringify({ id: row.id, status: row.status, enabled: row.enabled }),
    );
  } else if (command === 'edition-control') {
    const id = value('--id'),
      enabled = value('--mode') === 'enabled';
    if (!id || !['enabled', 'disabled'].includes(value('--mode')))
      throw new Error('INVALID_ARGUMENT');
    if (enabled) await assertOperation('editions');
    await db().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
      const c = await tx.editionContract.findUniqueOrThrow({ where: { id } });
      if (c.status !== 'VERIFIED') throw new Error('CONTRACT_NOT_VERIFIED');
      await tx.editionContract.update({
        where: { id },
        data: { enabled, revision: { increment: 1 } },
      });
      await tx.operationalAudit.create({
        data: {
          actor: 'cli:operator',
          action: 'EDITION_CONTROL',
          subject: id,
          detail: { enabled },
        },
      });
    });
    console.log('PASS Edition index control updated');
  } else if (command === 'edition-batch') {
    await assertOperation('editions');
    const { editionIndexBatch } = await import('../src/server/edition-indexer');
    console.log(JSON.stringify(await editionIndexBatch(value('--id'))));
  } else if (command === 'record') {
    await assertOperation('release');
    const commit = z
      .string()
      .regex(/^[a-f0-9]{7,40}$/)
      .parse(value('--commit'));
    await db().operationalAudit.create({
      data: {
        actor: 'cli:operator',
        action: 'DEPLOYMENT',
        subject: commit,
        detail: {
          environment: process.env.APP_ENV ?? 'development',
          note: z
            .string()
            .max(500)
            .parse(value('--note') ?? ''),
        },
      },
    });
    console.log('PASS deployment recorded');
  } else throw new Error('UNKNOWN_COMMAND');
} catch (e) {
  console.error(safeOperationalCode(e));
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db().$disconnect();
}
