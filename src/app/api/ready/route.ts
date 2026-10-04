import { migrationChecks } from '@/server/production';
export const dynamic = 'force-dynamic';
function safeMigrationDetail(name: string, detail: string) {
  const safeFixed = [
    'No unfinished migrations',
    'Applied SQL matches this release',
  ];
  const names = detail.split(', ');
  return safeFixed.includes(detail) ||
    (name.startsWith('migration.') &&
      names.length > 0 &&
      names.every((value) => /^\d{12}_[a-z0-9_]+$/.test(value)))
    ? detail
    : 'REVIEW_REQUIRED';
}
export async function GET() {
  try {
    const failed = (await migrationChecks()).filter((c) => c.status === 'FAIL');
    if (failed.length) {
      console.error(
        JSON.stringify({
          event: 'readiness.blocked',
          checks: failed.map((c) => c.name),
          migrationDetails: failed
            .filter((c) => c.name.startsWith('migration.'))
            .map((c) => ({
              name: c.name,
              detail: safeMigrationDetail(c.name, c.detail),
            })),
        }),
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
