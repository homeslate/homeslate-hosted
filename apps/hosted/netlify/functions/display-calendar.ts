import type { Handler } from '@netlify/functions';
import {
  listCalendarsWithAccessToken,
  listEventsWithAccessToken,
} from '@homeslate/google';
import { getDb } from '../../src/db';
import { errorMessage } from '../../src/services/displayCalendarAuth';
import { DISPLAY_CALENDAR_DAYS_BACK_DEFAULT, displayCalendarWindow } from '../../src/services/displayCalendarWindow';
import { resolveDisplayCalendarToken } from '../../src/services/resolveDisplayCalendarToken';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const LOG_PREFIX = '[display-calendar]';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const displayId = event.queryStringParameters?.displayId;
  const calendarIdsParam = event.queryStringParameters?.calendarIds;
  const daysAhead = Math.min(90, Math.max(1, parseInt(event.queryStringParameters?.daysAhead ?? '30', 10) || 30));
  const daysBack = Math.min(
    90,
    Math.max(
      0,
      parseInt(event.queryStringParameters?.daysBack ?? String(DISPLAY_CALENDAR_DAYS_BACK_DEFAULT), 10)
        || DISPLAY_CALENDAR_DAYS_BACK_DEFAULT
    )
  );

  if (!displayId || !calendarIdsParam) {
    console.warn(`${LOG_PREFIX} missing query params`, {
      hasDisplayId: !!displayId,
      hasCalendarIds: !!calendarIdsParam,
    });
    return json(400, { error: 'Missing displayId or calendarIds', reason: 'missing_params' });
  }

  const calendarIds = calendarIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
  if (calendarIds.length === 0) {
    return json(200, { events: [], calendars: [] });
  }

  console.info(`${LOG_PREFIX} request`, {
    displayId,
    calendarCount: calendarIds.length,
    daysAhead,
    daysBack,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  });

  const db = getDb();

  try {
    const tokenResult = await resolveDisplayCalendarToken(db, displayId, LOG_PREFIX);
    if (!tokenResult.ok) {
      return json(tokenResult.failure.statusCode, tokenResult.failure.body);
    }

    const { accessToken, source: chosenSource } = tokenResult.value;
    const { timeMin, timeMax } = displayCalendarWindow(daysAhead, daysBack);

    let calendars;
    try {
      calendars = await listCalendarsWithAccessToken(accessToken);
    } catch (err) {
      console.error(`${LOG_PREFIX} calendar list failed`, {
        displayId,
        error: errorMessage(err),
      });
      return json(502, {
        error: 'Failed to fetch calendar list',
        reason: 'calendar_list_failed',
      });
    }

    const allEvents = await listEventsWithAccessToken(accessToken, {
      calendarIds,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      calendarList: calendars,
      maxResults: 2500,
    });

    const calendarMap = new Map(calendars.map((calendar) => [calendar.id, calendar]));
    const calendarsForClient = calendarIds.map((id) => {
      const c = calendarMap.get(id);
      return { id, summary: c?.summary ?? id, backgroundColor: c?.backgroundColor };
    });

    console.info(`${LOG_PREFIX} success`, {
      displayId,
      source: chosenSource,
      eventCount: allEvents.length,
      calendarCount: calendarsForClient.length,
    });

    return json(200, { events: allEvents, calendars: calendarsForClient });
  } catch (err) {
    console.error(`${LOG_PREFIX} server error`, { displayId, error: errorMessage(err) });
    return json(500, { error: 'Server error', reason: 'server_error' });
  }
};
