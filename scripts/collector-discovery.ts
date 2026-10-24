import 'dotenv/config';
import { backfillHolders } from '../src/server/collector-discovery';
import { db } from '../src/server/db';
const apply = process.argv.includes('--apply');
const after =
  process.argv.find((a) => a.startsWith('--after='))?.slice(8) ?? '';
try {
  if (apply && process.env.APP_ENV === 'production')
    throw new Error('PRODUCTION_BACKFILL_REQUIRES_SEPARATE_REVIEW');
  const result = await backfillHolders({ dryRun: !apply, after });
  console.log(
    JSON.stringify({ event: 'collector.discovery.batch', ...result }),
  );
} finally {
  await db().$disconnect();
}
