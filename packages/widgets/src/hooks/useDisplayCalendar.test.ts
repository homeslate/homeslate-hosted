import { describe, expect, it } from 'vitest';
import { displayCalendarUrl } from './useDisplayCalendar';

describe('displayCalendarUrl', () => {
  it('prefixes the host kiosk base URL', () => {
    expect(
      displayCalendarUrl('/api', {
        displayId: 'abc',
        calendarIds: 'cal1',
        daysAhead: 30,
      })
    ).toBe('/api/display-calendar?displayId=abc&calendarIds=cal1&daysAhead=30');
  });
});
