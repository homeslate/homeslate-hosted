import { useState, useMemo } from 'react';
import {
  Box,
  Text,
  Group,
  Loader,
  ActionIcon,
  ScrollArea,
  Stack,
  Paper,
  Badge,
  MultiSelect,
  Button,
  NumberInput,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import {
  IconBrandGoogle,
  IconCalendarEvent,
  IconRefresh,
  IconMapPin,
} from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useAuth } from '../contexts/AuthContext';
import type { ParsedCalendarEvent } from '../services/googleCalendar';
import classes from './GoogleCalendarMonthWidget.module.css';
import dayjs from 'dayjs';

export interface GoogleCalendarMonthConfig extends WidgetConfig {
  selectedCalendarIds: string[];
  daysAhead: number;
  transparentBackground: boolean;
}

function formatTimeRange(event: ParsedCalendarEvent): string {
  if (event.allDay) return 'All day';
  const start = dayjs(event.start);
  const end = dayjs(event.end);
  if (start.format('A') === end.format('A')) {
    return `${start.format('h:mm')} – ${end.format('h:mm A')}`;
  }
  return `${start.format('h:mm A')} – ${end.format('h:mm A')}`;
}

// ── Main widget ──

export function GoogleCalendarMonthWidget({ widget }: WidgetProps<GoogleCalendarMonthConfig>) {
  const { selectedCalendarIds, daysAhead, transparentBackground } = widget.config;
  const { isAuthenticated } = useAuth();
  const { isLoading, events, refresh } = useGoogleCalendar({ selectedCalendarIds, daysAhead });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ParsedCalendarEvent[]>();
    for (const event of events) {
      const key = dayjs(event.start).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const selectedDateStr = dayjs(selectedDate).format('YYYY-MM-DD');
  const selectedDateEvents = eventsByDate.get(selectedDateStr) ?? [];

  const selectedLabel = (() => {
    const diff = dayjs(selectedDate).diff(dayjs().startOf('day'), 'day');
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return dayjs(selectedDate).format('ddd, MMM D');
  })();

  if (!isAuthenticated) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconBrandGoogle size={40} opacity={0.3} />
          <Text size="sm" c="dimmed" ta="center">
            Sign in using the header to view your calendar
          </Text>
        </div>
      </Box>
    );
  }

  if (selectedCalendarIds.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconCalendarEvent size={40} opacity={0.3} />
          <Text size="sm" c="dimmed" ta="center">
            Select calendars in widget settings
          </Text>
        </div>
      </Box>
    );
  }

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      <div className={classes.header}>
        <span className={classes.title}>
          <IconCalendarEvent size={12} />
          Calendar
        </span>
        <Group gap={4}>
          {isLoading && <Loader size="xs" color="blue" />}
          <ActionIcon variant="subtle" size="xs" onClick={refresh} className={classes.refreshBtn}>
            <IconRefresh size={13} />
          </ActionIcon>
        </Group>
      </div>

      <div className={classes.calendarWrap}>
        <DatePicker
          value={selectedDate}
          onChange={(d) => d && setSelectedDate(new Date(d))}
          renderDay={(date) => {
            const key = dayjs(date).format('YYYY-MM-DD');
            const dayEvents = eventsByDate.get(key) ?? [];
            const colors = [...new Set(dayEvents.map((e) => e.color))].slice(0, 3);
            return (
              <div className={classes.dayCell}>
                <span>{dayjs(date).date()}</span>
                {colors.length > 0 && (
                  <div className={classes.eventDots}>
                    {colors.map((color, i) => (
                      <div
                        key={i}
                        className={classes.eventDot}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
          classNames={{ calendarHeader: classes.calendarHeader }}
        />
      </div>

      <div className={classes.dayPanel}>
        <div className={classes.dayPanelHeader}>
          <span className={classes.dayPanelTitle}>{selectedLabel}</span>
          {selectedDateEvents.length > 0 && (
            <span className={classes.eventCount}>{selectedDateEvents.length}</span>
          )}
        </div>
        {selectedDateEvents.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="sm">
            No events
          </Text>
        ) : (
          <ScrollArea className={classes.dayEventsList} scrollbarSize={4}>
            {selectedDateEvents.map((event) => (
              <div key={event.id} className={classes.eventCard}>
                <div
                  className={classes.eventIndicator}
                  style={{ backgroundColor: event.color }}
                />
                <div className={classes.eventBody}>
                  <div className={classes.eventTitle}>{event.title}</div>
                  <div className={classes.eventTime}>{formatTimeRange(event)}</div>
                  {event.location && (
                    <div className={classes.eventLocation}>
                      <IconMapPin size={9} />
                      {event.location}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </div>
    </Box>
  );
}

// ── Settings ──

export function GoogleCalendarMonthWidgetSettings({
  widget,
  onConfigChange,
}: WidgetProps<GoogleCalendarMonthConfig>) {
  const { selectedCalendarIds, daysAhead } = widget.config;
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const { calendars } = useGoogleCalendar({ selectedCalendarIds, daysAhead });

  const calendarOptions = calendars.map((cal) => ({
    value: cal.id,
    label: cal.summary + (cal.primary ? ' (Primary)' : ''),
  }));

  return (
    <Stack gap="md">
      <Paper p="sm" className={classes.authSection}>
        {isAuthenticated ? (
          <>
            <Badge color="green" variant="light" mb="sm">
              Connected to Google
            </Badge>
            <MultiSelect
              label="Select Calendars"
              placeholder="Choose calendars to display..."
              data={calendarOptions}
              value={selectedCalendarIds}
              onChange={(value) => onConfigChange({ selectedCalendarIds: value })}
              searchable
            />
          </>
        ) : (
          <Stack align="center" gap="sm">
            <Text size="sm" c="dimmed">
              Sign in to select your calendars
            </Text>
            <Button
              leftSection={<IconBrandGoogle size={16} />}
              onClick={signIn}
              loading={authLoading}
              size="sm"
            >
              Sign in with Google
            </Button>
          </Stack>
        )}
      </Paper>

      <NumberInput
        label="Days Ahead"
        description="How many days ahead to fetch events"
        min={1}
        max={90}
        value={daysAhead}
        onChange={(value) => onConfigChange({ daysAhead: Number(value) || 30 })}
      />
    </Stack>
  );
}
