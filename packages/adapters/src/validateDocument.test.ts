import { describe, expect, it } from 'vitest';
import { assertValidDisplayDocument, InvalidDisplayDocumentError } from './validateDocument';
import { createEmptyDisplayDocument } from './emptyDocument';

describe('assertValidDisplayDocument', () => {
  it('returns a migrated document when valid', () => {
    const document = assertValidDisplayDocument(createEmptyDisplayDocument());
    expect(document.schemaVersion).toBe(1);
  });

  it('throws InvalidDisplayDocumentError when views is not an array', () => {
    expect(() =>
      assertValidDisplayDocument({ schemaVersion: 1, name: 'x', views: 'nope' }),
    ).toThrow(InvalidDisplayDocumentError);
  });
});
