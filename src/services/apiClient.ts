type PrimitiveQuery = string | number | boolean;
type QueryValue = PrimitiveQuery | null | undefined;
type QueryRecord = Record<string, QueryValue>;

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly details?: unknown;

  constructor(message: string, status: number, url: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.details = details;
  }
}

interface RequestOptions<TBody> {
  token?: string | null;
  headers?: HeadersInit;
  query?: QueryRecord;
  body?: TBody;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: QueryRecord): string {
  if (!query || Object.keys(query).length === 0) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
}

function getAuthToken(explicitToken?: string | null): string | null {
  if (explicitToken) return explicitToken;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gcal_access_token');
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function getErrorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const msg = record.error ?? record.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (typeof payload === 'string' && payload.trim()) return payload;
  return `Request failed (${status})`;
}

async function request<TResponse, TBody = undefined>(
  method: string,
  path: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const token = getAuthToken(options.token);
  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const hasJsonBody = options.body !== undefined && !(options.body instanceof FormData);
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    signal: options.signal,
    body:
      options.body === undefined
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
  });

  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new ApiError(getErrorMessage(response.status, payload), response.status, path, payload);
  }

  return payload as TResponse;
}

export const apiClient = {
  get<TResponse>(path: string, options?: RequestOptions<undefined>) {
    return request<TResponse, undefined>('GET', path, options);
  },
  post<TResponse, TBody = unknown>(path: string, options?: RequestOptions<TBody>) {
    return request<TResponse, TBody>('POST', path, options);
  },
  patch<TResponse, TBody = unknown>(path: string, options?: RequestOptions<TBody>) {
    return request<TResponse, TBody>('PATCH', path, options);
  },
  put<TResponse, TBody = unknown>(path: string, options?: RequestOptions<TBody>) {
    return request<TResponse, TBody>('PUT', path, options);
  },
  delete<TResponse>(path: string, options?: RequestOptions<undefined>) {
    return request<TResponse, undefined>('DELETE', path, options);
  },
};
