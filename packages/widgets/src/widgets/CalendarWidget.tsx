import { useState, useMemo } from 'react';
import { 
  Box, 
  Text, 
  Stack, 
  TextInput, 
  Switch, 
  NumberInput, 
  Group, 
  Paper,
  Loader,
  Button,
  Anchor,
  Collapse,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { IconCalendarEvent, IconRefresh, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types';
import { useCalendar } from '../hooks/useCalendar';
import { WidgetDataStatus } from '../chrome/WidgetDataStatus';
import type { CalendarEvent } from '../services/calendar';
import classes from './CalendarWidget.module.css';
import dayjs from 'dayjs';

export interface CalendarConfig extends WidgetConfig {
  icalUrl: string;
  showWeekNumbers: boolean;
  maxEvents: number;
  daysAhead: number;
  showCalendar: boolean;
  transparentBackground: boolean;
}

// Color palette for events
const eventColors = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ef4444', // red
  '#84cc16', // lime
];

function getEventColor(index: number): string {
  return eventColors[index % eventColors.length];
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) {
    return 'All day';
  }
  return dayjs(event.start).format('h:mm A');
}

function formatEventDate(event: CalendarEvent): string {
  const today = dayjs().startOf('day');
  const eventDay = dayjs(event.start).startOf('day');
  const diff = eventDay.diff(today, 'day');
  
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return dayjs(event.start).format('dddd');
  return dayjs(event.start).format('ddd, MMM D');
}

export function CalendarWidget({ widget }: WidgetProps<CalendarConfig>) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const { icalUrl, maxEvents, daysAhead, showCalendar, transparentBackground } = widget.config;

  const { events, isLoading, error, refresh, lastUpdated } = useCalendar({
    icalUrl,
    daysAhead,
  });

  // Get dates with events for calendar highlighting
  const eventDates = useMemo(() => {
    return new Set(events.map(e => dayjs(e.start).format('YYYY-MM-DD')));
  }, [events]);

  const upcomingEvents = events.slice(0, maxEvents);

  // No calendar URL configured
  if (!icalUrl) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconCalendarEvent size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Calendar Connected</Text>
          <Text size="sm" c="dimmed" ta="center">
            Add your calendar's iCal URL in settings
          </Text>
        </div>
      </Box>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.error}>
          <Text size="sm" c="red">{error}</Text>
          <Button
            variant="light"
            color="teal"
            size="xs"
            mt="sm"
            leftSection={<IconRefresh size={14} />}
            onClick={refresh}
          >
            Retry
          </Button>
        </div>
      </Box>
    );
  }

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      <div className={classes.content}>
        {showCalendar && (
          <div className={classes.calendarSection}>
            <Calendar
              size="sm"
              getDayProps={(date) => ({
                selected: selectedDate ? dayjs(date).isSame(selectedDate, 'day') : false,
                onClick: () => setSelectedDate(new Date(date)),
              })}
              renderDay={(date) => {
                const dateObj = new Date(date);
                const dateStr = dayjs(dateObj).format('YYYY-MM-DD');
                const hasEvents = eventDates.has(dateStr);
                const day = dateObj.getDate();
                
                return (
                  <div className={classes.dayCell}>
                    {day}
                    {hasEvents && <div className={classes.eventDot} />}
                  </div>
                );
              }}
              classNames={{
                calendarHeader: classes.calendarHeader,
                day: classes.day,
              }}
            />
          </div>
        )}
        <div className={classes.eventsSection}>
          <div className={classes.eventsHeader}>
            <Text className={classes.eventsTitle}>
              <IconCalendarEvent size={16} />
              Upcoming Events
            </Text>
            {isLoading && <Loader size="xs" color="teal" />}
          </div>
          <WidgetDataStatus
            widgetId={widget.id}
            lastUpdated={lastUpdated}
            error={error}
            isLoading={isLoading}
          />
          
          {isLoading && events.length === 0 ? (
            <div className={classes.loading}>
              <Loader size="sm" color="teal" />
              <Text size="xs" c="dimmed">Loading events...</Text>
            </div>
          ) : (
            <Stack gap="xs" className={classes.eventsList}>
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event, index) => (
                  <Paper key={event.id} className={classes.eventCard} p="xs">
                    <div 
                      className={classes.eventIndicator} 
                      style={{ backgroundColor: getEventColor(index) }}
                    />
                    <div className={classes.eventContent}>
                      <Text size="sm" fw={500} lineClamp={1}>{event.title}</Text>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">
                          {formatEventDate(event)}
                        </Text>
                        <Text size="xs" c="dimmed">•</Text>
                        <Text size="xs" c="dimmed">
                          {formatEventTime(event)}
                        </Text>
                      </Group>
                      {event.location && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          📍 {event.location}
                        </Text>
                      )}
                    </div>
                  </Paper>
                ))
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  No upcoming events
                </Text>
              )}
            </Stack>
          )}
        </div>
      </div>
    </Box>
  );
}

export function CalendarWidgetSettings({ widget, onConfigChange }: WidgetProps<CalendarConfig>) {
  const { icalUrl, showWeekNumbers, maxEvents, daysAhead, showCalendar } = widget.config;
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Stack gap="md">
      <div>
        <TextInput
          label="Calendar URL (iCal/ICS)"
          placeholder="https://calendar.google.com/calendar/ical/..."
          description="Paste your calendar's iCal feed URL"
          value={icalUrl}
          onChange={(e) => onConfigChange({ icalUrl: e.currentTarget.value })}
        />
        
        <Button
          variant="subtle"
          size="xs"
          mt="xs"
          onClick={() => setShowHelp(!showHelp)}
          rightSection={showHelp ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        >
          How to get your calendar URL
        </Button>
        
        <Collapse in={showHelp}>
          <Paper p="sm" mt="xs" className={classes.helpBox}>
            <Text size="sm" fw={600} mb="xs">Google Calendar:</Text>
            <Text size="xs" c="dimmed" component="ol" style={{ paddingLeft: '1rem', margin: 0 }}>
              <li>Open <Anchor href="https://calendar.google.com" target="_blank" size="xs">Google Calendar</Anchor></li>
              <li>Click the ⋮ menu next to your calendar</li>
              <li>Select "Settings and sharing"</li>
              <li>Scroll to "Secret address in iCal format"</li>
              <li>Copy the URL</li>
            </Text>
            
            <Text size="sm" fw={600} mt="md" mb="xs">Outlook/Office 365:</Text>
            <Text size="xs" c="dimmed" component="ol" style={{ paddingLeft: '1rem', margin: 0 }}>
              <li>Go to Calendar settings</li>
              <li>Find "Shared calendars"</li>
              <li>Publish your calendar</li>
              <li>Copy the ICS link</li>
            </Text>
            
            <Text size="sm" fw={600} mt="md" mb="xs">Apple iCloud:</Text>
            <Text size="xs" c="dimmed" component="ol" style={{ paddingLeft: '1rem', margin: 0 }}>
              <li>Open Calendar app</li>
              <li>Right-click calendar → Share Calendar</li>
              <li>Check "Public Calendar"</li>
              <li>Copy the URL</li>
            </Text>
          </Paper>
        </Collapse>
      </div>

      <Group justify="space-between">
        <Text size="sm">Show Calendar</Text>
        <Switch
          checked={showCalendar}
          onChange={(e) => onConfigChange({ showCalendar: e.currentTarget.checked })}
        />
      </Group>

      <Group justify="space-between">
        <Text size="sm">Show Week Numbers</Text>
        <Switch
          checked={showWeekNumbers}
          onChange={(e) => onConfigChange({ showWeekNumbers: e.currentTarget.checked })}
        />
      </Group>

      <NumberInput
        label="Maximum Events to Show"
        min={1}
        max={20}
        value={maxEvents}
        onChange={(value) => onConfigChange({ maxEvents: Number(value) || 5 })}
      />

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
