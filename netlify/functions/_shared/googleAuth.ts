export interface GoogleTokenInfo {
  aud: string;
  sub: string;
  email?: string;
  exp?: string;
}

function extractBearerToken(authHeader?: string): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  return authHeader.slice(7);
}

export async function verifyGoogleToken(accessToken: string): Promise<GoogleTokenInfo> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
  if (!res.ok) {
    throw new Error('Invalid token');
  }

  const data = (await res.json()) as GoogleTokenInfo;
  if (data.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Token audience mismatch');
  }
  return data;
}

export async function verifyGoogleTokenFromHeader(authHeader?: string): Promise<GoogleTokenInfo> {
  const token = extractBearerToken(authHeader);
  return verifyGoogleToken(token);
}

export async function requireGoogleId(authHeader?: string): Promise<string> {
  const tokenInfo = await verifyGoogleTokenFromHeader(authHeader);
  return tokenInfo.sub;
}
