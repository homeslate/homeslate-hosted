import { describe, expect, it } from "vitest";
import { getPresetById } from "@homeslate/display/canvas";
import {
  buildReferenceOptions,
  buildColorReferenceOptions,
  getEditableTokenEntries,
  getColorTokenEntries,
  getWidgetTokenSections,
  tokenCssVarName,
  setTokenValue,
  setColorTokenValue,
} from "./themeEditorModel";

describe("theme editor model", () => {
  it("lists editable foundation and mode color tokens", () => {
    const doc = getPresetById("theme_cosmos");
    const entries = getColorTokenEntries(doc, "dark");

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Foundation / Color / Brand / 500",
          referencePath: "foundation.color.brand.500",
          value: "#6366f1",
        }),
        expect.objectContaining({
          label: "Semantic / Surface / Canvas",
          referencePath: "semantic.surface.canvas",
          value: expect.stringContaining("#0a0a0f"),
        }),
        expect.objectContaining({
          label: "Components / Widget / Background",
          referencePath: "components.widget.background",
          value: expect.stringContaining("rgba("),
        }),
      ])
    );
  });

  it("builds reference options for foundation and the selected mode", () => {
    const doc = getPresetById("theme_cosmos");
    const options = buildColorReferenceOptions(doc, "dark", "semantic.text.link");

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Foundation / Color / Brand / 500 (#6366f1)",
          value: "{foundation.color.brand.500}",
        }),
        expect.objectContaining({
          label: "Semantic / Surface / Card (rgba(30, 30, 40, 0.6))",
          value: "{semantic.surface.card}",
        }),
        expect.objectContaining({
          label: "Foundation / Color / Red / 500 (oklch(63.7% 0.237 25.331))",
          value: "{foundation.color.red.500}",
        }),
      ])
    );
    expect(options).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "{semantic.text.link}" }),
        expect.objectContaining({ value: "{modes.light.semantic.surface.card}" }),
      ])
    );
  });

  it("updates a color token value without mutating the original document", () => {
    const doc = getPresetById("theme_cosmos");
    const updated = setColorTokenValue(doc, ["tokens", "modes", "dark", "semantic", "text", "link"], "#ff00aa");

    expect(updated.tokens.modes.dark.semantic.text.link.$value).toBe("#ff00aa");
    expect(doc.tokens.modes.dark.semantic.text.link.$value).toBe("{foundation.color.brand.500}");
    expect(updated.tokens.modes.light.semantic.text.link.$value).toBe("{foundation.color.brand.500}");
  });

  it("lists editable font family and dimension tokens", () => {
    const doc = getPresetById("theme_cosmos");
    const entries = getEditableTokenEntries(doc, "dark", ["fontFamily", "dimension"]);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "fontFamily",
          label: "Foundation / Typography / Family / Base",
          referencePath: "foundation.typography.family.base",
          value: "'Outfit', 'Inter', sans-serif",
        }),
        expect.objectContaining({
          type: "dimension",
          label: "Foundation / Radius / Md",
          referencePath: "foundation.radius.md",
          value: "10px",
        }),
        expect.objectContaining({
          type: "dimension",
          label: "Components / Widget / Border Width",
          referencePath: "components.widget.borderWidth",
          value: "1px",
        }),
      ])
    );
  });

  it("builds type-aware reference options", () => {
    const doc = getPresetById("theme_cosmos");
    const dimensionOptions = buildReferenceOptions(doc, "dark", "dimension", "components.widget.radius");
    const fontOptions = buildReferenceOptions(doc, "dark", "fontFamily");

    expect(dimensionOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Foundation / Radius / Md (10px)",
          value: "{foundation.radius.md}",
        }),
      ])
    );
    expect(dimensionOptions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "{components.widget.radius}" }),
        expect.objectContaining({ value: "{foundation.typography.family.base}" }),
      ])
    );
    expect(fontOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "{foundation.typography.family.base}" }),
      ])
    );
  });

  it("updates non-color token values without mutating the original document", () => {
    const doc = getPresetById("theme_cosmos");
    const withFont = setTokenValue(doc, ["tokens", "foundation", "typography", "family", "base"], "'Aptos', sans-serif", "fontFamily");
    const withRadius = setTokenValue(doc, ["tokens", "modes", "dark", "components", "widget", "radius"], "{foundation.radius.lg}", "dimension");

    expect(withFont.tokens.foundation.typography.family.base.$value).toBe("'Aptos', sans-serif");
    expect(doc.tokens.foundation.typography.family.base.$value).toBe("'Outfit', 'Inter', sans-serif");
    expect(withRadius.tokens.modes.dark.components?.widget?.radius?.$value).toBe("{foundation.radius.lg}");
    expect(doc.tokens.modes.dark.components?.widget?.radius?.$value).toBe("12px");
  });

  it("groups widget-impacting tokens by editable token family", () => {
    const doc = getPresetById("theme_cosmos");
    const sections = getWidgetTokenSections(getEditableTokenEntries(doc, "dark"));

    expect(sections.map((section) => section.id)).toEqual([
      "widget",
      "surfaces",
      "text",
      "brand-status",
      "shape",
    ]);
    expect(sections[0]).toEqual(
      expect.objectContaining({
        title: "Widget component",
        entries: expect.arrayContaining([
          expect.objectContaining({ referencePath: "components.widget.background" }),
          expect.objectContaining({ referencePath: "components.widget.borderColor" }),
          expect.objectContaining({ referencePath: "components.widget.padding" }),
        ]),
      }),
    );
    expect(sections.find((section) => section.id === "text")?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ referencePath: "semantic.text.primary" }),
        expect.objectContaining({ referencePath: "semantic.text.muted" }),
      ]),
    );
  });

  it("filters widget token sections by label, path, and CSS variable", () => {
    const doc = getPresetById("theme_cosmos");
    const entries = getEditableTokenEntries(doc, "dark");

    expect(getWidgetTokenSections(entries, "muted")).toEqual([
      expect.objectContaining({
        id: "text",
        entries: [expect.objectContaining({ referencePath: "semantic.text.muted" })],
      }),
    ]);

    expect(getWidgetTokenSections(entries, "--token-widget-border-color")).toEqual([
      expect.objectContaining({
        id: "widget",
        entries: [expect.objectContaining({ referencePath: "components.widget.borderColor" })],
      }),
    ]);
  });

  it("formats generated CSS variable names for token paths", () => {
    expect(tokenCssVarName("components.widget.borderColor")).toBe("--token-widget-border-color");
    expect(tokenCssVarName("semantic.text.primary")).toBe("--token-text-primary");
    expect(tokenCssVarName("foundation.typography.family.base")).toBe("--token-font-base");
    expect(tokenCssVarName("foundation.radius.md")).toBe("--token-radius-md");
  });
});
