import { describe, expect, it } from 'vitest';
import { GOOGLE_OAUTH_SCOPES } from './googleOAuthScopes';

describe('GOOGLE_OAUTH_SCOPES', () => {
  it('requests calendar and Photos Picker, not the retired Photos Library scopes', () => {
    expect(GOOGLE_OAUTH_SCOPES).toContain('https://www.googleapis.com/auth/calendar');
    expect(GOOGLE_OAUTH_SCOPES).toContain(
      'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
    );
    expect(GOOGLE_OAUTH_SCOPES).not.toContain('photoslibrary');
  });
});
