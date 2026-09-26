import { CollectorNav } from '@/components/collector-nav';
import { db } from '@/server/db';
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let visible = false;
  try {
    visible = !!(await db().collector.findFirst({
      where: { slug, isPublic: true },
      select: { id: true },
    }));
  } catch {}
  return (
    <>
      {visible && <CollectorNav slug={slug} />} {children}
    </>
  );
}
