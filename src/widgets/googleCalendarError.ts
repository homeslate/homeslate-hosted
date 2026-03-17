export function shouldShowGoogleCalendarErrorAlert(
  error: string | null,
  isDisplayMode: boolean
): boolean {
  if (!error) return false;
  if (isDisplayMode && error === 'Token expired. Please sign in again.') return false;
  return true;
}
