import { requireCollector } from '@/server/session';
import { ActivityView } from '@/components/activity';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <ActivityView
      collectorId={await requireCollector()}
      path="/me/creations"
      params={await searchParams}
      gallery
    />
  );
}
