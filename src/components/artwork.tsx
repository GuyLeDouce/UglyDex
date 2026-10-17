'use client';
import Image from 'next/image';
import { useState } from 'react';
export function Artwork({
  src,
  alt,
  priority = false,
  avatar = false,
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  avatar?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
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
            src={src}
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
            unoptimized={!src.startsWith('https://gateway.pinata.cloud/ipfs/')}
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
