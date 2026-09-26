import { AdminCollectibleCatalog } from '@/components/admin-collectibles';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; token?: string }>;
}) {
  return <AdminCollectibleCatalog kind="EDITION" query={await searchParams} />;
}
