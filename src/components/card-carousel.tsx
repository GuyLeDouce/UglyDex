'use client';

import {
  Children,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export function CardCarousel({ children }: { children: ReactNode }) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const cards = Children.toArray(children);

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const update = () =>
      setEdges({
        start: node.scrollLeft <= 4,
        end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4,
      });
    update();
    node.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  function move(direction: number) {
    const node = track.current;
    const slide = node?.firstElementChild;
    if (!node || !slide) return;
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    node.scrollBy({
      left: direction * (slide.getBoundingClientRect().width + gap),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }

  if (!cards.length) return null;
  return (
    <section
      className="field-hero-art"
      aria-label="Squig collector cards"
      aria-roledescription="carousel"
    >
      <div
        id={id}
        ref={track}
        className="hero-card-track"
        tabIndex={0}
        aria-label="Swipe or use the arrow buttons to browse Squig cards"
      >
        {cards.map((card, index) => (
          <div
            className="hero-card-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${cards.length}`}
            key={index}
          >
            {card}
          </div>
        ))}
      </div>
      <div className="hero-card-controls">
        <span>Every card opens a story.</span>
        <div className="actions">
          <button
            className="button"
            type="button"
            aria-label="Previous Squig card"
            aria-controls={id}
            disabled={edges.start}
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            className="button"
            type="button"
            aria-label="Next Squig card"
            aria-controls={id}
            disabled={edges.end}
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
