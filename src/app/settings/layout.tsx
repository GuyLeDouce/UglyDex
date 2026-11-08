import { GALLERIES_ENABLED } from '@/domain/features';
import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="anchor-nav" aria-label="Settings">
        <Link href="/settings/wallets">Account connections</Link>
        <Link href="/settings/profile">Profile & privacy</Link>
        <Link href="/settings/appearance">My Collector Card</Link>
        {GALLERIES_ENABLED && <Link href="/settings/galleries">Galleries</Link>}
        <Link href="/settings/sharing">Share Studio</Link>
      </nav>
      {children}
    </>
  );
}
