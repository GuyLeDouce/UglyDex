'use client';
import dynamic from 'next/dynamic';
import { parseCardFinish, type CardFinish } from '@/domain/card-finish';
const InteractiveCard = dynamic(
  () => import('./interactive-card').then((module) => module.InteractiveCard),
  { ssr: false },
);
import { shareFilename } from '@/domain/trading-card';
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
  const [open, setOpen] = useState(
      spec.format === 'trading-card' || spec.format === 'collector-card',
    ),
    [format, setFormat] = useState<ShareSpec['format']>(
      spec.format ?? 'standard',
    ),
    [ratio, setRatio] = useState<ShareSpec['ratio']>(spec.ratio ?? 'landscape'),
    [template, setTemplate] = useState<ShareSpec['template']>(
      spec.template ?? 'clean',
    );
  const canTrade = spec.kind === 'squig' || spec.kind === 'passport';
  const collector = spec.kind === 'collector' && format === 'collector-card';
  const trading = collector || (canTrade && format === 'trading-card');
  const activeFormat = collector
    ? 'collector-card'
    : trading
      ? 'trading-card'
      : spec.format
        ? 'standard'
        : undefined;
  const selectedUrl =
    (canTrade || spec.kind === 'collector') && (trading || !!spec.format)
      ? new URL(
          '/share?' +
            shareQuery({
              kind: spec.kind === 'collector' ? 'collector' : 'passport',
              entity: spec.entity,
              ...(trading ? { format: activeFormat } : {}),
            }),
          url,
        ).href
      : url;
  const image =
    '/api/share?' +
    shareQuery({ ...spec, ratio, template, format: activeFormat }) +
    (owner ? '&preview=1' : '');
  return (
    <div className="share-controls">
      <button
        className="button primary"
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
          {(canTrade || spec.kind === 'collector') && (
            <label className="share-format">
              Format
              <select
                aria-label="Share format"
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as ShareSpec['format'])
                }
              >
                <option value="standard">Passport / social image</option>
                {canTrade ? (
                  <option value="trading-card">
                    Squigs Reloaded Trading Card
                  </option>
                ) : (
                  <option value="collector-card">UglyDex Collector Card</option>
                )}
              </select>
            </label>
          )}
          {collector && (
            <p>
              1500 × 2100 · Blue & yellow holographic collector card. Confirmed
              profile progress; pending values remain unscored.
            </p>
          )}
          {trading && !collector && (
            <p>
              1500 × 2100 PNG · Original artwork · Rarity-coloured frame. Values
              reflect the indexed metadata when generated. This card does not
              certify ownership.
            </p>
          )}
          {!trading && (
            <div className="share-options">
              <label>
                Shape
                <select
                  aria-label="Shape"
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
                  onChange={(e) =>
                    setTemplate(e.target.value as typeof template)
                  }
                >
                  {Object.entries(shareStyleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <ShareImage
            key={image}
            image={image}
            trading={trading}
            filename={shareFilename({
              entity: spec.entity,
              format: activeFormat,
            })}
            url={selectedUrl}
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
  trading,
  filename,
  url,
  copy,
  owner,
}: {
  image: string;
  trading: boolean;
  filename: string;
  url: string;
  copy: string;
  owner: boolean;
}) {
  const [asset, setAsset] = useState<{
      url: string;
      file: File;
      finish: CardFinish;
      description: string;
    } | null>(null),
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
          if (trading && response.status === 503)
            throw new Error(
              'The trading card could not be prepared. Please retry once the original artwork is available.',
            );
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
          description: decodeURIComponent(
            response.headers.get('X-Card-Description') ??
              'Squigs Reloaded collector card',
          ),
          finish: {
            ...parseCardFinish(
              response.headers.get('X-Card-Rarity'),
              response.headers.get('X-Card-OG'),
            ),
            ...(response.headers.get('X-Card-Type') === 'collector'
              ? { collector: true }
              : {}),
          },
          file: new File([blob], filename, { type: 'image/png' }),
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
  }, [image, attempt, filename, trading]);

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
        anchor.download = filename;
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
          className={
            trading ? 'share-preview share-preview--trading' : 'share-preview'
          }
          src={asset.url}
          data-source={image}
          alt={
            trading
              ? asset.finish.collector
                ? 'UglyDex collector trading card preview'
                : 'Squigs Reloaded trading card preview'
              : 'UglyDex share card preview'
          }
        />
      )}
      {asset && trading && (
        <InteractiveCard
          image={asset.url}
          finish={asset.finish}
          description={asset.description}
          filename={filename}
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
