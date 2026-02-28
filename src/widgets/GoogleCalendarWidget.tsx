import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Text,
  Stack,
  TextInput,
  Textarea,
  NumberInput,
  Group,
  Paper,
  Loader,
  Button,
  MultiSelect,
  Select,
  Switch,
  Alert,
  Badge,
  Modal,
  ScrollArea,
  ActionIcon,
  Divider,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import {
  IconCalendarEvent,
  IconRefresh,
  IconBrandGoogle,
  IconMapPin,
  IconClock,
  IconCalendar,
  IconFileText,
  IconPencil,
  IconTrash,
  IconCheck,
  IconX,
  IconPlus,
} from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useAuth } from '../contexts/AuthContext';
import type { ParsedCalendarEvent } from '../services/googleCalendar';
import type { CalendarEventInput } from '../services/googleCalendar';
import classes from './GoogleCalendarWidget.module.css';
import dayjs from 'dayjs';

export interface GoogleCalendarConfig extends WidgetConfig {
  clientId: string;
  selectedCalendarIds: string[];
  maxEvents: number;
  daysAhead: number;
  showCalendar: boolean;
}

interface EventFormData {
  title: string;
  calendarId: string;
  date: string;      // YYYY-MM-DD
  allDay: boolean;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  location: string;
  description: string;
  eventId: string;   // empty for create
}

// ── Pure helpers (defined outside component) ──

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

function formatTimeRange(event: ParsedCalendarEvent): string {
  if (event.allDay) return 'All day';
  const start = dayjs(event.start);
  const end = dayjs(event.end);
  if (start.format('A') === end.format('A')) {
    return `${start.format('h:mm')} – ${end.format('h:mm A')}`;
  }
  return `${start.format('h:mm A')} – ${end.format('h:mm A')}`;
}

function formatGroupHeader(dateStr: string): string {
  const today = dayjs().startOf('day');
  const date = dayjs(dateStr);
  const diff = date.diff(today, 'day');
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return date.format('dddd');
  return date.format('ddd, MMM D');
}

function isToday(dateStr: string): boolean {
  return dayjs(dateStr).isSame(dayjs(), 'day');
}

function getRelativeTime(event: ParsedCalendarEvent): { label: string; isNow: boolean } | null {
  if (event.allDay) return null;
  const now = dayjs();
  const start = dayjs(event.start);
  const end = dayjs(event.end);

  if (now.isAfter(start) && now.isBefore(end)) return { label: 'Now', isNow: true };

  const diffMins = start.diff(now, 'minute');
  if (diffMins <= 0 || diffMins > 120) return null;
  if (diffMins < 60) return { label: `in ${diffMins}m`, isNow: false };
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return { label: mins === 0 ? `in ${hours}h` : `in ${hours}h ${mins}m`, isNow: false };
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

// ── Main widget component ──

export function GoogleCalendarWidget({ widget }: WidgetProps<GoogleCalendarConfig>) {
  const { selectedCalendarIds, maxEvents, daysAhead, showCalendar } = widget.config;

  const {
    isAuthenticated,
    isLoading,
    error,
    calendars,
    events,
    refresh,
    addEvent,
    editEvent,
    removeEvent,
  } = useGoogleCalendar({ selectedCalendarIds, daysAhead });

  // Long-press timer ref
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detail modal state
  const [detailEvent, setDetailEvent] = useState<ParsedCalendarEvent | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Create/edit form state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    calendarId: '',
    date: dayjs().format('YYYY-MM-DD'),
    allDay: false,
    startTime: '09:00',
    endTime: '10:00',
    location: '',
    description: '',
    eventId: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Derived ──

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ParsedCalendarEvent[]>();
    for (const event of events) {
      const key = dayjs(event.start).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const upcomingEvents = events.slice(0, maxEvents);

  const groupedEvents = useMemo(() => {
    const map = new Map<string, ParsedCalendarEvent[]>();
    for (const event of upcomingEvents) {
      const key = dayjs(event.start).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return Array.from(map.entries());
  }, [upcomingEvents]);

  const calendarOptions = useMemo(
    () =>
      calendars.map((cal) => ({
        value: cal.id,
        label: cal.summary + (cal.primary ? ' (Primary)' : ''),
        color: cal.backgroundColor ?? '#4285f4',
      })),
    [calendars]
  );

  // ── Handlers ──

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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
        eventId: '',
      });
      setFormMode('create');
      setFormError(null);
      setFormOpen(true);
    },
    [selectedCalendarIds, calendars]
  );

  const openEditModal = useCallback((event: ParsedCalendarEvent) => {
    setDetailEvent(null);
    setDeleteConfirming(false);
    setDeleteError(null);
    setFormData({
      title: event.title === '(No title)' ? '' : event.title,
      calendarId: event.calendarId,
      date: dayjs(event.start).format('YYYY-MM-DD'),
      allDay: event.allDay,
      startTime: event.allDay ? '09:00' : dayjs(event.start).format('HH:mm'),
      endTime: event.allDay ? '10:00' : dayjs(event.end).format('HH:mm'),
      location: event.location ?? '',
      description: event.description ? event.description.replace(/<[^>]*>/g, '').trim() : '',
      eventId: event.id,
    });
    setFormMode('edit');
    setFormError(null);
    setFormOpen(true);
  }, []);

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
        parseInt(formData.endTime.split(':')[0]) * 60 + parseInt(formData.endTime.split(':')[1]);
      if (endMins <= startMins) {
        setFormError('End time must be after start time');
        return;
      }
    }

    setFormLoading(true);
    setFormError(null);
    try {
      const input = formDataToEventInput(formData);
      if (formMode === 'create') {
        await addEvent(formData.calendarId, input);
      } else {
        await editEvent(formData.calendarId, formData.eventId, input);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setFormLoading(false);
    }
  }, [formData, formMode, addEvent, editEvent]);

  const handleDelete = useCallback(async () => {
    if (!detailEvent) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await removeEvent(detailEvent.calendarId, detailEvent.id);
      setDetailEvent(null);
      setDeleteConfirming(false);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeleteLoading(false);
    }
  }, [detailEvent, removeEvent]);

  // ── Early-return states ──

  if (!isAuthenticated) {
    return (
      <Box className={classes.container}>
        <div className={classes.signIn}>
          <IconBrandGoogle size={48} className={classes.googleIcon} />
          <Text size="lg" fw={500} mb="xs">Google Calendar</Text>
          <Text size="sm" c="dimmed" ta="center">
            Sign in using the button in the header to view your calendar
          </Text>
        </div>
      </Box>
    );
  }

  if (selectedCalendarIds.length === 0) {
    return (
      <Box className={classes.container}>
        <div className={classes.empty}>
          <IconCalendarEvent size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Calendars Selected</Text>
          <Text size="sm" c="dimmed" ta="center">Select calendars in widget settings</Text>
        </div>
      </Box>
    );
  }

  // ── Main render ──

  return (
    <Box className={classes.container}>
      <div className={classes.content}>
        {showCalendar && (
          <div className={classes.calendarSection}>
            <Calendar
              size="sm"
              getDayProps={(date) => ({
                onPointerDown: () => {
                  longPressTimer.current = setTimeout(() => openCreateModal(new Date(date)), 600);
                },
                onPointerUp: clearLongPress,
                onPointerLeave: clearLongPress,
                onPointerCancel: clearLongPress,
              })}
              renderDay={(date) => {
                const key = dayjs(date).format('YYYY-MM-DD');
                const dayEvents = eventsByDate.get(key) || [];
                const colors = [...new Set(dayEvents.map((e) => e.color))].slice(0, 3);
                return (
                  <div className={classes.dayCell}>
                    <span>{dayjs(date).date()}</span>
                    {colors.length > 0 && (
                      <div className={classes.eventDots}>
                        {colors.map((color, i) => (
                          <div key={i} className={classes.eventDotColored} style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
              classNames={{ calendarHeader: classes.calendarHeader }}
            />
            <Text size="xs" c="dimmed" ta="center" mt={4} className={classes.calendarHint}>
              Hold a day to add event
            </Text>
          </div>
        )}

        <div className={classes.eventsSection}>
          <div className={classes.eventsHeader}>
            <div className={classes.eventsTitle}>
              <IconCalendarEvent size={13} />
              Upcoming
            </div>
            <Group gap={4}>
              {isLoading && <Loader size="xs" color="blue" />}
              <ActionIcon
                variant="subtle"
                size="xs"
                onClick={() => openCreateModal(new Date())}
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

          {error && (
            <Alert color="red" variant="light" mb="xs" p="xs">
              <Text size="xs">{error}</Text>
            </Alert>
          )}

          <ScrollArea className={classes.eventsList} scrollbarSize={4}>
            {groupedEvents.length > 0 ? (
              groupedEvents.map(([dateStr, dayEvents]) => (
                <div key={dateStr} className={classes.dayGroup}>
                  <div className={classes.dayHeader}>
                    <span className={`${classes.dayHeaderLabel} ${isToday(dateStr) ? classes.dayHeaderToday : ''}`}>
                      {formatGroupHeader(dateStr)}
                    </span>
                    <div className={classes.dayHeaderLine} />
                  </div>
                  {dayEvents.map((event) => {
                    const relTime = getRelativeTime(event);
                    return (
                      <div
                        key={event.id}
                        className={`${classes.eventCard} ${relTime?.isNow ? classes.eventCardNow : ''}`}
                        onClick={() => {
                          setDeleteConfirming(false);
                          setDeleteError(null);
                          setDetailEvent(event);
                        }}
                      >
                        <div className={classes.eventIndicator} style={{ backgroundColor: event.color }} />
                        <div className={classes.eventBody}>
                          <div className={classes.eventTitleRow}>
                            <span className={classes.eventTitle}>{event.title}</span>
                            {relTime && (
                              <span className={relTime.isNow ? classes.nowBadge : classes.soonBadge}>
                                {relTime.label}
                              </span>
                            )}
                          </div>
                          <div className={classes.eventMeta}>
                            <span className={classes.timeRange}>{formatTimeRange(event)}</span>
                            {event.calendarName && (
                              <span
                                className={classes.calendarBadge}
                                style={{ borderColor: event.color, color: event.color }}
                              >
                                {event.calendarName}
                              </span>
                            )}
                          </div>
                          {event.location && (
                            <div className={classes.eventLocation}>
                              <IconMapPin size={9} />
                              {event.location}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : isLoading ? (
              <div className={classes.loadingEvents}>
                <Loader size="sm" color="blue" />
                <Text size="xs" c="dimmed">Loading events...</Text>
              </div>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">No upcoming events</Text>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* ── Event detail modal ── */}
      <Modal
        opened={!!detailEvent}
        onClose={() => { setDetailEvent(null); setDeleteConfirming(false); setDeleteError(null); }}
        title={
          detailEvent && (
            <Group gap="sm" wrap="nowrap">
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: detailEvent.color, flexShrink: 0 }} />
              <Text fw={600} size="sm" style={{ lineHeight: 1.3 }}>{detailEvent.title}</Text>
            </Group>
          )
        }
        size="sm"
        centered
      >
        {detailEvent && (
          <div className={classes.modalDetail}>
            <div className={classes.modalDetailRow}>
              <IconClock size={15} className={classes.modalDetailIcon} />
              <div>
                <Text size="sm" fw={500}>{formatGroupHeader(dayjs(detailEvent.start).format('YYYY-MM-DD'))}</Text>
                <Text size="xs" c="dimmed">{formatTimeRange(detailEvent)}</Text>
              </div>
            </div>

            {detailEvent.location && (
              <div className={classes.modalDetailRow}>
                <IconMapPin size={15} className={classes.modalDetailIcon} />
                <Text size="sm">{detailEvent.location}</Text>
              </div>
            )}

            {detailEvent.calendarName && (
              <div className={classes.modalDetailRow}>
                <IconCalendar size={15} className={classes.modalDetailIcon} />
                <Text size="sm">{detailEvent.calendarName}</Text>
              </div>
            )}

            {detailEvent.description && (
              <div className={classes.modalDetailRow}>
                <IconFileText size={15} className={classes.modalDetailIcon} />
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {detailEvent.description.replace(/<[^>]*>/g, '').trim()}
                </Text>
              </div>
            )}

            <Divider mt="xs" />

            {deleteConfirming ? (
              <div className={classes.deleteConfirmRow}>
                <Text size="sm" c="dimmed">Delete this event?</Text>
                <Group gap="xs" justify="flex-end">
                  <Button
                    variant="subtle" size="xs"
                    leftSection={<IconX size={13} />}
                    onClick={() => { setDeleteConfirming(false); setDeleteError(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="red" size="xs"
                    leftSection={<IconTrash size={13} />}
                    loading={deleteLoading}
                    onClick={handleDelete}
                  >
                    Delete
                  </Button>
                </Group>
                {deleteError && <Text size="xs" c="red">{deleteError}</Text>}
              </div>
            ) : (
              <Group gap="xs" justify="space-between">
                <Button
                  variant="subtle" color="red" size="xs"
                  leftSection={<IconTrash size={13} />}
                  onClick={() => setDeleteConfirming(true)}
                >
                  Delete
                </Button>
                <Button
                  variant="light" size="xs"
                  leftSection={<IconPencil size={13} />}
                  onClick={() => openEditModal(detailEvent)}
                >
                  Edit
                </Button>
              </Group>
            )}
          </div>
        )}
      </Modal>

      {/* ── Create / Edit event modal ── */}
      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === 'create' ? 'New Event' : 'Edit Event'}
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
            autoFocus={formMode === 'create'}
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
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cal?.backgroundColor ?? '#4285f4', flexShrink: 0 }} />
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
              leftSection={formMode === 'create' ? undefined : <IconCheck size={14} />}
              loading={formLoading}
              onClick={handleFormSubmit}
            >
              {formMode === 'create' ? 'Create Event' : 'Save Changes'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// ── Settings component (unchanged logic, minor cleanup) ──

export function GoogleCalendarWidgetSettings({
  widget,
  onConfigChange,
}: WidgetProps<GoogleCalendarConfig>) {
  const { selectedCalendarIds, maxEvents, daysAhead, showCalendar } = widget.config;

  const { isAuthenticated, isLoading, signIn } = useAuth();
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
            <Badge color="green" variant="light" mb="sm">Connected to Google</Badge>
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
            <Text size="sm" c="dimmed">Sign in to select your calendars</Text>
            <Button
              leftSection={<IconBrandGoogle size={16} />}
              onClick={signIn}
              loading={isLoading}
              size="sm"
            >
              Sign in with Google
            </Button>
          </Stack>
        )}
      </Paper>

      <Group justify="space-between">
        <Text size="sm">Show Calendar</Text>
        <Switch
          checked={showCalendar}
          onChange={(e) => onConfigChange({ showCalendar: e.currentTarget.checked })}
        />
      </Group>

      <NumberInput
        label="Maximum Events to Show"
        min={1} max={20}
        value={maxEvents}
        onChange={(value) => onConfigChange({ maxEvents: Number(value) || 10 })}
      />

      <NumberInput
        label="Days Ahead"
        description="How many days ahead to fetch events"
        min={1} max={90}
        value={daysAhead}
        onChange={(value) => onConfigChange({ daysAhead: Number(value) || 30 })}
      />
    </Stack>
  );
}
