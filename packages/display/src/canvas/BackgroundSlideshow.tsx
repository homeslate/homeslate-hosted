import { useEffect, useMemo, useRef, useState, useCallback, type JSX } from 'react';
import { loadStoredImage } from '@homeslate/widgets';
import type { View } from '@homeslate/schema';
import type { Photo } from '@homeslate/widgets';

interface BackgroundSlideshowProps {
  view: View;
}

function asPhotos(value: unknown[] | undefined): Photo[] {
  if (!value) return [];
  return value.filter((photo): photo is Photo => {
    if (typeof photo !== 'object' || photo === null || !('type' in photo)) return false;
    const typed = photo as { type?: unknown; url?: unknown; key?: unknown };
    if (typed.type === 'url') return typeof typed.url === 'string';
    if (typed.type === 'stored') return typeof typed.key === 'string';
    return false;
  });
}

/**
 * Renders the background for a view.
 *
 * - If `background.photos` has entries, cycles through them as a fade slideshow.
 * - Otherwise falls back to the legacy `background.image` string (static).
 * - Always layers the overlay darkness on top.
 *
 * Positioned absolute, inset 0, z-index 0 — sits behind all widgets.
 */
export function BackgroundSlideshow({ view }: BackgroundSlideshowProps): JSX.Element | null {
  const background = view.background ?? {};
  const image = background.image;
  const imageSize = background.imageSize ?? 'cover';
  const overlayOpacity = background.overlayOpacity ?? 0.5;
  const photos = useMemo(() => asPhotos(background.photos), [background.photos]);
  const intervalSeconds = background.intervalSeconds ?? 10;

  const hasPhotos = photos.length > 0;

  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string>>(new Map());
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!hasPhotos) return;
    let cancelled = false;

    const resolve = async () => {
      const map = new Map<string, string>();
      await Promise.all(
        photos.map(async (photo) => {
          if (photo.type === 'url') {
            map.set(photo.url, photo.url);
          } else {
            const cached = blobUrlsRef.current.get(photo.key);
            if (cached) {
              map.set(photo.key, cached);
              return;
            }
            try {
              const blobUrl = await loadStoredImage(photo.key);
              if (!cancelled) blobUrlsRef.current.set(photo.key, blobUrl);
              map.set(photo.key, blobUrl);
            } catch {
              // skip failed loads
            }
          }
        })
      );
      if (!cancelled) setResolvedUrls(map);
    };

    void resolve();
    return () => { cancelled = true; };
  }, [photos, hasPhotos]);

  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.clear();
    };
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
  }, [photos.length]);

  const advance = useCallback(() => {
    if (photos.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
      setIsTransitioning(false);
    }, 600);
  }, [photos]);

  useEffect(() => {
    if (!hasPhotos || photos.length <= 1) return;
    const timer = setInterval(advance, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [hasPhotos, photos.length, intervalSeconds, advance]);

  const sizeValue = imageSize === 'tile' ? 'auto' : imageSize;
  const repeatValue = imageSize === 'tile' ? 'repeat' : 'no-repeat';

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `rgba(0,0,0,${overlayOpacity})`,
    pointerEvents: 'none',
  };

  const baseLayerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundSize: sizeValue,
    backgroundRepeat: repeatValue,
    backgroundPosition: 'center',
    transition: 'opacity 0.6s ease',
  };

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
  };

  const fillStyle = (src: string | undefined, opacity: number): React.CSSProperties => ({
    ...baseLayerStyle,
    background: src ? `url(${src}) center / ${sizeValue} ${repeatValue}` : 'none',
    opacity,
  });

  if (hasPhotos) {
    const currentPhoto = photos[currentIndex];
    const src = currentPhoto
      ? currentPhoto.type === 'url'
        ? resolvedUrls.get(currentPhoto.url)
        : resolvedUrls.get(currentPhoto.key)
      : undefined;

    return (
      <div style={wrapperStyle}>
        <div style={fillStyle(src, isTransitioning ? 0 : 1)} />
        <div style={overlayStyle} />
      </div>
    );
  }

  if (!image) return null;

  return (
    <div style={wrapperStyle}>
      <div style={fillStyle(image, 1)} />
      <div style={overlayStyle} />
    </div>
  );
}
