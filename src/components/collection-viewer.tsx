'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SquigCardData } from '@/server/collections';
import { TradingCardFace } from './trading-card-face';
import { AchievementStrip } from './achievement-strip';
import { CardDiscovery } from './card-discovery';
import { CollectorCardLink } from './collector-card-link';
import { shareQuery } from '@/domain/sharing';
import { shareFilename } from '@/domain/trading-card';

export function CollectionViewer({
  item,
  position,
  total,
  onClose,
  onPrevious,
  onNext,
  busy,
  collectorCard,
  viewerOwned,
}: {
  item: SquigCardData;
  position: number;
  total: number;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  busy: boolean;
  collectorCard: boolean;
  viewerOwned?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const cardFace = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [motion, setMotion] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const downloadAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      d?.close();
    };
  }, []);
  useEffect(() => {
    const stage = surface.current;
    const face = cardFace.current;
    if (!stage || !face) return;
    // Observe the untransformed face: legends and wrapped traits vary in height.
    // Leave room for the near edge to grow during the perspective rotation.
    function fit() {
      if (!stage || !face || !face.offsetHeight) return;
      const perspectiveRoom = 1 - face.offsetWidth / (2 * 1100);
      stage.style.setProperty(
        '--viewer-card-scale',
        String(
          Math.min(
            1,
            (stage.clientHeight * perspectiveRoom) / face.offsetHeight,
          ),
        ),
      );
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    observer.observe(face);
    return () => observer.disconnect();
  }, [item.tokenId]);
  useEffect(() => {
    setDownloadMessage('');
    setDownloading(false);
    return () => {
      const request = downloadAbort.current;
      downloadAbort.current = null;
      request?.abort();
    };
  }, [item.tokenId]);

  async function downloadFront() {
    if (downloadAbort.current || busy) return;
    const controller = new AbortController();
    downloadAbort.current = controller;
    setDownloading(true);
    setDownloadMessage('');
    try {
      const entity = String(item.tokenId);
      const url =
        '/api/share?' +
        shareQuery({ kind: 'passport', entity, format: 'trading-card' }) +
        '&download=1';
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 403)
        throw new Error('Front PNG downloads require the current holder or an admin.');
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'The image service is busy. Please retry shortly.'
            : 'The card could not be downloaded. Please retry.',
        );
      const blob = await response.blob();
      if (blob.type.split(';')[0] !== 'image/png' || !blob.size)
        throw new Error('The PNG was unavailable. Please retry.');
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = shareFilename({
        entity,
        format: 'trading-card',
      });
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Keep the blob alive until the browser accepts the download.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      setDownloadMessage('Front-facing PNG downloaded.');
    } catch (error) {
      if (!controller.signal.aborted)
        setDownloadMessage(
          error instanceof Error
            ? error.message
            : 'The card could not be downloaded. Please retry.',
        );
    } finally {
      if (downloadAbort.current === controller) {
        downloadAbort.current = null;
        setDownloading(false);
      }
    }
  }

  function reset() {
    surface.current?.style.setProperty('--light-x', '50%');
  }
  return (
    <dialog
      ref={dialog}
      className="album-viewer"
      aria-labelledby="album-viewer-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('input,select,textarea')) return;
        if (e.key === 'ArrowRight' && onNext && !busy) {
          e.preventDefault();
          reset();
          onNext();
        }
        if (e.key === 'ArrowLeft' && onPrevious && !busy) {
          e.preventDefault();
          reset();
          onPrevious();
        }
      }}
    >
      <header className="album-viewer-header">
        <div>
          <p className="eyebrow">YOUR FIELD GUIDE · CARD VIEWER</p>
          <h2 id="album-viewer-title">Squig #{item.tokenId}</h2>
          <p aria-live="polite">
            {position} of {total.toLocaleString()} matching Squigs
            {busy ? ' · Turning the page…' : ''}
          </p>
        </div>
        <button className="button" onClick={onClose} autoFocus>
          Close ×
        </button>
      </header>
      <div className="album-viewer-layout">
        <div
          ref={surface}
          className={`album-viewer-card ${motion ? 'has-motion' : ''}`}
          key={item.tokenId}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse')
              start.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const s = start.current;
            start.current = null;
            if (!s || busy) return;
            const dx = e.clientX - s.x,
              dy = e.clientY - s.y;
            if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              reset();
              if (dx < 0) onNext?.();
              else onPrevious?.();
            }
          }}
          onPointerCancel={() => {
            start.current = null;
            reset();
          }}
          onPointerLeave={reset}
          onPointerMove={(e) => {
            if (!motion || e.pointerType !== 'mouse') return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty(
              '--light-x',
              `${((e.clientX - r.left) / r.width) * 100}%`,
            );
          }}
        >
          <div className="squig-spin" ref={cardFace}>
            <div className="squig-spin-rotor">
              <TradingCardFace item={item} priority heading={false} />
            </div>
          </div>
        </div>
        <aside className="album-viewer-info">
          <nav
            className="album-viewer-navigation"
            aria-label="Browse matching Squigs"
          >
            <button
              className="button"
              disabled={!onPrevious || busy}
              onClick={() => {
                reset();
                onPrevious?.();
              }}
            >
              ← Previous card
            </button>
            <button
              className="button"
              disabled={!onNext || busy}
              onClick={() => {
                reset();
                onNext?.();
              }}
            >
              Next card →
            </button>
          </nav>
          <p className="muted">
            Swipe across the card or use the arrow keys. Browsing follows your
            current search and sort.
          </p>
          <CardDiscovery item={item} viewerOwned={viewerOwned} />
          <nav
            className="card-record-links"
            aria-label="Squig history and achievements"
          >
            <Link href={`/squig/${item.tokenId}#achievements`}>
              {item.achievements && (
                <AchievementStrip summary={item.achievements} subject="SQUIG" />
              )}
              Achievements & badges →
            </Link>
            <Link href={`/squig/${item.tokenId}#ecosystem`}>
              Duels & activity →
            </Link>
            <Link href={`/squig/${item.tokenId}#passport`}>
              Transactions & holders →
            </Link>
          </nav>
          <div className="actions">
            <Link className="button primary" href={`/squig/${item.tokenId}`}>
              View Passport →
            </Link>
            <button
              className="button"
              type="button"
              disabled={downloading || busy}
              onClick={() => void downloadFront()}
            >
              {downloading ? 'Preparing front PNG…' : 'Download front PNG'}
            </button>
            <Link
              className="button"
              href={`/share?kind=passport&entity=${item.tokenId}&format=trading-card#interactive-card`}
            >
              Holographic viewer & exports
            </Link>
          </div>
          <p className="muted">
            Front-facing PNG · 1500 × 2100 · current holder or admin only.
          </p>
          {downloadMessage && (
            <p className="muted" role="status" aria-live="polite">
              {downloadMessage}
            </p>
          )}
          {collectorCard && <CollectorCardLink tokenId={item.tokenId} />}
          <button
            className="button"
            aria-pressed={motion}
            onClick={() => {
              reset();
              setMotion((v) => !v);
            }}
          >
            Card motion {motion ? 'on' : 'off'}
          </button>
        </aside>
      </div>
    </dialog>
  );
}
