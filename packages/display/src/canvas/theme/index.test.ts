import { describe, it, expect } from "vitest";
import { pickActiveDocument, DEFAULT_THEME_DOCUMENTS } from "./defaults";

const A = { ...DEFAULT_THEME_DOCUMENTS[0], id: "doc_a" };
const B = { ...DEFAULT_THEME_DOCUMENTS[1], id: "doc_b" };

describe("pickActiveDocument fallback chain", () => {
  it("returns the bundled default when themes is empty and activeId is null", () => {
    const picked = pickActiveDocument([], null);
    expect(picked).toBe(DEFAULT_THEME_DOCUMENTS[0]);
  });

  it("returns themes[0] when activeId does not match any entry", () => {
    const picked = pickActiveDocument([A, B], "doc_missing");
    expect(picked.id).toBe("doc_a");
  });

  it("returns the matching entry when activeId is found", () => {
    const picked = pickActiveDocument([A, B], "doc_b");
    expect(picked.id).toBe("doc_b");
  });

  it("returns themes[0] when activeId is null but themes is non-empty", () => {
    const picked = pickActiveDocument([A, B], null);
    expect(picked.id).toBe("doc_a");
  });
});