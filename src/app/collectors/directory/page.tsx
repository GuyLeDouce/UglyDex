import Link from 'next/link';
import { UglyUsers } from '@/components/ugly-users';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Collector Directory | UglyDex' };
export default async function Directory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page =
    typeof params.usersPage === 'string' && /^\d{1,5}$/.test(params.usersPage)
      ? Math.max(1, Number(params.usersPage))
      : 1;
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">EVERY WALLET HAS A STORY</p>
        <h1>Collector directory</h1>
        <p>
          Public collectors and automatically discovered Squig holders.
          Unclaimed records contain public blockchain information only.
        </p>
        <Link href="/collectors">Field Guide leaderboard →</Link>
      </section>
      <UglyUsers page={page} path="/collectors/directory" />
    </>
  );
}
