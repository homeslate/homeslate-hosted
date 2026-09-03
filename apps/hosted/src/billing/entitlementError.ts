export type EntitlementErrorCode = 'display_limit' | 'view_limit';

export class EntitlementError extends Error {
  readonly code: EntitlementErrorCode;

  constructor(code: EntitlementErrorCode, message: string) {
    super(message);
    this.name = 'EntitlementError';
    this.code = code;
  }
}
