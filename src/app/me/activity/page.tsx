import { requireCollector } from '@/server/session';
import { ActivityView, EcosystemSummary } from '@/components/activity';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const collectorId = await requireCollector();
  return (
    <>
      <EcosystemSummary collectorId={collectorId} path="/me/activity" />
      <ActivityView
        collectorId={collectorId}
        path="/me/activity"
        params={await searchParams}
      />
    </>
  );
}
