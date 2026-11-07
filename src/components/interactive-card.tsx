'use client';
import { useEffect, useRef, useState } from 'react';
import {
  cardFinishes,
  clampPose,
  loopPose,
  type CardFinish,
  type CardPose,
} from '@/domain/card-finish';
import {
  animatedCard,
  canvas,
  saveFile,
  staticCard,
} from '@/client/card-export';
import { paintCard, paintScene } from '@/client/card-material';

export function InteractiveCard({
  image,
  finish,
  filename,
  description,
}: {
  image: string;
  finish: CardFinish;
  filename: string;
  description: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    surface = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLImageElement | null>(null),
    pose = useRef<CardPose>({ x: 0, y: 0 });
  const interacted = useRef(false);
  const active = useRef(false),
    exporting = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(
      () =>
        typeof window !== 'undefined' &&
        window.location.hash === '#interactive-card',
    ),
    [motion, setMotion] = useState(false),
    [ready, setReady] = useState(false);
  const [message, setMessage] = useState(''),
    [progress, setProgress] = useState<number | null>(null),
    [video, setVideo] = useState<{ file: File; url: string } | null>(null);
  const isExporting = progress !== null;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    return () => {
      exporting.current?.abort();
    };
  }, []);
  useEffect(() => {
    return () => {
      if (video) URL.revokeObjectURL(video.url);
    };
  }, [video]);
  useEffect(() => {
    if (!open) return;
    const img = new Image();
    let disposed = false;
    img.onload = () => {
      if (!disposed) {
        base.current = img;
        setReady(true);
      }
    };
    img.onerror = () => {
      if (!disposed) setMessage('The card could not load. Close and retry.');
    };
    img.src = image;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      disposed = true;
      document.body.style.overflow = previous;
    };
  }, [open, image]);
  useEffect(() => {
    if (!open || !ready || !surface.current || !base.current) return;
    const target = surface.current.getContext('2d');
    if (!target) return;
    const face = canvas(750, 1050);
    let raf = 0,
      last = 0;
    let current = { x: 0, y: 0 };
    const start = performance.now();
    function draw(now: number) {
      if (!target || !base.current) return;
      if (!document.hidden && now - last >= 1000 / 30) {
        const goal =
          !motion || isExporting
            ? { x: 0, y: 0 }
            : active.current
              ? pose.current
              : interacted.current
                ? { x: 0, y: 0 }
                : loopPose((now - start) / 10000);
        current = {
          x: current.x + (goal.x - current.x) * 0.13,
          y: current.y + (goal.y - current.y) * 0.13,
        };
        paintCard(face.ctx, base.current, finish, current);
        paintScene(target, face.element, current);
        last = now;
      }
      if (motion && !isExporting) raf = requestAnimationFrame(draw);
    }
    draw(performance.now());
    return () => {
      cancelAnimationFrame(raf);
      face.element.width = 1;
    };
  }, [open, ready, motion, finish, isExporting]);
  function close() {
    exporting.current?.abort();
    dialog.current?.close();
    setOpen(false);
    setReady(false);
    active.current = false;
  }
  async function exportCard(animated: boolean) {
    if (!base.current || exporting.current) return;
    const controller = new AbortController();
    exporting.current = controller;
    setProgress(0);
    setMessage(
      animated
        ? 'Rendering six seconds of motion. Keep this tab visible…'
        : 'Preparing high-resolution PNG…',
    );
    try {
      const file = animated
        ? await animatedCard(
            base.current,
            finish,
            filename,
            controller.signal,
            setProgress,
          )
        : await staticCard(base.current, finish, filename);
      if (controller.signal.aborted) return;
      if (animated) {
        setVideo({ file, url: URL.createObjectURL(file) });
        setMessage('Video verified. Preview it below, then download or share.');
      } else {
        saveFile(file);
        setMessage('PNG ready.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Export failed. Please retry.',
      );
    } finally {
      exporting.current = null;
      setProgress(null);
    }
  }
  return (
    <>
      <button
        className="button"
        type="button"
        onClick={() => {
          setMessage('');
          setOpen(true);
        }}
      >
        View Interactive Card
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="card-viewer"
          aria-labelledby="card-viewer-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <header className="card-viewer-header">
            <div>
              <p className="eyebrow">SQUIGS RELOADED</p>
              <h2 id="card-viewer-title">
                {cardFinishes[finish.rarity].label}
                {finish.og ? ' · OG' : ''}
              </h2>
            </div>
            <button className="button" type="button" onClick={close} autoFocus>
              Close ×
            </button>
          </header>
          <div className="card-viewer-body">
            <canvas
              ref={surface}
              width={900}
              height={1260}
              className="interactive-card-canvas"
              role="img"
              aria-label={description}
              tabIndex={0}
              onPointerDown={(event) => {
                if (!motion) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                active.current = true;
                interacted.current = true;
              }}
              onPointerMove={(event) => {
                if (
                  !motion ||
                  (event.pointerType !== 'mouse' &&
                    !event.currentTarget.hasPointerCapture(event.pointerId))
                )
                  return;
                const r = event.currentTarget.getBoundingClientRect();
                pose.current = {
                  x: clampPose(((event.clientX - r.left) / r.width) * 2 - 1),
                  y: clampPose(((event.clientY - r.top) / r.height) * 2 - 1),
                };
                active.current = true;
                interacted.current = true;
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                active.current = false;
              }}
              onPointerCancel={() => {
                active.current = false;
              }}
              onPointerLeave={() => {
                active.current = false;
              }}
              onKeyDown={(event) => {
                if (
                  !motion ||
                  !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                active.current = true;
                interacted.current = true;
                pose.current = {
                  x: clampPose(
                    pose.current.x +
                      (event.key === 'ArrowLeft'
                        ? -0.2
                        : event.key === 'ArrowRight'
                          ? 0.2
                          : 0),
                  ),
                  y: clampPose(
                    pose.current.y +
                      (event.key === 'ArrowUp'
                        ? -0.2
                        : event.key === 'ArrowDown'
                          ? 0.2
                          : 0),
                  ),
                };
              }}
            />
            <aside className="card-viewer-tools">
              <p className="sr-only">{description}</p>
              <p>
                {motion
                  ? 'Move your pointer, drag the card, or use arrow keys to catch the light.'
                  : 'Motion is off. The printed card stays still.'}
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="button"
                  aria-pressed={motion}
                  onClick={() => setMotion((value) => !value)}
                >
                  Motion {motion ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    pose.current = { x: 0, y: 0 };
                    active.current = false;
                    setMotion(false);
                  }}
                >
                  Reset angle
                </button>
              </div>
              <button
                type="button"
                className="button primary"
                disabled={!ready || progress !== null}
                onClick={() => exportCard(false)}
              >
                Download finished PNG
              </button>
              <button
                type="button"
                className="button primary"
                disabled={!ready || progress !== null}
                onClick={() => exportCard(true)}
              >
                Download Animated Card
              </button>
              <small>
                PNG · 1500 × 2100. Video · 6 seconds, 900 × 1260. MP4 where
                supported; otherwise WebM. No camera or microphone access.
              </small>
              {progress !== null && (
                <>
                  <progress
                    max={100}
                    value={progress}
                    aria-label="Card export progress"
                  />
                  <button
                    type="button"
                    className="button"
                    onClick={() => exporting.current?.abort()}
                  >
                    Cancel export
                  </button>
                </>
              )}
              <p role="status">{message}</p>
              {video && (
                <div className="card-video-result">
                  <video
                    controls
                    playsInline
                    loop
                    src={video.url}
                    aria-label="Generated animated collector card"
                  />
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => saveFile(video.file)}
                  >
                    Save {video.file.type === 'video/mp4' ? 'MP4' : 'WebM'}
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={async () => {
                      try {
                        if (navigator.canShare?.({ files: [video.file] }))
                          await navigator.share({
                            files: [video.file],
                            title: 'Squigs Reloaded',
                          });
                        else
                          setMessage(
                            'File sharing is unavailable here. Save the video and attach it in your chosen app.',
                          );
                      } catch {
                        setMessage(
                          'Sharing cancelled or unavailable. The video is still ready to save.',
                        );
                      }
                    }}
                  >
                    Share video
                  </button>
                </div>
              )}
            </aside>
          </div>
        </dialog>
      )}
    </>
  );
}
