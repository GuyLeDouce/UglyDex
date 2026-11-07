'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function OnboardingChoice({
  action,
  children,
}: {
  action: 'decline' | 'enable' | 'complete';
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const response = await fetch('/api/onboarding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(
                'Your choice could not be saved. Please try again.',
              );
            router.replace(result.next);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saving…' : children}
      </button>
      <p role="status">{error}</p>
    </div>
  );
}
