import { notFound, redirect } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { currentSession } from '@/server/auth';
import { WorkInvite } from '@/components/work-invite';
import { issueWorkCode } from '@/server/work-session';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!(await adminActor())) notFound();
  const { token } = await searchParams;
  if (token && /^[1-9][0-9]{0,3}$/.test(token) && Number(token) <= 4444)
    redirect('/share?kind=passport&format=trading-card&entity=' + token);
  async function issue() {
    'use server';
    return await issueWorkCode();
  }
  return (
    <section className="panel">
      <h1>Collection admin</h1>
      <form>
        <label>
          Squig token ID{' '}
          <input required type="number" min="1" max="4444" name="token" />
        </label>{' '}
        <button className="button">Open Squig Card</button>
      </form>
      {(await currentSession())?.authMethod === 'DISCORD_OAUTH' && (
        <WorkInvite issue={issue} />
      )}
    </section>
  );
}
