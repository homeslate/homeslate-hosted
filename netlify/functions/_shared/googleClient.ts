import { createGoogleClient, type GoogleClient, type TokenStore } from '@homeslate/google';

export function googleOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials');
  }
  return { clientId, clientSecret };
}

export function createHostedGoogleClient(tokenStore: TokenStore): GoogleClient {
  return createGoogleClient({ ...googleOAuthCredentials(), tokenStore });
}
