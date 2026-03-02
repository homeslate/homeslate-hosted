import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Stack, Switch, Select, Group } from '@mantine/core';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import classes from './ClockWidget.module.css';

export interface ClockConfig extends WidgetConfig {
  showSeconds: boolean;
  showDate: boolean;
  use24Hour: boolean;
  timezone: string;
  transparentBackground: boolean;
}

export function ClockWidget({ widget }: WidgetProps<ClockConfig>) {
  const [time, setTime] = useState(new Date());
  const [fontSize, setFontSize] = useState(24);
  const [dateSize, setDateSize] = useState(12);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showSeconds, showDate, use24Hour, timezone, transparentBackground } = widget.config;

  const updateSizes = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const base = Math.min(width, height);
    setFontSize(Math.max(14, Math.min(160, base * 0.14)));
    setDateSize(Math.max(9, Math.min(48, base * 0.045)));
  }, []);

  useEffect(() => {
    updateSizes();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateSizes);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateSizes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = () => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24Hour,
      ...(timezone !== 'local' && { timeZone: timezone }),
    };
    
    if (showSeconds) {
      options.second = '2-digit';
    }
    
    return time.toLocaleTimeString(undefined, options);
  };

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      ...(timezone !== 'local' && { timeZone: timezone }),
    };
    return time.toLocaleDateString(undefined, options);
  };

  return (
    <Box
      ref={containerRef}
      className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}
    >
      <Stack gap={0} align="center" justify="center" h="100%">
        <Text className={classes.time} style={{ fontSize: `${fontSize}px` }}>
          {formatTime()}
        </Text>
        {showDate && (
          <Text className={classes.date} style={{ fontSize: `${dateSize}px` }}>
            {formatDate()}
          </Text>
        )}
      </Stack>
    </Box>
  );
}

export function ClockWidgetSettings({ widget, onConfigChange }: WidgetProps<ClockConfig>) {
  const { showSeconds, showDate, use24Hour, timezone } = widget.config;

  const timezones = [
    { value: 'local', label: 'Local Time' },
    { value: 'America/New_York', label: 'Eastern Time' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm">Show Seconds</Text>
        <Switch
          checked={showSeconds}
          onChange={(e) => onConfigChange({ showSeconds: e.currentTarget.checked })}
        />
      </Group>
      <Group justify="space-between">
        <Text size="sm">Show Date</Text>
        <Switch
          checked={showDate}
          onChange={(e) => onConfigChange({ showDate: e.currentTarget.checked })}
        />
      </Group>
      <Group justify="space-between">
        <Text size="sm">24-Hour Format</Text>
        <Switch
          checked={use24Hour}
          onChange={(e) => onConfigChange({ use24Hour: e.currentTarget.checked })}
        />
      </Group>
      <Select
        label="Timezone"
        data={timezones}
        value={timezone}
        onChange={(value) => onConfigChange({ timezone: value || 'local' })}
      />
    </Stack>
  );
}

