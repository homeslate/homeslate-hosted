import { useEffect, useRef, useState, useCallback } from 'react';
import { PinInput, Stack, Text, Button } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useWakeLock } from '../hooks/useWakeLock';
import type { DashboardLayout } from '../types/widget';
import type { DisplayTheme } from '../types/theme';
import { themeToVars } from '../themes/utils';
import { Dashboard } from './Dashboard';
import classes from './DisplayViewer.module.css';

// Minimum horizontal distance (px) to register as a swipe.
const SWIPE_THRESHOLD = 60;
// Once the angle exceeds this ratio (dx/dy), we lock the gesture as horizontal.
const SWIPE_ANGLE_RATIO = 1.2;

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
  const [passcodeRequired, setPasscodeRequired] = useState(false);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useWakeLock();

  // Load and poll config
  useEffect(() => {
    const load = () => {
      const url = passcode
        ? `/api/display?id=${displayId}&passcode=${passcode}`
        : `/api/display?id=${displayId}`;

      fetch(url)
        .then((r) => r.json())
        .then((data: { config?: DisplayConfig | null; passcodeRequired?: boolean }) => {
          if (data.passcodeRequired) {
            setPasscodeRequired(true);
            setConfig(null);
            return;
          }
          setPasscodeRequired(false);
          const cfg = data.config ?? null;
          if (cfg) {
            setConfig(cfg);
            const visibleLayouts = cfg.layouts.filter((l) => !l.hidden);
            setActiveLayoutId((prev) => {
              if (prev && visibleLayouts.find((l) => l.id === prev)) return prev;
              const preferredId = cfg.activeLayoutId;
              if (preferredId && visibleLayouts.find((l) => l.id === preferredId)) return preferredId;
              return visibleLayouts[0]?.id ?? cfg.layouts[0]?.id ?? null;
            });
          }
        })
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [displayId, passcode]);

  // Auto-rotation
  const navigate = useCallback((direction: 'next' | 'prev') => {
    if (!config) return;
    const visibleLayouts = config.layouts.filter((l) => !l.hidden);
    if (visibleLayouts.length <= 1) return;
    setActiveLayoutId((curr) => {
      const idx = visibleLayouts.findIndex((l) => l.id === curr);
      const currentIdx = idx === -1 ? 0 : idx;
      const next =
        direction === 'next'
          ? (currentIdx + 1) % visibleLayouts.length
          : (currentIdx - 1 + visibleLayouts.length) % visibleLayouts.length;
      return visibleLayouts[next].id;
    });
  }, [config]);

  useEffect(() => {
    if (rotationRef.current) clearInterval(rotationRef.current);
    const visibleCount = config?.layouts.filter((l) => !l.hidden).length ?? 0;
    if (config?.rotationEnabled && visibleCount > 1) {
      rotationRef.current = setInterval(() => navigate('next'), config.rotationIntervalMs);
    }
    return () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
    };
  }, [config, navigate]);

  // Reset the rotation timer (called after a manual swipe).
  const resetRotation = useCallback(() => {
    if (rotationRef.current) clearInterval(rotationRef.current);
    const visibleLayouts = config?.layouts.filter((l) => !l.hidden) ?? [];
    if (config?.rotationEnabled && visibleLayouts.length > 1) {
      rotationRef.current = setInterval(() => navigate('next'), config.rotationIntervalMs);
    }
  }, [config, navigate]);

  // Swipe to change views — uses native Touch Events with passive:false so we
  // can call preventDefault() once a horizontal gesture is confirmed, preventing
  // the browser from stealing it as a scroll or back-navigation gesture.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    // null = undecided, 'h' = horizontal lock, 'v' = vertical (pass through)
    let direction: 'h' | 'v' | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const visibleCount = config?.layouts.filter((l) => !l.hidden).length ?? 0;
      if (!config || visibleCount <= 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      direction = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!config) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (direction === null) {
        // Determine gesture axis once movement is unambiguous
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          direction = Math.abs(dx) > Math.abs(dy) * SWIPE_ANGLE_RATIO ? 'h' : 'v';
        }
      }

      // Block browser scroll/swipe-back only for horizontal gestures
      if (direction === 'h') {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!config || direction !== 'h') return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * SWIPE_ANGLE_RATIO) {
        navigate(dx < 0 ? 'next' : 'prev');
        resetRotation();
      }
      direction = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [config, navigate, resetRotation]);

  // Show PIN entry screen if passcode is required and not yet verified
  if (passcodeRequired) {
    const handleSubmit = () => {
      if (pinInput.length === 4) {
        setPinError(false);
        setPasscode(pinInput);
        setPinInput('');
      }
    };

    // If we just submitted a passcode and got back passcodeRequired, show error
    const showError = pinError || (passcode !== null && passcodeRequired);

    return (
      <div className={classes.pinScreen}>
        <Stack align="center" gap="lg">
          <IconLock size={40} opacity={0.7} />
          <Text size="xl" fw={600}>Enter Display PIN</Text>
          <PinInput
            length={4}
            type="number"
            value={pinInput}
            onChange={(val) => {
              setPinInput(val);
              setPinError(false);
            }}
            onComplete={(val) => {
              setPinError(false);
              setPasscode(val);
              setPinInput('');
            }}
            error={showError}
            placeholder="·"
            size="xl"
            autoFocus
          />
          {showError && (
            <Text size="sm" c="red">Incorrect PIN. Please try again.</Text>
          )}
          <Button onClick={handleSubmit} disabled={pinInput.length !== 4}>
            Unlock
          </Button>
        </Stack>
      </div>
    );
  }

  // View indicator dots — only show visible layouts
  const allLayouts = config?.layouts ?? [];
  const layouts = allLayouts.filter((l) => !l.hidden);
  const showDots = layouts.length > 1;

  const themeVars = config?.theme ? themeToVars(config.theme) : {};

  return (
    <div
      ref={rootRef}
      className={classes.root}
      style={themeVars as React.CSSProperties}
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
  return <Dashboard layoutId={activeLayoutId ?? undefined} isEditing={false} externalLayouts={layouts} />;
}
