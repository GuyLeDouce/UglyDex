import { redirect } from 'next/navigation';
import { redeemWorkCode } from '@/server/work-session';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  async function signIn(data: FormData) {
    'use server';
    const ok = await redeemWorkCode(String(data.get('code') ?? '').trim());
    redirect(ok ? '/admin/collection' : '/work-login?error=1');
  }
  return (
    <section className="panel">
      <h1>ChatGPT Work sign-in</h1>
      <form action={signIn}>
        <label>
          Single-use admin code{' '}
          <input name="code" type="password" autoComplete="off" required />
        </label>{' '}
        <button className="button">Sign in</button>
      </form>
      {(await searchParams).error && (
        <p role="alert">Code invalid, expired or already used.</p>
      )}
    </section>
  );
}
