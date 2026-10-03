import { migrationChecks } from '@/server/production';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const failed = (await migrationChecks())
      .filter((c) => c.status === 'FAIL')
      .map((c) => c.name);
    if (failed.length) {
      console.error(
        JSON.stringify({ event: 'readiness.blocked', checks: failed }),
      );
      return Response.json(
        { status: 'not_ready' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return Response.json(
      { status: 'ready' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'readiness.check_error',
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return Response.json(
      { status: 'not_ready' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
