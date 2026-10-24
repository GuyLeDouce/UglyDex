import 'dotenv/config';
import { backfillHolders } from '../src/server/collector-discovery';
import { db } from '../src/server/db';
import { assertOperation } from '../src/server/deployment';
import { appEnvironment } from '../src/domain/deployment';
import { normalizeWallet } from '../src/domain/validation';
const apply = process.argv.includes('--apply');
const after =
  process.argv.find((a) => a.startsWith('--after='))?.slice(8) ?? '';
try {
  const args = process.argv.slice(2);
  if (
    args.some(
      (a) => a !== '--apply' && a !== '--dry-run' && !a.startsWith('--after='),
    ) ||
    (apply && args.includes('--dry-run')) ||
    args.filter((a) => a.startsWith('--after=')).length > 1
  )
    throw new Error('INVALID_ARGUMENT');
  if (after) normalizeWallet(after);
  if (apply) {
    const binding = await db().deploymentIdentity.findUnique({
      where: { id: 'instance' },
    });
    if (
      appEnvironment() === 'production' ||
      binding?.environment === 'production'
    )
      throw new Error('PRODUCTION_BACKFILL_REQUIRES_SEPARATE_REVIEW');
    await assertOperation('collector-discovery');
  }
  const result = await backfillHolders({ dryRun: !apply, after });
  console.log(
    JSON.stringify({ event: 'collector.discovery.batch', ...result }),
  );
} finally {
  await db().$disconnect();
}
