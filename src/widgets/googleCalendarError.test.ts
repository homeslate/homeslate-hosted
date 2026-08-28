import { describe, expect, it } from 'vitest';
import {
  DISPLAY_OWNER_SIGN_IN_MESSAGE,
  displayCalendarEmptyDetail,
  shouldShowGoogleCalendarErrorAlert,
} from './googleCalendarError';

describe('displayCalendarEmptyDetail', () => {
  it('shows the server error on the display so the real failure is visible', () => {
    expect(displayCalendarEmptyDetail('Refresh token exchange failed: invalid_grant')).toBe(
      'Refresh token exchange failed: invalid_grant'
    );
  });

  it('omits a duplicate of the friendly owner sign-in copy', () => {
    expect(displayCalendarEmptyDetail(DISPLAY_OWNER_SIGN_IN_MESSAGE)).toBeUndefined();
  });
});

describe('shouldShowGoogleCalendarErrorAlert', () => {
  it('hides token-expired alerts in display mode', () => {
    expect(
      shouldShowGoogleCalendarErrorAlert('Token expired. Please sign in again.', true)
    ).toBe(false);
  });
});
