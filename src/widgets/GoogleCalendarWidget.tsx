import { useMemo } from 'react';
import {
  Box,
  Text,
  Stack,
  TextInput,
  NumberInput,
  Group,
  Paper,
  Loader,
  Button,
  Anchor,
  MultiSelect,
  Switch,
  Alert,
  Badge,
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import {
  IconCalendarEvent,
  IconRefresh,
  IconBrandGoogle,
  IconLogout,
  IconAlertCircle,
  IconExternalLink,
} from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import type { ParsedCalendarEvent } from '../services/googleCalendar';
import classes from './GoogleCalendarWidget.module.css';
import dayjs from 'dayjs';

export interface GoogleCalendarConfig extends WidgetConfig {
  clientId: string;
  selectedCalendarIds: string[];
  maxEvents: number;
  daysAhead: number;
  showCalendar: boolean;
}

function formatEventTime(event: ParsedCalendarEvent): string {
  if (event.allDay) {
    return 'All day';
  }
  return dayjs(event.start).format('h:mm A');
}

function formatEventDate(event: ParsedCalendarEvent): string {
  const today = dayjs().startOf('day');
  const eventDay = dayjs(event.start).startOf('day');
  const diff = eventDay.diff(today, 'day');

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return dayjs(event.start).format('dddd');
  return dayjs(event.start).format('ddd, MMM D');
}

export function GoogleCalendarWidget({ widget }: WidgetProps<GoogleCalendarConfig>) {
  const { clientId, selectedCalendarIds, maxEvents, daysAhead, showCalendar } = widget.config;

  const {
    isInitialized,
    isAuthenticated,
    isLoading,
    error,
    events,
    signIn,
    signOut,
    refresh,
  } = useGoogleCalendar({
    clientId,
    selectedCalendarIds,
    daysAhead,
  });

  // Get dates with events for calendar highlighting
  const eventDates = useMemo(() => {
    return new Set(events.map((e) => dayjs(e.start).format('YYYY-MM-DD')));
  }, [events]);

  const upcomingEvents = events.slice(0, maxEvents);

  // No client ID configured
  if (!clientId) {
    return (
      <Box className={classes.container}>
        <div className={classes.empty}>
          <IconBrandGoogle size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>Setup Required</Text>
          <Text size="sm" c="dimmed" ta="center">
            Add your Google Client ID in settings
          </Text>
        </div>
      </Box>
    );
  }

  // Not initialized
  if (!isInitialized) {
    return (
      <Box className={classes.container}>
        <div className={classes.loading}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed" mt="sm">
            Initializing Google...
          </Text>
        </div>
      </Box>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <Box className={classes.container}>
        <div className={classes.signIn}>
          <IconBrandGoogle size={48} className={classes.googleIcon} />
          <Text size="lg" fw={500} mb="xs">
            Connect Google Calendar
          </Text>
          <Text size="sm" c="dimmed" ta="center" mb="lg">
            Sign in to see your calendars and events
          </Text>
          <Button
            leftSection={<IconBrandGoogle size={18} />}
            onClick={signIn}
            loading={isLoading}
            size="md"
            className={classes.googleButton}
          >
            Sign in with Google
          </Button>
          {error && (
            <Text size="xs" c="red" mt="sm">
              {error}
            </Text>
          )}
        </div>
      </Box>
    );
  }

  // No calendars selected
  if (selectedCalendarIds.length === 0) {
    return (
      <Box className={classes.container}>
        <div className={classes.empty}>
          <IconCalendarEvent size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Calendars Selected</Text>
          <Text size="sm" c="dimmed" ta="center">
            Select calendars in widget settings
          </Text>
          <Button
            variant="subtle"
            color="red"
            size="xs"
            mt="md"
            leftSection={<IconLogout size={14} />}
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      </Box>
    );
  }

  return (
    <Box className={classes.container}>
      <div className={classes.content}>
        {showCalendar && (
          <div className={classes.calendarSection}>
            <Calendar
              size="sm"
              getDayProps={(date) => ({
                onClick: () => {},
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
            <Group gap="xs">
              {isLoading && <Loader size="xs" color="blue" />}
              <Button
                variant="subtle"
                size="xs"
                p={4}
                onClick={refresh}
                className={classes.refreshBtn}
              >
                <IconRefresh size={14} />
              </Button>
            </Group>
          </div>

          {error && (
            <Alert color="red" variant="light" mb="sm" p="xs">
              <Text size="xs">{error}</Text>
            </Alert>
          )}

          <Stack gap="xs" className={classes.eventsList}>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <Paper key={event.id} className={classes.eventCard} p="xs">
                  <div
                    className={classes.eventIndicator}
                    style={{ backgroundColor: event.color }}
                  />
                  <div className={classes.eventContent}>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {event.title}
                    </Text>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed">
                        {formatEventDate(event)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        •
                      </Text>
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
            ) : isLoading ? (
              <div className={classes.loadingEvents}>
                <Loader size="sm" color="blue" />
                <Text size="xs" c="dimmed">
                  Loading events...
                </Text>
              </div>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No upcoming events
              </Text>
            )}
          </Stack>
        </div>
      </div>
    </Box>
  );
}

export function GoogleCalendarWidgetSettings({
  widget,
  onConfigChange,
}: WidgetProps<GoogleCalendarConfig>) {
  const { clientId, selectedCalendarIds, maxEvents, daysAhead, showCalendar } = widget.config;

  const { isInitialized, isAuthenticated, calendars, signIn, signOut, isLoading } =
    useGoogleCalendar({
      clientId,
      selectedCalendarIds,
      daysAhead,
    });

  const calendarOptions = calendars.map((cal) => ({
    value: cal.id,
    label: cal.summary + (cal.primary ? ' (Primary)' : ''),
  }));

  return (
    <Stack gap="md">
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Setup Required"
        color="blue"
        variant="light"
      >
        <Text size="xs">
          You need a Google Cloud Project with Calendar API enabled.{' '}
          <Anchor
            href="https://github.com/yourusername/kitchen-display/blob/main/docs/GOOGLE_CALENDAR_SETUP.md"
            target="_blank"
            size="xs"
          >
            See setup guide <IconExternalLink size={10} style={{ display: 'inline' }} />
          </Anchor>
        </Text>
      </Alert>

      <TextInput
        label="Google Client ID"
        placeholder="xxxx.apps.googleusercontent.com"
        description="From Google Cloud Console"
        value={clientId}
        onChange={(e) => onConfigChange({ clientId: e.currentTarget.value })}
      />

      {clientId && isInitialized && (
        <Paper p="sm" className={classes.authSection}>
          {isAuthenticated ? (
            <>
              <Group justify="space-between" mb="sm">
                <Badge color="green" variant="light">
                  Connected to Google
                </Badge>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  leftSection={<IconLogout size={14} />}
                  onClick={signOut}
                >
                  Sign out
                </Button>
              </Group>

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
                loading={isLoading}
                size="sm"
              >
                Sign in with Google
              </Button>
            </Stack>
          )}
        </Paper>
      )}

      <Group justify="space-between">
        <Text size="sm">Show Calendar</Text>
        <Switch
          checked={showCalendar}
          onChange={(e) => onConfigChange({ showCalendar: e.currentTarget.checked })}
        />
      </Group>

      <NumberInput
        label="Maximum Events to Show"
        min={1}
        max={20}
        value={maxEvents}
        onChange={(value) => onConfigChange({ maxEvents: Number(value) || 10 })}
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

