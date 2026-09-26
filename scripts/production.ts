import 'dotenv/config';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { db } from '../src/server/db';
import { preflight } from '../src/server/production';
import { productionBackfill } from '../src/server/production-backfill';
import { productionVerify } from '../src/server/production-verify';
import { setWorkerControl } from '../src/server/worker-runtime';
import {
  backfillStages,
  safeOperationalCode,
  type Check,
} from '../src/domain/operations';
import { closeExternalPools } from '../src/integrations/read-only';
const [command, ...args] = process.argv.slice(2);
const value = (name: string) => args[args.indexOf(name) + 1];
const report = (checks: Check[]) => {
  for (const c of checks) console.log(`${c.status} ${c.name}: ${c.detail}`);
  if (checks.some((c) => c.status === 'FAIL')) process.exitCode = 1;
};
const stop = new AbortController();
process.once('SIGTERM', () => stop.abort());
process.once('SIGINT', () => stop.abort());
try {
  const allowed: Record<string, string[]> = {
    preflight: ['--offline'],
    backfill: ['--status', '--execute', '--from', '--batches'],
    verify: ['--owners'],
    worker: ['--service', '--mode'],
  };
  if (!allowed[command]) throw new Error('UNKNOWN_COMMAND');
  for (let i = 0; i < args.length; i++) {
    if (!allowed[command].includes(args[i]))
      throw new Error('INVALID_ARGUMENT');
    if (
      ['--from', '--batches', '--owners', '--service', '--mode'].includes(
        args[i],
      ) &&
      !args[++i]
    )
      throw new Error('MISSING_ARGUMENT');
  }
  if (command === 'preflight') {
    const checks = await preflight({
      external: !args.includes('--offline'),
      render: !args.includes('--offline'),
    });
    if (
      !checks.some(
        (c) =>
          c.status === 'FAIL' &&
          (c.name === 'database' ||
            c.name === 'environment' ||
            c.name.startsWith('migration')),
      )
    ) {
      // Read-only diff; suppress raw CLI output, which may contain connection details.
      const exit = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            'node_modules/prisma/build/index.js',
            'migrate',
            'diff',
            '--from-config-datasource',
            '--to-schema',
            'prisma/schema.prisma',
            '--exit-code',
          ],
          { stdio: 'ignore', windowsHide: true },
        );
        const timeout = setTimeout(() => child.kill(), 60000);
        child.once('error', reject);
        child.once('exit', (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
      });
      checks.push({
        name: 'migration.drift',
        status: exit === 0 ? 'PASS' : 'FAIL',
        detail:
          exit === 0
            ? 'Live Prisma-managed schema matches release; custom SQL constraints remain covered by database tests'
            : exit === 2
              ? 'Schema drift detected; inspect manually; nothing was repaired'
              : 'Schema comparison unavailable',
      });
    }
    report(checks);
  } else if (command === 'backfill') {
    if (args.includes('--status'))
      console.log(
        JSON.stringify(await db().productionStage.findMany(), null, 2),
      );
    else if (!args.includes('--execute'))
      console.log(
        `Plan only. Stages: ${backfillStages.join(' → ')}. Disable workers, pass preflight and source validation, take a database backup, then use --execute. Default execution stops after 20 batches; rerun to resume. --from requires all earlier stages complete.`,
      );
    else {
      const from = args.includes('--from')
        ? z.enum(backfillStages).parse(value('--from'))
        : undefined;
      const batches = args.includes('--batches')
        ? z.coerce.number().int().min(1).max(10000).parse(value('--batches'))
        : 20;
      console.log(
        JSON.stringify(
          await productionBackfill({ from, batches, signal: stop.signal }),
          null,
          2,
        ),
      );
    }
  } else if (command === 'verify')
    report(
      await productionVerify({
        owners: args.includes('--owners')
          ? z.enum(['spot', 'full']).parse(value('--owners'))
          : undefined,
      }),
    );
  else if (command === 'worker') {
    await setWorkerControl(
      { service: value('--service'), mode: value('--mode') },
      'cli:operator',
    );
    console.log(
      'Worker control updated; changes apply between bounded batches.',
    );
  }
} catch (error) {
  console.error(safeOperationalCode(error));
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db().$disconnect();
}
