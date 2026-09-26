import 'server-only';
import { redirect } from 'next/navigation';
import { currentSession } from './auth';
export async function requireCollector() {
  const session = await currentSession();
  if (!session) redirect('/connect');
  return session.collectorId;
}
