import { migrationChecks } from '@/server/production';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    if ((await migrationChecks()).some((c) => c.status === 'FAIL'))
      throw new Error('NOT_READY');
    return Response.json(
      { status: 'ready' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'not_ready' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
