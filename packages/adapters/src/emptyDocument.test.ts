import { describe, expect, it } from 'vitest';
import { createEmptyDisplayDocument } from './emptyDocument';
import { validateDisplayDocument } from '@homeslate/schema';

describe('createEmptyDisplayDocument', () => {
  it('returns a v1 document that validates', () => {
    const document = createEmptyDisplayDocument('Kitchen');
    expect(document.schemaVersion).toBe(1);
    expect(document.name).toBe('Kitchen');
    expect(document.views).toHaveLength(1);
    expect(document.views[0].name).toBe('Main');
    expect(document.activeViewId).toBe(document.views[0].id);
    expect(validateDisplayDocument(document).ok).toBe(true);
  });
});
