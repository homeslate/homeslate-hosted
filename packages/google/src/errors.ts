export type GoogleAuthErrorCode =
  | 'invalid_grant'
  | 'token_revoked'
  | 'missing_tokens'
  | 'refresh_failed';

export class GoogleAuthError extends Error {
  readonly code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

export function isGoogleAuthError(err: unknown): err is GoogleAuthError {
  return err instanceof GoogleAuthError;
}
