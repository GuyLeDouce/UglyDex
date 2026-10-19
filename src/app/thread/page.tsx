import { CollectorThread } from '@/components/collector-thread';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Collector thread | UglyDex' };
export default async function Thread({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { page } = await searchParams;
  const number =
    typeof page === 'string' && /^\d{1,4}$/.test(page)
      ? Math.max(1, Number(page))
      : 1;
  return (
    <>
      <h1>Good things get ugly.</h1>
      <CollectorThread page={number} />
    </>
  );
}
