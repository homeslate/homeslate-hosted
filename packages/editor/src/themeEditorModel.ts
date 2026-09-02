import type { ColorMode, ThemeDocument } from "@homeslate/schema";

export type EditableTokenType = "color" | "fontFamily" | "dimension";

export interface EditableTokenEntry {
  label: string;
  tokenPath: string[];
  referencePath: string;
  type: EditableTokenType;
  value: string;
}

export type ColorTokenEntry = EditableTokenEntry & { type: "color" };

export interface ReferenceOption {
  label: string;
  value: string;
}

export type ColorReferenceOption = ReferenceOption;

export interface WidgetTokenSection {
  id: string;
  title: string;
  description: string;
  entries: EditableTokenEntry[];
}

interface WidgetTokenSectionDef {
  id: string;
  title: string;
  description: string;
  paths?: readonly string[];
  prefixes?: readonly string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEditableToken(value: unknown, types: readonly EditableTokenType[]): value is { $type: EditableTokenType; $value: string } {
  return isRecord(value) && types.includes(value.$type as EditableTokenType) && typeof value.$value === "string";
}

function titleize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLabel(path: string[]): string {
  return path.map(titleize).join(" / ");
}

const KEBAB_RE = /([a-z0-9])([A-Z])/g;

function kebab(value: string): string {
  return value.replace(KEBAB_RE, "$1-$2").toLowerCase();
}

export function tokenCssVarName(referencePath: string): string {
  const path = referencePath.split(".");
  if (path[0] === "foundation" && path[1] === "typography") {
    if (path[2] === "family") {
      const tail = path.slice(3);
      return `--token-font${tail.length ? `-${tail.map(kebab).join("-")}` : ""}`;
    }
    if (path[2] === "lineHeight") {
      return `--token-line-height-${path.slice(3).map(kebab).join("-")}`;
    }
    return `--token-font-${kebab(path[2])}-${path.slice(3).map(kebab).join("-")}`;
  }
  if (path[0] === "foundation" && path[1] === "zIndex") {
    return `--token-z-${path.slice(2).map(kebab).join("-")}`;
  }
  const stripped =
    path[0] === "foundation" ||
    path[0] === "semantic" ||
    path[0] === "components"
      ? path.slice(1)
      : path;
  return `--token-${stripped.map(kebab).join("-")}`;
}

const WIDGET_TOKEN_SECTION_DEFS: readonly WidgetTokenSectionDef[] = [
  {
    id: "widget",
    title: "Widget component",
    description: "Direct widget container tokens: card background, border, radius, padding, and shadow.",
    paths: [
      "components.widget.background",
      "components.widget.borderColor",
      "components.widget.borderWidth",
      "components.widget.radius",
      "components.widget.shadow",
      "components.widget.padding",
    ],
  },
  {
    id: "surfaces",
    title: "Surfaces and borders",
    description: "Shared surfaces and border colors used inside widget content, overlays, lists, and cards.",
    paths: [
      "semantic.surface.canvas",
      "semantic.surface.sunken",
      "semantic.surface.card",
      "semantic.surface.overlay",
      "semantic.border.subtle",
      "semantic.border.default",
      "semantic.border.strong",
      "semantic.focus.ring",
    ],
  },
  {
    id: "text",
    title: "Text and typography",
    description: "Primary widget text, muted labels, inverse text over media, links, and font families.",
    paths: [
      "semantic.text.primary",
      "semantic.text.muted",
      "semantic.text.inverse",
      "semantic.text.link",
      "foundation.typography.family.base",
      "foundation.typography.family.mono",
    ],
  },
  {
    id: "brand-status",
    title: "Brand, status, and interactions",
    description: "Accent colors, status chips, buttons, hover states, and live/current indicators.",
    prefixes: [
      "foundation.color.brand.",
      "foundation.color.success.",
      "foundation.color.warning.",
      "foundation.color.danger.",
      "foundation.color.info.",
      "semantic.status.",
      "semantic.interactive.",
    ],
  },
  {
    id: "shape",
    title: "Shape and spacing",
    description: "Foundation radius and spacing tokens that widget modules use for density and layout rhythm.",
    prefixes: ["foundation.radius.", "foundation.spacing."],
  },
] as const;

function matchesSection(entry: EditableTokenEntry, section: WidgetTokenSectionDef) {
  if (section.paths?.includes(entry.referencePath)) return true;
  if (section.prefixes?.some((prefix) => entry.referencePath.startsWith(prefix))) return true;
  return false;
}

function matchesQuery(entry: EditableTokenEntry, query: string) {
  if (!query) return true;
  const haystack = `${entry.label} ${entry.referencePath} ${tokenCssVarName(entry.referencePath)} ${entry.value}`.toLowerCase();
  return haystack.includes(query);
}

function walkEditableTokens(
  node: unknown,
  tokenPath: string[],
  referencePath: string[],
  types: readonly EditableTokenType[],
  out: EditableTokenEntry[],
): void {
  if (isEditableToken(node, types)) {
    out.push({
      label: formatLabel(referencePath),
      tokenPath,
      referencePath: referencePath.join("."),
      type: node.$type,
      value: node.$value,
    });
    return;
  }

  if (!isRecord(node)) return;

  for (const [key, value] of Object.entries(node)) {
    walkEditableTokens(value, [...tokenPath, key], [...referencePath, key], types, out);
  }
}

export function getEditableTokenEntries(
  doc: ThemeDocument,
  mode: ColorMode,
  types: readonly EditableTokenType[] = ["color", "fontFamily", "dimension"],
): EditableTokenEntry[] {
  const entries: EditableTokenEntry[] = [];

  walkEditableTokens(
    doc.tokens.foundation,
    ["tokens", "foundation"],
    ["foundation"],
    types,
    entries,
  );
  walkEditableTokens(
    doc.tokens.modes[mode].semantic,
    ["tokens", "modes", mode, "semantic"],
    ["semantic"],
    types,
    entries,
  );
  if (doc.tokens.modes[mode].components) {
    walkEditableTokens(
      doc.tokens.modes[mode].components,
      ["tokens", "modes", mode, "components"],
      ["components"],
      types,
      entries,
    );
  }

  return entries;
}

export function getColorTokenEntries(doc: ThemeDocument, mode: ColorMode): ColorTokenEntry[] {
  return getEditableTokenEntries(doc, mode, ["color"]) as ColorTokenEntry[];
}

export function getWidgetTokenSections(entries: EditableTokenEntry[], query = ""): WidgetTokenSection[] {
  const normalizedQuery = query.trim().toLowerCase();
  const used = new Set<string>();

  return WIDGET_TOKEN_SECTION_DEFS.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    entries: entries.filter((entry) => {
      if (used.has(entry.referencePath)) return false;
      if (!matchesSection(entry, section)) return false;
      if (!matchesQuery(entry, normalizedQuery)) return false;
      used.add(entry.referencePath);
      return true;
    }),
  })).filter((section) => section.entries.length > 0);
}

export function buildReferenceOptions(
  doc: ThemeDocument,
  mode: ColorMode,
  type: EditableTokenType,
  excludeReferencePath?: string,
): ReferenceOption[] {
  return getEditableTokenEntries(doc, mode, [type])
    .filter((entry) => entry.referencePath !== excludeReferencePath)
    .map((entry) => ({
      label: `${entry.label} (${entry.value})`,
      value: `{${entry.referencePath}}`,
    }));
}

export function buildColorReferenceOptions(
  doc: ThemeDocument,
  mode: ColorMode,
  excludeReferencePath?: string,
): ColorReferenceOption[] {
  return buildReferenceOptions(doc, mode, "color", excludeReferencePath);
}

export function setTokenValue(
  doc: ThemeDocument,
  tokenPath: string[],
  value: string,
  expectedType?: EditableTokenType,
): ThemeDocument {
  const next = structuredClone(doc) as ThemeDocument;
  let cursor: unknown = next;

  for (const segment of tokenPath) {
    if (!isRecord(cursor)) {
      throw new Error(`Invalid theme token path: ${tokenPath.join(".")}`);
    }
    cursor = cursor[segment];
  }

  if (!isRecord(cursor) || typeof cursor.$type !== "string" || !("$value" in cursor)) {
    throw new Error(`Theme token path is not an editable token: ${tokenPath.join(".")}`);
  }
  if (expectedType && cursor.$type !== expectedType) {
    throw new Error(`Theme token path is not a ${expectedType} token: ${tokenPath.join(".")}`);
  }

  cursor.$value = value;
  return next;
}

export function setColorTokenValue(
  doc: ThemeDocument,
  tokenPath: string[],
  value: string,
): ThemeDocument {
  return setTokenValue(doc, tokenPath, value, "color");
}
