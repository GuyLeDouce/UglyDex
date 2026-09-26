'use client';
import { useState } from 'react';
import { services } from '@/domain/operations';
export function WorkerControls({
  controls,
}: {
  controls: { service: string; mode: string }[];
}) {
  const [message, setMessage] = useState('');
  return (
    <form
      className="settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setMessage('Saving…');
        try {
          const response = await fetch('/api/admin/production', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(form)),
          });
          setMessage(
            response.ok
              ? 'Saved. Effective after the current bounded task finishes. Refresh to inspect heartbeats.'
              : 'Unable to update worker.',
          );
        } catch {
          setMessage('Unable to update worker.');
        }
      }}
    >
      <label>
        Worker
        <select name="service">
          {services.map((s) => (
            <option key={s} value={s}>
              {s} ({controls.find((c) => c.service === s)?.mode ?? 'DISABLED'})
            </option>
          ))}
        </select>
      </label>
      <label>
        Mode
        <select name="mode">
          <option>DISABLED</option>
          <option>LIVE</option>
          <option>HISTORICAL</option>
        </select>
      </label>
      <p>
        HISTORICAL explicitly permits backfill work. LIVE requires completed
        source backfills. Disabled workers stay alive and report status.
      </p>
      <button className="button">Apply worker mode</button>
      <p role="status">{message}</p>
    </form>
  );
}
