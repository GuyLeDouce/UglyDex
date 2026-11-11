export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await adminActor())) notFound();
  return children;
}
