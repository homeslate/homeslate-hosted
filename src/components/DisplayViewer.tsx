import { useEffect, useRef, useState, useCallback } from 'react';
import { useWakeLock } from '../hooks/useWakeLock';
import type { DashboardLayout } from '../types/widget';
import type { DisplayTheme } from '../types/theme';
import { themeToVars } from '../themes/utils';
import { Dashboard } from './Dashboard';
import classes from './DisplayViewer.module.css';

interface DisplayConfig {
  layouts: DashboardLayout[];
  activeLayoutId: string | null;
  rotationEnabled: boolean;
  rotationIntervalMs: number;
  theme?: DisplayTheme;
}

interface Props {
  displayId: string;
}

const POLL_INTERVAL_MS = 30_000;

export function DisplayViewer({ displayId }: Props) {
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useWakeLock();

  // Load and poll config
  useEffect(() => {
    const load = () => {
      fetch(`/api/display?id=${displayId}`)
        .then((r) => r.json())
        .then(({ config: cfg }: { config: DisplayConfig | null }) => {
          if (cfg) {
            setConfig(cfg);
            setActiveLayoutId((prev) => {
              // Don't reset current view if we already have one from this config
              if (prev && cfg.layouts.find((l) => l.id === prev)) return prev;
              return cfg.activeLayoutId ?? cfg.layouts[0]?.id ?? null;
            });
          }
        })
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [displayId]);

  // Auto-rotation
  const navigate = useCallback((direction: 'next' | 'prev') => {
    if (!config || config.layouts.length <= 1) return;
    setActiveLayoutId((curr) => {
      const idx = config.layouts.findIndex((l) => l.id === curr);
      if (idx === -1) return curr;
      const next =
        direction === 'next'
          ? (idx + 1) % config.layouts.length
          : (idx - 1 + config.layouts.length) % config.layouts.length;
      return config.layouts[next].id;
    });
  }, [config]);

  useEffect(() => {
    if (rotationRef.current) clearInterval(rotationRef.current);
    if (config?.rotationEnabled && config.layouts.length > 1) {
      rotationRef.current = setInterval(() => navigate('next'), config.rotationIntervalMs);
    }
    return () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
    };
  }, [config, navigate]);

  // Swipe to change views
  const swipeStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!config || config.layouts.length <= 1) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!config || config.layouts.length <= 1) return;
    const dx = e.clientX - swipeStart.current.x;
    const dy = e.clientY - swipeStart.current.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigate(dx < 0 ? 'next' : 'prev');
      // Reset rotation timer
      if (rotationRef.current) clearInterval(rotationRef.current);
      if (config.rotationEnabled && config.layouts.length > 1) {
        rotationRef.current = setInterval(() => navigate('next'), config.rotationIntervalMs);
      }
    }
  };

  // View indicator dots
  const layouts = config?.layouts ?? [];
  const showDots = layouts.length > 1;

  const themeVars = config?.theme ? themeToVars(config.theme) : {};

  return (
    <div
      className={classes.root}
      style={themeVars as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Render the dashboard read-only using local state, not the store */}
      {config && (
        <ViewerDashboard
          layouts={config.layouts}
          activeLayoutId={activeLayoutId}
        />
      )}
      {showDots && (
        <div className={classes.dots}>
          {layouts.map((l) => (
            <button
              key={l.id}
              className={`${classes.dot} ${l.id === activeLayoutId ? classes.dotActive : ''}`}
              onClick={() => setActiveLayoutId(l.id)}
              aria-label={`Switch to ${l.name}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Internal read-only dashboard that renders a layout without using the store
function ViewerDashboard({
  layouts,
  activeLayoutId,
}: {
  layouts: DashboardLayout[];
  activeLayoutId: string | null;
}) {
  // We use the Dashboard component passing the layoutId override;
  // since DisplayViewer doesn't use the store, we need to render from local state.
  // We'll set the store's selectedViewId temporarily or just render widgets directly.
  // Simplest approach: pass layoutId prop to Dashboard which now supports it.
  return <Dashboard layoutId={activeLayoutId ?? undefined} isEditing={false} externalLayouts={layouts} />;
}
