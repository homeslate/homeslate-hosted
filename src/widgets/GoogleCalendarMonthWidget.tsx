import { useState, useMemo, useCallback } from 'react';
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
  Modal,
  TextInput,
  Textarea,
  Select,
  Switch,
  Alert,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import {
  IconBrandGoogle,
  IconCalendarEvent,
  IconRefresh,
  IconMapPin,
  IconPlus,
  IconCheck,
} from '@tabler/icons-react';
import { GoogleCalendarEmptyState } from '../components/GoogleCalendarEmptyState';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useDisplayCalendar } from '../hooks/useDisplayCalendar';
import { useDisplayId, getDisplayIdFromWindow } from '../contexts/DisplayContext';
import { useAuth } from '../contexts/AuthContext';
import type { ParsedCalendarEvent, CalendarEventInput } from '../services/googleCalendar';
import classes from './GoogleCalendarMonthWidget.module.css';
import dayjs from 'dayjs';

export interface GoogleCalendarMonthConfig extends WidgetConfig {
  selectedCalendarIds: string[];
  daysAhead: number;
  transparentBackground: boolean;
}

// ── Helpers (shared with DayWidget pattern) ──

interface EventFormData {
  title: string;
  calendarId: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
}

function roundToNext30(date: Date): string {
  const total = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.ceil(total / 30) * 30;
  const h = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formDataToEventInput(data: EventFormData): CalendarEventInput {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (data.allDay) {
    const nextDay = dayjs(data.date).add(1, 'day').format('YYYY-MM-DD');
    return {
      summary: data.title.trim(),
      ...(data.description ? { description: data.description } : {}),
      ...(data.location ? { location: data.location } : {}),
      start: { date: data.date },
      end: { date: nextDay },
    };
  }
  return {
    summary: data.title.trim(),
    ...(data.description ? { description: data.description } : {}),
    ...(data.location ? { location: data.location } : {}),
    start: { dateTime: `${data.date}T${data.startTime}:00`, timeZone },
    end: { dateTime: `${data.date}T${data.endTime}:00`, timeZone },
  };
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
  const displayId = useDisplayId() ?? getDisplayIdFromWindow();
  const displayData = useDisplayCalendar({ displayId, selectedCalendarIds, daysAhead });
  const googleData = useGoogleCalendar({ selectedCalendarIds, daysAhead });
  const { isAuthenticated } = useAuth();
  const isDisplayMode = !!displayId;
  const { isLoading, events, calendars, refresh, addEvent } = isDisplayMode ? displayData : googleData;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // ── Create event form state ──
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    calendarId: '',
    date: dayjs().format('YYYY-MM-DD'),
    allDay: false,
    startTime: '09:00',
    endTime: '10:00',
    location: '',
    description: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const calendarOptions = useMemo(
    () =>
      calendars.map((cal) => ({
        value: cal.id,
        label: cal.summary + (cal.primary ? ' (Primary)' : ''),
        color: cal.backgroundColor ?? '#4285f4',
      })),
    [calendars]
  );

  const openCreateModal = useCallback(
    (date: Date) => {
      const start = roundToNext30(new Date());
      setFormData({
        title: '',
        calendarId: selectedCalendarIds[0] ?? calendars[0]?.id ?? '',
        date: dayjs(date).format('YYYY-MM-DD'),
        allDay: false,
        startTime: start,
        endTime: addMinutesToTime(start, 60),
        location: '',
        description: '',
      });
      setFormError(null);
      setFormOpen(true);
    },
    [selectedCalendarIds, calendars]
  );

  const handleFormSubmit = useCallback(async () => {
    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!formData.calendarId) {
      setFormError('Please select a calendar');
      return;
    }
    if (!formData.allDay) {
      const startMins =
        parseInt(formData.startTime.split(':')[0]) * 60 +
        parseInt(formData.startTime.split(':')[1]);
      const endMins =
        parseInt(formData.endTime.split(':')[0]) * 60 +
        parseInt(formData.endTime.split(':')[1]);
      if (endMins <= startMins) {
        setFormError('End time must be after start time');
        return;
      }
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const input = formDataToEventInput(formData);
      await addEvent(formData.calendarId, input);
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setFormLoading(false);
    }
  }, [formData, addEvent]);

  // ── Event map ──

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

  if (!isAuthenticated && !isDisplayMode) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <GoogleCalendarEmptyState variant="signIn" className={classes.empty} />
      </Box>
    );
  }

  if (isDisplayMode && displayData.error && !displayData.isLoading && events.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <Text size="sm" c="dimmed" ta="center">
            Calendar will appear when the display owner signs in with Google in the app.
          </Text>
        </div>
      </Box>
    );
  }

  if (selectedCalendarIds.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <GoogleCalendarEmptyState variant="noCalendars" className={classes.empty} />
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
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={() => openCreateModal(selectedDate)}
            className={classes.addBtn}
            title="Add event"
          >
            <IconPlus size={13} />
          </ActionIcon>
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
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={() => openCreateModal(selectedDate)}
            className={classes.addBtn}
            title="Add event"
            style={{ marginLeft: 'auto' }}
          >
            <IconPlus size={12} />
          </ActionIcon>
        </div>
        {selectedDateEvents.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
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

      {/* ── Create event modal ── */}
      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title="New Event"
        size="sm"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Stack gap="sm">
          <TextInput
            label="Title"
            placeholder="Event title"
            required
            value={formData.title}
            onChange={(e) => setFormData((d) => ({ ...d, title: e.currentTarget.value }))}
            autoFocus
          />

          <Select
            label="Calendar"
            placeholder="Select a calendar"
            required
            data={calendarOptions}
            value={formData.calendarId}
            onChange={(v) => setFormData((d) => ({ ...d, calendarId: v ?? '' }))}
            renderOption={({ option }) => {
              const cal = calendars.find((c) => c.id === option.value);
              return (
                <Group gap="xs">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: cal?.backgroundColor ?? '#4285f4',
                      flexShrink: 0,
                    }}
                  />
                  <Text size="sm">{option.label}</Text>
                </Group>
              );
            }}
          />

          <TextInput
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((d) => ({ ...d, date: e.currentTarget.value }))}
          />

          <Group justify="space-between">
            <Text size="sm">All day</Text>
            <Switch
              checked={formData.allDay}
              onChange={(e) => setFormData((d) => ({ ...d, allDay: e.currentTarget.checked }))}
            />
          </Group>

          {!formData.allDay && (
            <div className={classes.timeGrid}>
              <TextInput
                label="Start time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData((d) => ({ ...d, startTime: e.currentTarget.value }))}
              />
              <TextInput
                label="End time"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData((d) => ({ ...d, endTime: e.currentTarget.value }))}
              />
            </div>
          )}

          <TextInput
            label="Location"
            placeholder="Optional"
            value={formData.location}
            onChange={(e) => setFormData((d) => ({ ...d, location: e.currentTarget.value }))}
          />

          <Textarea
            label="Description"
            placeholder="Optional"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData((d) => ({ ...d, description: e.currentTarget.value }))}
          />

          {formError && (
            <Alert color="red" variant="light" p="xs">
              <Text size="xs">{formError}</Text>
            </Alert>
          )}

          <Group justify="flex-end" gap="xs" mt="xs">
            <Button variant="subtle" size="sm" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              leftSection={<IconCheck size={14} />}
              loading={formLoading}
              onClick={handleFormSubmit}
            >
              Create Event
            </Button>
          </Group>
        </Stack>
      </Modal>
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
