export const DISPLAY_OWNER_SIGN_IN_MESSAGE =
  'Calendar will appear when the display owner signs in with Google in the app.';

export const DISPLAY_GOOGLE_RECONNECT_MESSAGE =
  'Google access expired. Sign in with Google in the Homeslate app to restore the calendar.';

export function displayCalendarUserMessage(
  error: string | null,
  reason?: string | null
): string {
  if (reason === 'token_revoked' || reason === 'invalid_grant') {
    return DISPLAY_GOOGLE_RECONNECT_MESSAGE;
  }
  return error ?? DISPLAY_OWNER_SIGN_IN_MESSAGE;
}

export function displayCalendarEmptyDetail(error: string | null): string | undefined {
  if (!error) return undefined;
  if (error === DISPLAY_OWNER_SIGN_IN_MESSAGE) return undefined;
  return error;
}

export function shouldShowGoogleCalendarErrorAlert(
  error: string | null,
  isDisplayMode: boolean
): boolean {
  if (!error) return false;
  if (isDisplayMode && error === 'Token expired. Please sign in again.') return false;
  return true;
}

export function isFatalGoogleAuthFailure(reason: string | null | undefined): boolean {
  return reason === 'invalid_grant' || reason === 'token_revoked';
}

export function displayCalendarUrl(
  kioskFetchBaseUrl: string,
  params: URLSearchParams | string
): string {
  return `${kioskFetchBaseUrl}/display-calendar?${params}`;
}
