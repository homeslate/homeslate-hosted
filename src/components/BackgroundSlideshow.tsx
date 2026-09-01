import { useEffect, useRef, useState, useCallback } from 'react';
import { loadStoredImage } from '@homeslate/widgets';
import type { DashboardLayout } from '../types/widget';
import type { Photo } from '@homeslate/widgets';

interface BackgroundSlideshowProps {
  layout: DashboardLayout;
}

/**
 * Renders the background for a view layout.
 *
 * - If `backgroundPhotos` has entries, cycles through them as a fade slideshow.
 * - Otherwise falls back to the legacy `backgroundImage` string (static).
 * - Always layers the overlay darkness on top.
 *
 * Positioned absolute, inset 0, z-index 0 — sits behind all widgets.
 */
export function BackgroundSlideshow({ layout }: BackgroundSlideshowProps) {
  const {
    backgroundPhotos,
    backgroundInterval = 10,
    backgroundImage,
    backgroundImageSize = 'cover',
    backgroundOverlayOpacity = 0.5,
  } = layout;

  const hasPhotos = backgroundPhotos && backgroundPhotos.length > 0;

  // ── Multi-photo slideshow ──────────────────────────────────────────────────

  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string>>(new Map());
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Resolve stored photos to displayable URLs
  useEffect(() => {
    if (!hasPhotos) return;
    let cancelled = false;

    const resolve = async () => {
      const map = new Map<string, string>();
      await Promise.all(
        (backgroundPhotos as Photo[]).map(async (photo) => {
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
  }, [backgroundPhotos, hasPhotos]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.clear();
    };
  }, []);

  // Reset index when photo list changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [backgroundPhotos?.length]);

  const advance = useCallback(() => {
    if (!backgroundPhotos || backgroundPhotos.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % (backgroundPhotos?.length ?? 1));
      setIsTransitioning(false);
    }, 600);
  }, [backgroundPhotos]);

  useEffect(() => {
    if (!hasPhotos || (backgroundPhotos?.length ?? 0) <= 1) return;
    const timer = setInterval(advance, backgroundInterval * 1000);
    return () => clearInterval(timer);
  }, [hasPhotos, backgroundPhotos?.length, backgroundInterval, advance]);

  // ── CSS helpers ────────────────────────────────────────────────────────────

  const sizeValue = backgroundImageSize === 'tile' ? 'auto' : backgroundImageSize;
  const repeatValue = backgroundImageSize === 'tile' ? 'repeat' : 'no-repeat';

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `rgba(0,0,0,${backgroundOverlayOpacity})`,
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

  // ── Render: multi-photo slideshow ──────────────────────────────────────────

  if (hasPhotos) {
    const photos = backgroundPhotos as Photo[];
    const currentPhoto = photos[currentIndex];
    const src = currentPhoto
      ? currentPhoto.type === 'url'
        ? resolvedUrls.get(currentPhoto.url)
        : resolvedUrls.get(currentPhoto.key)
      : undefined;

    return (
      <div style={wrapperStyle}>
        {/* Current photo layer */}
        <div
          style={{
            ...baseLayerStyle,
            backgroundImage: src ? `url(${src})` : 'none',
            opacity: isTransitioning ? 0 : 1,
          }}
        />
        {/* Overlay */}
        <div style={overlayStyle} />
      </div>
    );
  }

  // ── Render: single legacy backgroundImage ─────────────────────────────────

  if (!backgroundImage) return null;

  return (
    <div style={wrapperStyle}>
      <div
        style={{
          ...baseLayerStyle,
          backgroundImage: `url(${backgroundImage})`,
          opacity: 1,
        }}
      />
      <div style={overlayStyle} />
    </div>
  );
}
