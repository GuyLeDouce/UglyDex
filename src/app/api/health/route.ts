import { db } from '@/server/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db().$queryRaw`SELECT 1`;
    return Response.json(
      { status: 'ok', database: 'connected' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'unavailable', database: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
