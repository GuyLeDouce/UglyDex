import type { Metadata } from 'next';
import { LegalPolicy } from '@/components/legal-policy';

export const metadata: Metadata = {
  title: 'Terms of Service | UglyDex',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LegalPolicy file="TERMS.md" />;
}
