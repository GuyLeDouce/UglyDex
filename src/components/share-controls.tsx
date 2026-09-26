'use client';
import { useState } from 'react';
import { shareQuery, type ShareSpec } from '@/domain/sharing';
export function ShareControls({
  spec,
  url,
  copy,
  owner = false,
}: {
  spec: Partial<ShareSpec> & { entity: string };
  url: string;
  copy: string;
  owner?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [ratio, setRatio] = useState<'landscape' | 'square'>('landscape'),
    [template, setTemplate] = useState<'clean' | 'ugly' | 'stats'>('clean'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [prepared, setPrepared] = useState<{ image: string; file: File } | null>(
      null,
    );
  const image =
    '/api/share?' +
    shareQuery({ ...spec, ratio, template }) +
    (owner ? '&preview=1' : '');
  async function download(native = false) {
    setBusy(true);
    try {
      // Call Web Share directly from a fresh click. A slow render/fetch can
      // consume the browser's transient activation before the file is ready.
      if (native && prepared?.image === image) {
        await navigator.share({
          files: [prepared.file],
          title: 'UglyDex',
          text: copy,
          ...(!owner ? { url } : {}),
        });
        setMessage('Image shared.');
        return;
      }
      const r = await fetch(image);
      if (!r.ok) throw new Error();
      const blob = await r.blob(),
        file = new File([blob], 'uglydex.png', { type: 'image/png' });
      if (native && navigator.canShare?.({ files: [file] })) {
        setPrepared({ image, file });
        setMessage('Image ready. Tap Share image to choose where it goes.');
        return;
      } else {
        const u = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = u;
        a.download = 'uglydex.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 1000);
      }
      setMessage('Image ready.');
    } catch {
      setMessage(
        'Could not generate or share the image. Please try again shortly.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="share-controls">
      <button
        className="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Share ↗
      </button>
      {open && (
        <section className="share-panel" aria-label="Share card">
          <h2>Take the ugly with you.</h2>
          <p>{copy}</p>
          {owner && (
            <p>
              Private owner preview. Downloading or sharing the image makes its
              contents visible to your recipients.
            </p>
          )}
          <div className="share-options">
            <label>
              Shape
              <select
                value={ratio}
                onChange={(e) => setRatio(e.target.value as typeof ratio)}
              >
                <option value="landscape">Landscape · 1200 × 630</option>
                <option value="square">Square · 1080 × 1080</option>
              </select>
            </label>
            <label>
              Style
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as typeof template)}
              >
                <option value="clean">Clean</option>
                <option value="ugly">Ugly</option>
                <option value="stats">Stats</option>
              </select>
            </label>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="share-preview"
            src={image}
            alt="UglyDex share card preview"
            onError={() =>
              setMessage(
                'Preview unavailable. Check privacy or try again shortly.',
              )
            }
          />
          <div className="actions">
            {!owner && (
              <>
                <button
                  type="button"
                  className="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setMessage('Link copied.');
                    } catch {
                      setMessage(url);
                    }
                  }}
                >
                  Copy link
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={async () => {
                    try {
                      if (navigator.share)
                        await navigator.share({
                          title: 'UglyDex',
                          text: copy,
                          url,
                        });
                      else {
                        await navigator.clipboard.writeText(copy + ' ' + url);
                        setMessage('Share text copied.');
                      }
                    } catch {
                      setMessage('Sharing cancelled or unavailable.');
                    }
                  }}
                >
                  Share link
                </button>
              </>
            )}
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => download()}
            >
              Download PNG
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => download(true)}
            >
              {prepared?.image === image
                ? 'Share image'
                : 'Prepare image to share'}
            </button>
          </div>
          <p role="status">{message}</p>
        </section>
      )}
    </div>
  );
}
