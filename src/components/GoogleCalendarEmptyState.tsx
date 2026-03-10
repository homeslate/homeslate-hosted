import { Text } from '@mantine/core';
import { IconBrandGoogle, IconCalendarEvent } from '@tabler/icons-react';

type Variant = 'signIn' | 'noCalendars';

interface GoogleCalendarEmptyStateProps {
  variant: Variant;
  className?: string;
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
} as const;

export function GoogleCalendarEmptyState({ variant, className }: GoogleCalendarEmptyStateProps) {
  const { icon: Icon, title, subtitle } = CONTENT[variant];
  const iconStyle = variant === 'signIn'
    ? { color: '#4285f4', marginBottom: '1rem' }
    : { color: '#4285f4', opacity: 0.45 };
  return (
    <div className={className}>
      <Icon size={48} style={iconStyle} />
      <Text size="lg" fw={500} mb={variant === 'signIn' ? 'xs' : 0}>
        {title}
      </Text>
      <Text size="sm" c="dimmed" ta="center">
        {subtitle}
      </Text>
    </div>
  );
}
