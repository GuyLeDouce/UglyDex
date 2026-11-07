import 'server-only';
import { redirect } from 'next/navigation';
import { onboardingState } from './onboarding';
import { currentSession } from './auth';
export async function requireCollector(
  options: { allowIncomplete?: boolean } = {},
) {
  const session = await currentSession();
  if (!session) redirect('/connect');
  if (
    !options.allowIncomplete &&
    (await onboardingState(session.collectorId)).step !== 'COMPLETE'
  )
    redirect('/onboarding');
  return session.collectorId;
}
