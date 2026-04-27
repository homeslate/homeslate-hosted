import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb, displayConfigs, displays } from '../../src/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function isDebugEnabled(event: Parameters<Handler>[0]): boolean {
  const queryDebug = event.queryStringParameters?.debug === '1';
  const envDebug = process.env.DEBUG_DISPLAY === '1';
  return queryDebug || envDebug;
}

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

function stripLegacyThemeFields(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config;
  const {
    theme: _t,
    themeDocuments: _td,
    activeThemeDocumentId: _atd,
    ...rest
  } = config as Record<string, unknown>;
  void _t;
  void _td;
  void _atd;
  return rest;
}

// Public endpoint — returns the display config for a given display_id (public polling UUID).
// If the display has a passcode set, the caller must supply ?passcode=<4-digit-pin>.
// Returns { passcodeRequired: true } (HTTP 401) when passcode is missing/wrong.
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const displayId = event.queryStringParameters?.id;
  const debug = isDebugEnabled(event);
  if (!displayId) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({
        error: 'Missing display id',
        ...(debug ? { debug: { missingDisplayId: true } } : {}),
      }),
    };
  }

  const db = getDb();

  try {
    const [row] = await db
      .select({
        config: displayConfigs.config,
        updatedAt: displayConfigs.updatedAt,
        passcodeHash: displays.passcodeHash,
      })
      .from(displayConfigs)
      .innerJoin(displays, eq(displays.id, displayConfigs.displayId))
      .where(eq(displays.displayId, displayId));

    if (!row) {
      if (debug) {
        console.info('display debug: config not found', { displayId });
      }
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ config: null }),
      };
    }

    const { config, updatedAt, passcodeHash } = row;

    if (passcodeHash) {
      const provided = event.queryStringParameters?.passcode;
      if (!provided || hashPin(provided) !== passcodeHash) {
        if (debug) {
          console.info('display debug: passcode required or mismatch', {
            displayId,
            hasPasscode: true,
            passcodeProvided: !!provided,
          });
        }
        return {
          statusCode: 401,
          headers: CORS,
          body: JSON.stringify({
            passcodeRequired: true,
            ...(debug
              ? {
                  debug: {
                    hasPasscode: true,
                    passcodeProvided: !!provided,
                  },
                }
              : {}),
          }),
        };
      }
    }

    if (debug) {
      console.info('display debug: config served', {
        displayId,
        hasPasscode: !!passcodeHash,
      });
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ config: stripLegacyThemeFields(config), updated_at: updatedAt }),
    };
  } catch (err) {
    console.error('Display fetch error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        error: 'Server error',
        ...(debug ? { debug: { displayId } } : {}),
      }),
    };
  }
};
