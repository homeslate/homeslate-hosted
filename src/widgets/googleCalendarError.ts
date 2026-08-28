export const DISPLAY_OWNER_SIGN_IN_MESSAGE =
  'Calendar will appear when the display owner signs in with Google in the app.';

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
