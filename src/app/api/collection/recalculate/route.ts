import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { seedCollections, rebuildCollection } from '@/server/dex-engine';
import { assertDeploymentBinding } from '@/server/deployment';
import { seedProgression, rebuildSubject } from '@/server/progression-engine';
import { recalculationErrorCode } from '@/server/recalculation-error';
import { log } from '@/server/log';
import { appEnvironment } from '@/domain/deployment';
export async function POST(request: Request) {
  let phase = 'authorization';
  let fieldGuideComplete = false;
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
    phase = 'catalog';
    await seedCollections();
    await seedProgression();
    phase = 'field-guide';
    const counts = await rebuildCollection(session.collectorId);
    fieldGuideComplete = true;
    phase = 'achievements';
    await rebuildSubject('COLLECTOR', session.collectorId);
    return Response.json(
      { status: 'COMPLETE', counts },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const throttled =
      error instanceof Error && error.message === 'RATE_LIMITED';
    const code = throttled ? 'RATE_LIMITED' : recalculationErrorCode(error);
    log('collections.manual_failed', { phase, code, fieldGuideComplete });
    return Response.json(
      {
        error: throttled
          ? 'Please wait a minute before recalculating again.'
          : fieldGuideComplete
            ? 'Your Field Guide was updated, but achievements could not finish. You can safely retry.'
            : 'Recalculation could not finish. Your ownership evidence is preserved. You can safely retry or check collection diagnostics.',
        code,
        phase,
        fieldGuideComplete,
      },
      {
        status: throttled ? 429 : phase === 'authorization' ? 400 : 503,
        headers: {
          'Cache-Control': 'no-store',
          ...(throttled ? { 'Retry-After': '60' } : {}),
        },
      },
    );
  }
}
