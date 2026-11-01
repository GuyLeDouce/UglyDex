import { CollectorNav } from '@/components/collector-nav';
import { publicSetCollector } from '@/server/dex';
import { UnclaimedHolderNotice } from '@/components/unclaimed-holder';
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let collector = null;
  try {
    collector = await publicSetCollector(slug);
  } catch {}
  return (
    <>
      {collector && <CollectorNav slug={slug} />}
      {collector?.unclaimed && <UnclaimedHolderNotice />}
      {children}
    </>
  );
}
