const ACCESS_TOKEN_SAFETY_MS = 60_000;

export interface TokenRow {
  user_id: string;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
}

export interface TokenCandidate extends TokenRow {
  source: 'owner' | 'collaborator';
}

export interface TokenRowSummary {
  hasRefreshToken: boolean;
  hasAccessToken: boolean;
  accessTokenUnexpired: boolean;
  refreshTokenLength: number;
}

export interface TokenCandidateSummary {
  ownerCandidates: number;
  collaboratorCandidates: number;
  hasAnyRefreshToken: boolean;
  hasAnyAccessToken: boolean;
  hasUnexpiredAccessToken: boolean;
}

export type RefreshFailureReason =
  | 'missing_oauth_credentials'
  | 'invalid_grant'
  | 'refresh_failed';

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === 'object' &&
    'rows' in result &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export function normalizeTokenRow(row: Record<string, unknown>): TokenRow | null {
  const userId = asNonEmptyString(row.user_id ?? row.userId);
  if (!userId) return null;
  return {
    user_id: userId,
    refresh_token: asNonEmptyString(row.refresh_token ?? row.refreshToken),
    access_token: asNonEmptyString(row.access_token ?? row.accessToken),
    access_token_expires_at: asNonEmptyString(
      row.access_token_expires_at ?? row.accessTokenExpiresAt
    ),
  };
}

export function isAccessTokenUnexpired(expiresAt: string | null, nowMs: number): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > nowMs + ACCESS_TOKEN_SAFETY_MS;
}

export function describeTokenRow(row: TokenRow, nowMs: number = Date.now()): TokenRowSummary {
  return {
    hasRefreshToken: !!row.refresh_token,
    hasAccessToken: !!row.access_token,
    accessTokenUnexpired: isAccessTokenUnexpired(row.access_token_expires_at, nowMs),
    refreshTokenLength: row.refresh_token?.length ?? 0,
  };
}

export function summarizeTokenCandidates(
  candidates: TokenCandidate[],
  nowMs: number = Date.now()
): TokenCandidateSummary {
  return {
    ownerCandidates: candidates.filter((c) => c.source === 'owner').length,
    collaboratorCandidates: candidates.filter((c) => c.source === 'collaborator').length,
    hasAnyRefreshToken: candidates.some((c) => !!c.refresh_token),
    hasAnyAccessToken: candidates.some((c) => !!c.access_token),
    hasUnexpiredAccessToken: candidates.some((c) =>
      isAccessTokenUnexpired(c.access_token_expires_at, nowMs)
    ),
  };
}

export function classifyRefreshFailure(err: unknown): RefreshFailureReason {
  const message = err instanceof Error ? err.message : String(err);
  if (/Missing Google OAuth credentials/i.test(message)) return 'missing_oauth_credentials';
  if (/invalid_grant/i.test(message)) return 'invalid_grant';
  return 'refresh_failed';
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
