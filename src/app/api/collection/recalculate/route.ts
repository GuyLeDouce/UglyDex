import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { seedCollections, rebuildCollection } from '@/server/dex-engine';
import { assertDeploymentBinding } from '@/server/deployment';
import { appEnvironment } from '@/domain/deployment';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const session = await currentSession();
    if (!session)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    if (appEnvironment() !== 'staging')
      return Response.json(
        {
          error: 'Manual recalculation is currently available in staging only.',
        },
        { status: 403 },
      );
    await assertDeploymentBinding();
    await rateLimit('field-guide-recalculate', session.collectorId, 2);
    await seedCollections();
    const counts = await rebuildCollection(session.collectorId);
    return Response.json(
      { status: 'COMPLETE', counts },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      {
        error:
          'Recalculation could not finish. Your ownership evidence is preserved. Check collection diagnostics.',
      },
      { status: 400 },
    );
  }
}
