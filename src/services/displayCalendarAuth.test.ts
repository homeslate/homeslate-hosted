import { describe, expect, it } from 'vitest';
import { GoogleAuthError } from '@homeslate/google';
import {
  classifyRefreshFailure,
  describeTokenRow,
  extractRows,
  isFatalGoogleAuthFailure,
  normalizeTokenRow,
  summarizeTokenCandidates,
  userTokenPersistFields,
} from './displayCalendarAuth';

describe('extractRows', () => {
  it('returns an array result as-is', () => {
    const rows = [{ user_id: 'abc' }];
    expect(extractRows(rows)).toEqual(rows);
  });

  it('reads drizzle/neon { rows } results', () => {
    const rows = [{ user_id: 'abc' }];
    expect(extractRows({ rows, rowCount: 1 })).toEqual(rows);
  });

  it('returns empty for unexpected shapes', () => {
    expect(extractRows(null)).toEqual([]);
    expect(extractRows({ rowCount: 1 })).toEqual([]);
  });
});

describe('normalizeTokenRow', () => {
  it('reads snake_case columns from raw SQL', () => {
    expect(
      normalizeTokenRow({
        user_id: 'u1',
        refresh_token: 'rt',
        access_token: 'at',
        access_token_expires_at: '2026-08-22T17:38:57.000Z',
      })
    ).toEqual({
      user_id: 'u1',
      refresh_token: 'rt',
      access_token: 'at',
      access_token_expires_at: '2026-08-22T17:38:57.000Z',
    });
  });

  it('reads camelCase columns from drizzle selects', () => {
    expect(
      normalizeTokenRow({
        userId: 'u1',
        refreshToken: 'rt',
        accessToken: 'at',
        accessTokenExpiresAt: '2026-08-22T17:38:57.000Z',
      })
    ).toEqual({
      user_id: 'u1',
      refresh_token: 'rt',
      access_token: 'at',
      access_token_expires_at: '2026-08-22T17:38:57.000Z',
    });
  });

  it('returns null when user id is missing', () => {
    expect(normalizeTokenRow({ refresh_token: 'rt' })).toBeNull();
  });
});

describe('describeTokenRow', () => {
  it('reports expired access tokens without leaking secrets', () => {
    const described = describeTokenRow(
      {
        user_id: 'u1',
        refresh_token: 'secret-refresh',
        access_token: 'secret-access',
        access_token_expires_at: '2026-08-22T17:38:57.000Z',
      },
      Date.parse('2026-08-27T00:00:00.000Z')
    );

    expect(described).toEqual({
      hasRefreshToken: true,
      hasAccessToken: true,
      accessTokenUnexpired: false,
      refreshTokenLength: 14,
    });
    expect(JSON.stringify(described)).not.toContain('secret');
  });
});

describe('summarizeTokenCandidates', () => {
  it('counts owner and collaborator tokens', () => {
    expect(
      summarizeTokenCandidates(
        [
          {
            user_id: 'owner',
            refresh_token: 'rt',
            access_token: null,
            access_token_expires_at: null,
            source: 'owner',
          },
          {
            user_id: 'collab',
            refresh_token: null,
            access_token: 'at',
            access_token_expires_at: '2099-01-01T00:00:00.000Z',
            source: 'collaborator',
          },
        ],
        Date.parse('2026-08-27T00:00:00.000Z')
      )
    ).toEqual({
      ownerCandidates: 1,
      collaboratorCandidates: 1,
      hasAnyRefreshToken: true,
      hasAnyAccessToken: true,
      hasUnexpiredAccessToken: true,
    });
  });
});

describe('classifyRefreshFailure', () => {
  it('detects missing oauth credentials', () => {
    expect(classifyRefreshFailure(new Error('Missing Google OAuth credentials'))).toBe(
      'missing_oauth_credentials'
    );
  });

  it('detects invalid_grant', () => {
    expect(
      classifyRefreshFailure(new Error('Refresh token exchange failed: invalid_grant'))
    ).toBe('invalid_grant');
  });

  it('detects Google expired-or-revoked refresh tokens', () => {
    expect(
      classifyRefreshFailure(
        new Error('Refresh token exchange failed: Token has been expired or revoked.')
      )
    ).toBe('token_revoked');
  });

  it('treats expired-or-revoked as more specific than invalid_grant', () => {
    expect(
      classifyRefreshFailure(
        new Error('Refresh token exchange failed: invalid_grant: Token has been expired or revoked.')
      )
    ).toBe('token_revoked');
  });

  it('falls back to refresh_failed', () => {
    expect(classifyRefreshFailure(new Error('network down'))).toBe('refresh_failed');
  });

  it('reads GoogleAuthError codes', () => {
    expect(classifyRefreshFailure(new GoogleAuthError('invalid_grant', 'nope'))).toBe(
      'invalid_grant'
    );
    expect(classifyRefreshFailure(new GoogleAuthError('token_revoked', 'nope'))).toBe(
      'token_revoked'
    );
    expect(classifyRefreshFailure(new GoogleAuthError('missing_tokens', 'nope'))).toBe(
      'refresh_failed'
    );
  });
});

describe('userTokenPersistFields', () => {
  it('captures a rotated refresh token when Google returns one', () => {
    expect(
      userTokenPersistFields(
        {
          access_token: 'new-access',
          expires_in: 3600,
          refresh_token: 'rotated-refresh',
        },
        Date.parse('2026-08-31T00:00:00.000Z')
      )
    ).toEqual({
      accessToken: 'new-access',
      expiresAt: '2026-08-31T01:00:00.000Z',
      rotatedRefreshToken: 'rotated-refresh',
    });
  });

  it('leaves refresh token unchanged when Google does not rotate it', () => {
    expect(
      userTokenPersistFields(
        { access_token: 'new-access', expires_in: 3600 },
        Date.parse('2026-08-31T00:00:00.000Z')
      ).rotatedRefreshToken
    ).toBeNull();
  });
});

describe('isFatalGoogleAuthFailure', () => {
  it('treats revoked and invalid_grant as fatal', () => {
    expect(isFatalGoogleAuthFailure('token_revoked')).toBe(true);
    expect(isFatalGoogleAuthFailure('invalid_grant')).toBe(true);
    expect(isFatalGoogleAuthFailure('refresh_failed')).toBe(false);
  });
});
