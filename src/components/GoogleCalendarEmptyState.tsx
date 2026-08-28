import { Text } from '@mantine/core';
import { IconBrandGoogle, IconCalendarEvent } from '@tabler/icons-react';

type Variant = 'signIn' | 'noCalendars' | 'displayError';

interface GoogleCalendarEmptyStateProps {
  variant: Variant;
  className?: string;
  detail?: string;
}

const CONTENT = {
  signIn: {
    icon: IconBrandGoogle,
    title: 'Google Calendar',
    subtitle: 'Sign in using the button in the header to view your calendar',
  },
  noCalendars: {
    icon: IconCalendarEvent,
    title: 'No Calendars Selected',
    subtitle: 'Select calendars in widget settings',
  },
  displayError: {
    icon: IconBrandGoogle,
    title: 'Google Calendar',
    subtitle: 'Calendar will appear when the display owner signs in with Google in the app.',
  },
} as const;

export function GoogleCalendarEmptyState({ variant, className, detail }: GoogleCalendarEmptyStateProps) {
  const { icon: Icon, title, subtitle } = CONTENT[variant];
  const iconStyle = variant === 'noCalendars'
    ? { color: '#4285f4', opacity: 0.45 }
    : { color: '#4285f4', marginBottom: '1rem' };
  return (
    <div className={className}>
      <Icon size={48} style={iconStyle} />
      <Text size="lg" fw={500} mb={variant === 'signIn' ? 'xs' : 0}>
        {title}
      </Text>
      <Text size="sm" c="dimmed" ta="center">
        {subtitle}
      </Text>
      {detail ? (
        <Text size="xs" c="dimmed" ta="center" mt="xs">
          {detail}
        </Text>
      ) : null}
    </div>
  );
}
