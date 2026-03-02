import { useState, useEffect, useMemo, useRef } from 'react';
import { Text, Stack, Select, Group, MultiSelect, Paper, Button, NumberInput, Badge } from '@mantine/core';
import { IconBrandGoogle, IconCalendarWeek } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useAuth } from '../contexts/AuthContext';
import type { ParsedCalendarEvent } from '../services/googleCalendar';
import classes from './WeekCalendarWidget.module.css';

// ── Config ──────────────────────────────────────────────────────────────────

export interface WeekCalendarConfig extends WidgetConfig {
  selectedCalendarIds: string[];
  viewMode: 'calendar-week' | 'rolling-7';
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  startHour: number;   // e.g. 7
  endHour: number;     // e.g. 21
}

// ── Layout constants ────────────────────────────────────────────────────────

const HOUR_HEIGHT = 60; // px per hour

// ── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDays(
  viewMode: 'calendar-week' | 'rolling-7',
  weekStartsOn: 0 | 1,
  today: dayjs.Dayjs
): dayjs.Dayjs[] {
  if (viewMode === 'rolling-7') {
    return Array.from({ length: 7 }, (_, i) => today.add(i, 'day'));
  }
  // Find the start of the current calendar week
  const dow = today.day(); // 0=Sun … 6=Sat
  let offset: number;
  if (weekStartsOn === 1) {
    // Monday-start: Mon=0, Tue=1, … Sun=6
    offset = dow === 0 ? -6 : 1 - dow;
  } else {
    // Sunday-start
    offset = -dow;
  }
  const weekStart = today.add(offset, 'day');
  return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function formatEventTime(event: ParsedCalendarEvent): string {
  const start = dayjs(event.start);
  return start.format(start.minute() === 0 ? 'h a' : 'h:mm a');
}

interface PositionedEvent extends ParsedCalendarEvent {
  topPct: number;
  heightPct: number;
  lane: number;
  laneCount: number;
}

/** Assign non-overlapping display lanes to timed events within a single day. */
function positionEvents(
  events: ParsedCalendarEvent[],
  startHour: number,
  endHour: number,
  dayStart: dayjs.Dayjs
): PositionedEvent[] {
  const totalMins = (endHour - startHour) * 60;

  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const rawStart = dayjs(e.start).diff(dayStart, 'minute');
      const rawEnd = dayjs(e.end).diff(dayStart, 'minute');
      const startMins = Math.max(rawStart, startHour * 60);
      const endMins = Math.min(rawEnd, endHour * 60);
      return { event: e, startMins, endMins };
    })
    .filter(({ startMins, endMins }) => endMins > startMins)
    .sort((a, b) => a.startMins - b.startMins);

  // Lane assignment: find first lane whose last event has ended
  const laneEnds: number[] = [];
  const withLanes = timed.map(({ event, startMins, endMins }) => {
    let lane = laneEnds.findIndex((end) => end <= startMins);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endMins);
    } else {
      laneEnds[lane] = endMins;
    }
    return { event, startMins, endMins, lane };
  });

  // For each event, laneCount = number of events it overlaps with (incl. itself)
  return withLanes.map(({ event, startMins, endMins, lane }) => {
    const overlaps = withLanes.filter(
      (o) => o.startMins < endMins && o.endMins > startMins
    ).length;
    const topPct = ((startMins - startHour * 60) / totalMins) * 100;
    const heightPct = Math.max(((endMins - startMins) / totalMins) * 100, 100 / totalMins * 24);
    return { ...event, topPct, heightPct, lane, laneCount: overlaps };
  });
}

// ── Main Component ──────────────────────────────────────────────────────────

export function WeekCalendarWidget({ widget }: WidgetProps<WeekCalendarConfig>) {
  const { selectedCalendarIds, viewMode, weekStartsOn, startHour, endHour } = widget.config;
  const { isAuthenticated } = useAuth();
  const { events } = useGoogleCalendar({ selectedCalendarIds, daysAhead: 14 });

  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60_000);
    return () => clearInterval(t);
  }, []);

  const today = now.startOf('day');
  const days = useMemo(
    () => getWeekDays(viewMode, weekStartsOn, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewMode, weekStartsOn, today.format('YYYY-MM-DD')]
  );

  const totalMins = (endHour - startHour) * 60;
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // Current-time indicator
  const currentMins = now.hour() * 60 + now.minute();
  const showCurrentTime = currentMins >= startHour * 60 && currentMins <= endHour * 60;
  const currentTimePct = ((currentMins - startHour * 60) / totalMins) * 100;

  // Per-day event data
  const dayData = useMemo(
    () =>
      days.map((day) => {
        const dayStart = day.startOf('day');
        const dayEnd = day.endOf('day');
        const dayEvents = events.filter(
          (e) => dayjs(e.start).isBefore(dayEnd) && dayjs(e.end).isAfter(dayStart)
        );
        const allDay = dayEvents.filter(
          (e) => e.allDay || !dayjs(e.start).isSame(day, 'day')
        );
        const timed = dayEvents.filter(
          (e) => !e.allDay && dayjs(e.start).isSame(day, 'day')
        );
        return {
          allDay,
          timed: positionEvents(timed, startHour, endHour, dayStart),
        };
      }),
    [events, days, startHour, endHour]
  );

  const hasAllDay = dayData.some((d) => d.allDay.length > 0);

  // Auto-scroll to current time on mount
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !scrollRef.current) return;
    const target = Math.max(0, (currentTimePct / 100) * gridHeight - scrollRef.current.clientHeight / 3);
    scrollRef.current.scrollTop = target;
    scrolled.current = true;
  });

  // ── Early returns ────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className={classes.emptyState}>
        <IconBrandGoogle size={36} opacity={0.3} />
        <Text size="sm" c="dimmed">Sign in using the header to view your calendar</Text>
      </div>
    );
  }

  if (selectedCalendarIds.length === 0) {
    return (
      <div className={classes.emptyState}>
        <IconCalendarWeek size={36} opacity={0.3} />
        <Text size="sm" c="dimmed">Select calendars in widget settings</Text>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={classes.container}>
      {/* Day headers */}
      <div className={classes.dayHeaders}>
        <div className={classes.timeGutterHead} />
        {days.map((day, i) => {
          const isToday = day.isSame(today, 'day');
          const isPast = day.isBefore(today, 'day');
          return (
            <div
              key={i}
              className={`${classes.dayHead} ${isPast ? classes.dayHeadPast : ''}`}
            >
              <span className={classes.dayName}>{day.format('ddd')}</span>
              <span className={`${classes.dayNum} ${isToday ? classes.dayNumToday : ''}`}>
                {day.format('D')}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day events strip */}
      {hasAllDay && (
        <div className={classes.allDayStrip}>
          <div className={classes.allDayGutter}>all-day</div>
          {dayData.map((data, i) => (
            <div key={i} className={classes.allDayColumn}>
              {data.allDay.map((event) => (
                <div
                  key={event.id}
                  className={classes.allDayEvent}
                  style={{ backgroundColor: event.color + 'cc' }}
                  title={event.title}
                >
                  {event.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable time grid */}
      <div className={classes.scrollable} ref={scrollRef}>
        <div className={classes.gridBody} style={{ height: gridHeight }}>
          {/* Time gutter */}
          <div className={classes.timeGutter}>
            {hours.map((h) => (
              <div
                key={h}
                className={classes.hourLabel}
                style={{ top: (h - startHour) * HOUR_HEIGHT }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, i) => {
            const isToday = day.isSame(today, 'day');
            const isPast = day.isBefore(today, 'day');
            return (
              <div
                key={i}
                className={`${classes.dayColumn} ${isToday ? classes.dayColumnToday : ''} ${isPast ? classes.dayColumnPast : ''}`}
              >
                {/* Hour + half-hour lines */}
                {hours.map((h) => (
                  <div key={h}>
                    <div
                      className={classes.hourLine}
                      style={{ top: (h - startHour) * HOUR_HEIGHT }}
                    />
                    <div
                      className={classes.halfHourLine}
                      style={{ top: (h - startHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    />
                  </div>
                ))}

                {/* Timed events */}
                {dayData[i].timed.map((event) => (
                  <div
                    key={event.id}
                    className={classes.event}
                    title={`${event.title}\n${formatEventTime(event)}`}
                    style={{
                      top: `${event.topPct}%`,
                      height: `${event.heightPct}%`,
                      left: `${(event.lane / event.laneCount) * 100}%`,
                      width: `${(1 / event.laneCount) * 98}%`,
                      backgroundColor: event.color + 'b0',
                      borderLeftColor: event.color,
                      zIndex: 2,
                    }}
                  >
                    <span className={classes.eventTitle}>{event.title}</span>
                    {event.heightPct > 5 && (
                      <span className={classes.eventTime}>{formatEventTime(event)}</span>
                    )}
                  </div>
                ))}

                {/* Current time line (today only) */}
                {isToday && showCurrentTime && (
                  <div
                    className={classes.currentTimeLine}
                    style={{ top: `${currentTimePct}%` }}
                  >
                    <div className={classes.currentTimeDot} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function WeekCalendarWidgetSettings({
  widget,
  onConfigChange,
}: WidgetProps<WeekCalendarConfig>) {
  const { selectedCalendarIds, viewMode, weekStartsOn, startHour, endHour } = widget.config;
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const { calendars } = useGoogleCalendar({ selectedCalendarIds, daysAhead: 14 });

  const calendarOptions = calendars.map((cal) => ({
    value: cal.id,
    label: cal.summary + (cal.primary ? ' (Primary)' : ''),
  }));

  return (
    <Stack gap="md">
      <Paper p="sm">
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

      <Select
        label="View mode"
        data={[
          { value: 'calendar-week', label: 'Calendar week' },
          { value: 'rolling-7', label: 'Today + 6 upcoming days' },
        ]}
        value={viewMode}
        onChange={(v) => v && onConfigChange({ viewMode: v as WeekCalendarConfig['viewMode'] })}
      />

      {viewMode === 'calendar-week' && (
        <Select
          label="Week starts on"
          data={[
            { value: '0', label: 'Sunday' },
            { value: '1', label: 'Monday' },
          ]}
          value={String(weekStartsOn)}
          onChange={(v) => v && onConfigChange({ weekStartsOn: Number(v) as 0 | 1 })}
        />
      )}

      <Group grow>
        <NumberInput
          label="Start hour"
          description="e.g. 7 = 7 AM"
          min={0}
          max={endHour - 1}
          value={startHour}
          onChange={(v) => onConfigChange({ startHour: Number(v) || 7 })}
        />
        <NumberInput
          label="End hour"
          description="e.g. 21 = 9 PM"
          min={startHour + 1}
          max={24}
          value={endHour}
          onChange={(v) => onConfigChange({ endHour: Number(v) || 21 })}
        />
      </Group>

      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Past days are shown dimmed. Events before today may not load.
        </Text>
      </Group>
    </Stack>
  );
}
