import { db } from '@/server/db';
import {
  operationalFailure,
  observedHealth,
} from '@/server/operational-metrics';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db().$queryRaw`SELECT 1`;
    observedHealth();
    return Response.json(
      { status: 'ok', database: 'connected' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    await operationalFailure('DATABASE_FAILURE');
    return Response.json(
      { status: 'unavailable', database: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
