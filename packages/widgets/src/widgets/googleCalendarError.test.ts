import { describe, expect, it } from 'vitest';
import {
  DISPLAY_GOOGLE_RECONNECT_MESSAGE,
  DISPLAY_OWNER_SIGN_IN_MESSAGE,
  displayCalendarEmptyDetail,
  displayCalendarUserMessage,
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

describe('displayCalendarUserMessage', () => {
  it('asks the owner to reconnect when Google revoked the refresh token', () => {
    expect(displayCalendarUserMessage('raw error', 'token_revoked')).toBe(
      DISPLAY_GOOGLE_RECONNECT_MESSAGE
    );
  });

  it('asks the owner to reconnect on invalid_grant', () => {
    expect(displayCalendarUserMessage('raw error', 'invalid_grant')).toBe(
      DISPLAY_GOOGLE_RECONNECT_MESSAGE
    );
  });

  it('keeps the original error for other failures', () => {
    expect(displayCalendarUserMessage('Failed to fetch calendar list', 'calendar_list_failed')).toBe(
      'Failed to fetch calendar list'
    );
  });
});

describe('shouldShowGoogleCalendarErrorAlert', () => {
  it('hides token-expired alerts in display mode', () => {
    expect(
      shouldShowGoogleCalendarErrorAlert('Token expired. Please sign in again.', true)
    ).toBe(false);
  });
});
