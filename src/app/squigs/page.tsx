import { Catalog, type SearchParams } from '@/components/catalog';
import { currentSession } from '@/server/auth';
export const dynamic = 'force-dynamic';
export default async function Squigs({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await currentSession();
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">THE COMPLETE FIELD GUIDE</p>
        <h1>4,444 kinds of strange.</h1>
        <p>Meet Squigs Reloaded. Filter the details. Find your kind of ugly.</p>
      </section>
      <Catalog params={await searchParams} viewerId={session?.collectorId} />
    </>
  );
}
