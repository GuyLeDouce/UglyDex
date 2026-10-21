'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { canonicalArtworkToken, artworkUrl } from '@/domain/artwork-delivery';
import { resolveAsset, SQUIG_ART_CID } from '@/domain/assets';
export function Artwork({
  src: source,
  alt,
  priority = false,
  avatar = false,
  sizes,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  avatar?: boolean;
  sizes?: string;
}) {
  const src = resolveAsset(source);
  const token = canonicalArtworkToken(src);
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [recovery, setRecovery] = useState({ src: '', attempt: 0 });
  const attempt = recovery.src === src ? recovery.attempt : 0;
  const direct = !!token && attempt >= 2;
  const imageSrc =
    token && attempt >= 3
      ? `https://ipfs.io/ipfs/${SQUIG_ART_CID}/${token}`
      : src;
  useEffect(() => {
    if (!src || !token || failed !== src || attempt >= 3) return;
    const timer = setTimeout(
      () => {
        setRecovery({ src, attempt: attempt + 1 });
        setFailed(null);
        setLoaded(null);
      },
      1000 * (attempt + 1),
    );
    return () => clearTimeout(timer);
  }, [src, token, failed, attempt]);
  return (
    <div className={avatar ? 'avatar-image' : 'artwork'}>
      {src && failed !== src ? (
        <>
          {loaded !== src && (
            <span className="art-loading" aria-hidden>
              Loading artwork…
            </span>
          )}
          <Image
            key={`${src}:${attempt}`}
            src={imageSrc!}
            loader={
              token && !direct
                ? ({ width }) =>
                    artworkUrl(token, width) + (attempt ? '?retry=1' : '')
                : undefined
            }
            alt={alt}
            fill
            sizes={
              sizes ??
              (avatar
                ? '96px'
                : '(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 30vw')
            }
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            unoptimized={
              direct ||
              (!token && !src.startsWith('https://gateway.pinata.cloud/ipfs/'))
            }
            onLoad={() => setLoaded(src)}
            onError={() => setFailed(src)}
          />
        </>
      ) : (
        <div className="art-fallback">
          <span aria-hidden>✳</span>
          <small>{avatar ? 'Collector' : 'Artwork unavailable'}</small>
        </div>
      )}
    </div>
  );
}
