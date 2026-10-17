'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function CharmDripLink() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/charm/link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dripUserId: form.get('dripUserId') }),
      });
      const result = (await response.json()) as {
        linked?: boolean;
        balanceAvailable?: boolean;
        error?: string;
      };
      if (response.ok && result.linked) {
        setMessage(
          result.balanceAvailable
            ? 'DRIP account verified. Your balance has been updated.'
            : 'DRIP account verified, but it did not return a $CHARM balance.',
        );
        formElement.reset();
        router.refresh();
      } else {
        setMessage(
          result.error ?? 'DRIP verification is temporarily unavailable.',
        );
      }
    } catch {
      setMessage('DRIP verification is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel drip-link-panel">
      <h2>Link your DRIP account</h2>
      <p>
        Enter your DRIP user ID. UglyDex will verify it against a Discord or
        wallet already connected to your account before saving it.
      </p>
      <form onSubmit={submit}>
        <label>
          DRIP user ID
          <input
            name="dripUserId"
            autoComplete="off"
            inputMode="text"
            minLength={24}
            maxLength={24}
            pattern="[a-fA-F0-9]{24}"
            required
          />
        </label>
        <button disabled={busy} type="submit">
          {busy ? 'Verifying…' : 'Verify and link'}
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p>
        Click{' '}
        <a
          href="https://app.drip.re/user/profile"
          target="_blank"
          rel="noreferrer"
        >
          this link
        </a>{' '}
        to get your DRIP ID.
      </p>
      <p>
        If you are having troubles, let us know in{' '}
        <a href="https://squigs.io/discord" target="_blank" rel="noreferrer">
          Discord
        </a>
        .
      </p>
    </section>
  );
}
