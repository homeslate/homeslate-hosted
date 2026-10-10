import { eq } from 'drizzle-orm';
import { isGoogleAuthError } from '@homeslate/google';
import type { Db } from '../db';
import { displays, users, displayCollaborators } from '../db';
import {
  classifyRefreshFailure,
  describeTokenRow,
  errorMessage,
  isAccessTokenUnexpired,
  isFatalGoogleAuthFailure,
  normalizeTokenRow,
  summarizeTokenCandidates,
  type TokenCandidate,
} from './displayCalendarAuth';
import { DISPLAY_GOOGLE_RECONNECT_MESSAGE } from '@homeslate/widgets';
import { createHostedGoogleClient } from '../../netlify/functions/_shared/googleClient';
import { createNeonTokenStore } from '../../netlify/functions/_shared/neonTokenStore';

export interface ResolvedDisplayCalendarToken {
  accessToken: string;
  userId: string;
  source: TokenCandidate['source'];
}

export interface DisplayCalendarTokenFailure {
  statusCode: number;
  body: {
    error: string;
    reason: string;
    details?: unknown;
  };
}

export type ResolveDisplayCalendarTokenResult =
  | { ok: true; value: ResolvedDisplayCalendarToken }
  | { ok: false; failure: DisplayCalendarTokenFailure };

export async function resolveDisplayCalendarToken(
  db: Db,
  displayId: string,
  logPrefix: string
): Promise<ResolveDisplayCalendarTokenResult> {
  const ownerSelect = await db
    .select({
      userId: users.id,
      refreshToken: users.refreshToken,
      accessToken: users.accessToken,
      accessTokenExpiresAt: users.accessTokenExpiresAt,
    })
    .from(displays)
    .innerJoin(users, eq(users.id, displays.userId))
    .where(eq(displays.displayId, displayId))
    .limit(1);

  const ownerRow = ownerSelect[0] ? normalizeTokenRow(ownerSelect[0] as Record<string, unknown>) : null;
  if (ownerSelect[0] && !ownerRow) {
    console.warn(`${logPrefix} owner row did not normalize`, {
      displayId,
      keys: Object.keys(ownerSelect[0]),
    });
  }

  let collaboratorSelect: Array<Record<string, unknown>> = [];
  try {
    collaboratorSelect = (await db
      .select({
        userId: users.id,
        refreshToken: users.refreshToken,
        accessToken: users.accessToken,
        accessTokenExpiresAt: users.accessTokenExpiresAt,
      })
      .from(displays)
      .innerJoin(displayCollaborators, eq(displayCollaborators.displayId, displays.id))
      .innerJoin(users, eq(users.id, displayCollaborators.userId))
      .where(eq(displays.displayId, displayId))) as Array<Record<string, unknown>>;
  } catch (err) {
    console.warn(`${logPrefix} collaborator lookup skipped`, { error: errorMessage(err) });
  }

  const tokenCandidates: TokenCandidate[] = [
    ...(ownerRow ? [{ ...ownerRow, source: 'owner' as const }] : []),
    ...collaboratorSelect.flatMap((row) => {
      const normalized = normalizeTokenRow(row);
      return normalized ? [{ ...normalized, source: 'collaborator' as const }] : [];
    }),
  ];

  const tokenSummary = summarizeTokenCandidates(tokenCandidates);
  console.info(`${logPrefix} token candidates`, {
    displayId,
    ...tokenSummary,
    owner: ownerRow ? describeTokenRow(ownerRow) : null,
  });

  const refreshFailures: Array<{ source: TokenCandidate['source']; reason: string; error: string }> = [];
  const tokenStore = createNeonTokenStore(db);
  let client: ReturnType<typeof createHostedGoogleClient> | null = null;
  try {
    client = createHostedGoogleClient(tokenStore);
  } catch (err) {
    console.warn(`${logPrefix} google client unavailable`, { error: errorMessage(err) });
    refreshFailures.push({
      source: 'owner',
      reason: classifyRefreshFailure(err),
      error: errorMessage(err),
    });
  }

  let token: string | null = null;
  let chosenUserId: string | null = null;
  let chosenSource: TokenCandidate['source'] | null = null;

  for (const candidate of tokenCandidates) {
    if (client) {
      try {
        token = await client.getAccessToken(candidate.user_id);
        chosenUserId = candidate.user_id;
        chosenSource = candidate.source;
        console.info(`${logPrefix} token selected via client`, {
          displayId,
          source: candidate.source,
        });
        break;
      } catch (err) {
        const reason = classifyRefreshFailure(err);
        const error = errorMessage(err);
        console.error(`${logPrefix} refresh failed`, {
          displayId,
          source: candidate.source,
          reason,
          error,
          googleAuth: isGoogleAuthError(err) ? err.code : undefined,
        });
        refreshFailures.push({ source: candidate.source, reason, error });
      }
    }

    if (!token && candidate.access_token && isAccessTokenUnexpired(candidate.access_token_expires_at, Date.now())) {
      token = candidate.access_token;
      chosenUserId = candidate.user_id;
      chosenSource = candidate.source;
      console.info(`${logPrefix} using unexpired access token fallback`, {
        displayId,
        source: candidate.source,
      });
      break;
    }
  }

  if (!token || !chosenUserId || !chosenSource) {
    const reason = refreshFailures[0]?.reason
      ?? (tokenSummary.ownerCandidates === 0 ? 'display_not_found' : 'no_usable_token');
    const details = {
      ...tokenSummary,
      refreshFailures,
    };
    console.warn(`${logPrefix} no usable token`, { displayId, reason, ...details });
    return {
      ok: false,
      failure: {
        statusCode: 404,
        body: {
          error: isFatalGoogleAuthFailure(reason)
            ? DISPLAY_GOOGLE_RECONNECT_MESSAGE
            : 'A display owner or linked collaborator needs to sign in from the management app to refresh calendar access',
          reason,
          details,
        },
      },
    };
  }

  console.info(`${logPrefix} token selected`, { displayId, source: chosenSource });

  return {
    ok: true,
    value: {
      accessToken: token,
      userId: chosenUserId,
      source: chosenSource,
    },
  };
}
