const ALLOWED_PHOTO_URL = /^https:\/\/(lh\d+\.googleusercontent\.com|photos\.googleapis\.com)\//;

export function assertAllowedPhotoUrl(baseUrl: string): void {
  if (!ALLOWED_PHOTO_URL.test(baseUrl)) {
    throw new Error('URL not allowed');
  }
}

export async function fetchPhotoWithAccessToken(
  accessToken: string,
  params: { baseUrl: string; size: string }
): Promise<Uint8Array> {
  assertAllowedPhotoUrl(params.baseUrl);
  const res = await fetch(`${params.baseUrl}=${params.size}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google Photos fetch failed: ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
