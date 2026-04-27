import { describe, it, expect } from "vitest";
import { DEFAULT_THEME_DOCUMENTS } from "./defaults";
import { validateThemeDocument } from "./themeDocumentValidation";
import { resolveTheme } from "./resolver";

describe("DEFAULT_THEME_DOCUMENTS — validation", () => {
  for (const doc of DEFAULT_THEME_DOCUMENTS) {
    it(`validates: ${doc.name}`, () => {
      const result = validateThemeDocument(doc);
      if (!result.ok) {
        throw new Error(
          `${doc.name} failed validation: ${JSON.stringify(result.issues, null, 2)}`,
        );
      }
      expect(result.ok).toBe(true);
    });
  }
});

describe("DEFAULT_THEME_DOCUMENTS — resolveTheme snapshots", () => {
  for (const doc of DEFAULT_THEME_DOCUMENTS) {
    for (const mode of ["dark", "light"] as const) {
      it(`resolves: ${doc.name} (${mode})`, () => {
        const resolved = resolveTheme(doc, mode);
        expect(resolved).toMatchSnapshot();
      });
    }
  }
});