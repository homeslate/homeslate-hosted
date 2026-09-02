import '@homeslate/widgets/schemas';
import { validateDisplayDocument, type DisplayDocument } from '@homeslate/schema';
import { InvalidDisplayDocumentError } from './types';

export { InvalidDisplayDocumentError } from './types';

export function assertValidDisplayDocument(raw: unknown): DisplayDocument {
  const result = validateDisplayDocument(raw);
  if (!result.ok) throw new InvalidDisplayDocumentError(result.errors);
  return result.document;
}
