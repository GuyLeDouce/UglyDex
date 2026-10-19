'use client';
import { useEffect, useState } from 'react';
import { shareQuery, type ShareSpec } from '@/domain/sharing';
import { shareStyleLabels } from '@/domain/share-styles';
export function ShareControls({
  spec,
  url,
  copy,
  owner = false,
  label = 'Share ↗',
}: {
  spec: Partial<ShareSpec> & { entity: string };
  url: string;
  copy: string;
  owner?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [ratio, setRatio] = useState<ShareSpec['ratio']>(spec.ratio ?? 'landscape'),
    [template, setTemplate] = useState<ShareSpec['template']>(
      spec.template ?? 'clean',
    );
  const image =
    '/api/share?' +
    shareQuery({ ...spec, ratio, template }) +
    (owner ? '&preview=1' : '');
  return (
    <div className="share-controls">
      <button
        className="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
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
                {Object.entries(shareStyleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ShareImage
            key={image}
            image={image}
            url={url}
            copy={copy}
            owner={owner}
          />
        </section>
      )}
    </div>
  );
}

// Remount for each selection so an old response can never become the new download.
function ShareImage({
  image,
  url,
  copy,
  owner,
}: {
  image: string;
  url: string;
  copy: string;
  owner: boolean;
}) {
  const [asset, setAsset] = useState<{ url: string; file: File } | null>(null),
    [message, setMessage] = useState('Preparing image…'),
    [busy, setBusy] = useState(false),
    [prepared, setPrepared] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function prepare() {
      try {
        const response = await fetch(image, {
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(60000),
          ]),
        });
        if (!response.ok) {
          if (response.status === 429)
            throw new Error(
              `Image service is busy. Try again in ${response.headers.get('Retry-After') ?? '60'} seconds.`,
            );
          if (response.status === 409)
            throw new Error('This card changed. Please try again.');
          throw new Error(
            'Image unavailable. Check privacy or try again shortly.',
          );
        }
        const blob = await response.blob();
        if (blob.type.split(';')[0] !== 'image/png' || !blob.size)
          throw new Error('Image unavailable. Please try again.');
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setAsset({
          url: objectUrl,
          file: new File([blob], 'uglydex.png', { type: 'image/png' }),
        });
        setMessage('Image ready.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setFailed(true);
        setMessage(
          error instanceof Error && error.name !== 'TimeoutError'
            ? error.message
            : 'The image took too long. Please try again.',
        );
      }
    }
    void prepare();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image, attempt]);

  async function download(native = false) {
    if (!asset || busy) return;
    setBusy(true);
    try {
      if (native && navigator.canShare?.({ files: [asset.file] })) {
        if (!prepared) {
          setPrepared(true);
          setMessage('Image ready. Tap Share image to choose where it goes.');
          return;
        }
        // No fetch before this call: preserve the click's transient activation.
        await navigator.share({
          files: [asset.file],
          title: 'UglyDex',
          text: copy,
          ...(!owner ? { url } : {}),
        });
        setMessage('Image shared.');
      } else {
        // The displayed preview is already downloaded. Save those exact bytes.
        const objectUrl = URL.createObjectURL(asset.file),
          anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = 'uglydex.png';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        // Keep the URL alive while browsers hand off the download, even if closed.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        setMessage('Image ready.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error && error.name === 'AbortError'
          ? 'Sharing cancelled.'
          : 'Could not share the image. You can still download the PNG.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {asset && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="share-preview"
          src={asset.url}
          data-source={image}
          alt="UglyDex share card preview"
        />
      )}
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
          disabled={busy || !asset}
          onClick={() => download()}
        >
          Download PNG
        </button>
        <button
          type="button"
          className="button"
          disabled={busy || !asset}
          onClick={() => download(true)}
        >
          {prepared ? 'Share image' : 'Prepare image to share'}
        </button>
      </div>
      {failed && (
        <button
          type="button"
          className="button"
          onClick={() => {
            setFailed(false);
            setMessage('Preparing image…');
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
      )}
      <p role="status">{message}</p>
    </>
  );
}
