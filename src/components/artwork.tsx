'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { canonicalArtworkToken, artworkUrl } from '@/domain/artwork-delivery';
import { resolveAsset } from '@/domain/assets';
export function Artwork({
  src: source,
  alt,
  priority = false,
  avatar = false,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  avatar?: boolean;
}) {
  const src = resolveAsset(source);
  const token = canonicalArtworkToken(src);
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [retried, setRetried] = useState<string | null>(null);
  useEffect(() => {
    if (!src || !token || failed !== src || retried === src) return;
    const timer = setTimeout(() => {
      setRetried(src);
      setFailed(null);
      setLoaded(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [src, token, failed, retried]);
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
            key={src + (retried === src ? ':retry' : '')}
            src={src}
            loader={
              token
                ? ({ width }) =>
                    artworkUrl(token, width) +
                    (retried === src ? '?retry=1' : '')
                : undefined
            }
            alt={alt}
            fill
            sizes={
              avatar
                ? '96px'
                : '(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 30vw'
            }
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            unoptimized={
              !token && !src.startsWith('https://gateway.pinata.cloud/ipfs/')
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
