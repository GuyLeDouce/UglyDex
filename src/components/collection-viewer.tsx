'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SquigCardData } from '@/server/collections';
import { TradingCardFace } from './trading-card-face';
import { CardDiscovery } from './card-discovery';
import { CollectorCardLink } from './collector-card-link';

export function CollectionViewer({
  item,
  position,
  total,
  onClose,
  onPrevious,
  onNext,
  busy,
  collectorCard,
}: {
  item: SquigCardData;
  position: number;
  total: number;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  busy: boolean;
  collectorCard: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setMotion(!media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => {
      document.body.style.overflow = previous;
      media.removeEventListener('change', sync);
      d?.close();
    };
  }, []);
  function reset() {
    surface.current?.style.setProperty('--tilt-x', '0deg');
    surface.current?.style.setProperty('--tilt-y', '0deg');
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
              '--tilt-x',
              `${((e.clientY - r.top) / r.height - 0.5) * -9}deg`,
            );
            e.currentTarget.style.setProperty(
              '--tilt-y',
              `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`,
            );
            e.currentTarget.style.setProperty(
              '--light-x',
              `${((e.clientX - r.left) / r.width) * 100}%`,
            );
          }}
        >
          <TradingCardFace item={item} priority heading={false} />
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
          <CardDiscovery item={item} />
          <div className="actions">
            <Link className="button primary" href={`/squig/${item.tokenId}`}>
              View Passport →
            </Link>
            <Link
              className="button"
              href={`/share?kind=passport&entity=${item.tokenId}&format=trading-card#interactive-card`}
            >
              Holographic viewer & exports
            </Link>
          </div>
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
