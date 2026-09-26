import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="anchor-nav" aria-label="Settings">
        <Link href="/settings/profile">Profile & privacy</Link>
        <Link href="/settings/appearance">Appearance</Link>
        <Link href="/settings/galleries">Galleries</Link>
        <Link href="/settings/sharing">Sharing</Link>
      </nav>
      {children}
    </>
  );
}
