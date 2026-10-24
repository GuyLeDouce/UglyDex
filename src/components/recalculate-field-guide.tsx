'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function RecalculateFieldGuide() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter();
  async function rebuild() {
    setBusy(true);
    try {
      const response = await fetch('/api/collection/recalculate', {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setMessage(
        `Recalculated: ${result.counts.discovered} verified discoveries, ${result.counts.traits} traits.`,
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Recalculation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="button" disabled={busy} onClick={rebuild}>
        {busy ? 'Recalculating…' : 'Recalculate my Field Guide'}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
