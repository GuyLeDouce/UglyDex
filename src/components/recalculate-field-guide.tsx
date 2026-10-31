'use client';
import { useEffect, useId, useState } from 'react';
import styles from './recalculate-field-guide.module.css';
import { useRouter } from 'next/navigation';
export function RecalculateFieldGuide() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [seconds, setSeconds] = useState(0);
  const statusId = useId();
  const router = useRouter();
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  async function rebuild() {
    setMessage('');
    setSeconds(0);
    setBusy(true);
    try {
      const response = await fetch('/api/collection/recalculate', {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.fieldGuideComplete) router.refresh();
        throw Error(result.error || 'Recalculation failed. Please retry.');
      }
      setMessage(
        `Recalculated: ${result.counts.discovered} discoveries, ${result.counts.traits} traits.`,
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Recalculation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.container}>
      <button className="button" disabled={busy} onClick={rebuild}>
        {busy ? 'Recalculating…' : 'Recalculate my Field Guide'}
      </button>
      {busy && (
        <div className={styles.progressPanel}>
          <div
            className={styles.track}
            role="progressbar"
            aria-label="Recalculating Field Guide"
            aria-describedby={statusId}
          >
            <span className={styles.indicator} />
          </div>
          <p className={styles.elapsed} aria-hidden="true">
            {seconds >= 30 ? 'Still working' : 'Recalculating'} · {seconds}s
            elapsed
          </p>
        </div>
      )}
      <p id={statusId} role="status" aria-atomic="true">
        {busy
          ? 'Updating your discoveries, traits and sets. Please keep this page open.'
          : message}
      </p>
    </div>
  );
}
