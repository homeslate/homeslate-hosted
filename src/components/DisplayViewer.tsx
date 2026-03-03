import { useEffect, useRef, useState, useCallback } from 'react';
import { PinInput, Stack, Text, Button } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
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
  const [passcodeRequired, setPasscodeRequired] = useState(false);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Swipe to change views
  const swipeStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const visibleCount = config?.layouts.filter((l) => !l.hidden).length ?? 0;
    if (!config || visibleCount <= 1) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const visibleLayouts = config?.layouts.filter((l) => !l.hidden) ?? [];
    if (!config || visibleLayouts.length <= 1) return;
    const dx = e.clientX - swipeStart.current.x;
    const dy = e.clientY - swipeStart.current.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigate(dx < 0 ? 'next' : 'prev');
      // Reset rotation timer
      if (rotationRef.current) clearInterval(rotationRef.current);
      if (config.rotationEnabled && visibleLayouts.length > 1) {
        rotationRef.current = setInterval(() => navigate('next'), config.rotationIntervalMs);
      }
    }
  };

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
  return <Dashboard layoutId={activeLayoutId ?? undefined} isEditing={false} externalLayouts={layouts} />;
}
