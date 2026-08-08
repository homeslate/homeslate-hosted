type JsonRecord = Record<string, unknown>;

export type HttpHeaders = Record<string, string>;

const BASE_CORS_HEADERS: HttpHeaders = {
  'Access-Control-Allow-Origin': '*',
};

export const PUBLIC_JSON_HEADERS: HttpHeaders = {
  ...BASE_CORS_HEADERS,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const AUTH_JSON_HEADERS: HttpHeaders = {
  ...BASE_CORS_HEADERS,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Refresh-Token',
  'Content-Type': 'application/json',
};

export function optionsResponse(headers: HttpHeaders): { statusCode: number; headers: HttpHeaders; body: string } {
  return { statusCode: 204, headers, body: '' };
}

export function jsonResponse(
  statusCode: number,
  payload: unknown,
  headers: HttpHeaders
): { statusCode: number; headers: HttpHeaders; body: string } {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

export function errorResponse(
  statusCode: number,
  message: string,
  headers: HttpHeaders,
  details?: JsonRecord
): { statusCode: number; headers: HttpHeaders; body: string } {
  return jsonResponse(statusCode, { error: message, ...(details ?? {}) }, headers);
}
