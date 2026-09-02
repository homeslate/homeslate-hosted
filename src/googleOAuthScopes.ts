/**
 * Scopes requested in the live GIS OAuth code flow.
 * Must stay a strict string match with Google Cloud Console Data Access.
 *
 * Photos Library (`photoslibrary.readonly` / `.readonly.originals`) is not
 * used: the Photos Library API was shut down for this access pattern in 2025.
 * Homeslate uses the Photos Picker instead.
 */
export const GOOGLE_OAUTH_SCOPES =
  'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
