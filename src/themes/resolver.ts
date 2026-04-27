import type { ColorMode, ResolvedTheme, ThemeOverride } from "../types/theme";
import type { ThemeDocument } from "./themeDocumentValidation";

const ALIAS_RE = /^\{([\w.]+)\}$/;
const MAX_DEPTH = 8;

export class ThemeResolutionError extends Error {
  readonly path: string;
  readonly reason: "cycle" | "missing" | "depth" | "cross-mode";
  readonly trace?: string[];

  constructor(
    path: string,
    reason: "cycle" | "missing" | "depth" | "cross-mode",
    trace?: string[],
  ) {
    super(
      `Theme resolution failed at "${path}": ${reason}${trace ? ` (trace: ${trace.join(" → ")})` : ""}`,
    );
    this.name = "ThemeResolutionError";
    this.path = path;
    this.reason = reason;
    this.trace = trace;
  }
}

type Json = unknown;

function isPlainObject(v: unknown): v is Record<string, Json> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getPath(root: Record<string, Json>, path: string[]): Json {
  let cur: Json = root;
  for (const seg of path) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function deepMerge<T extends Record<string, Json>>(
  target: T,
  source: Record<string, Json>,
): T {
  const out = { ...target } as Record<string, Json>;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

interface ResolveContext {
  doc: ThemeDocument;
  mode: ColorMode;
  modeBlock: Record<string, Json>;
}

function resolveAlias(
  expression: string,
  ctx: ResolveContext,
  trace: string[],
  reportingPath: string,
): Json {
  if (trace.length > MAX_DEPTH) {
    throw new ThemeResolutionError(reportingPath, "depth", trace);
  }

  const m = ALIAS_RE.exec(expression);
  if (!m) return expression;

  const targetPath = m[1].split(".");
  if (trace.includes(expression)) {
    throw new ThemeResolutionError(reportingPath, "cycle", [
      ...trace,
      expression,
    ]);
  }

  if (
    targetPath[0] === "modes" &&
    targetPath[1] &&
    targetPath[1] !== ctx.mode
  ) {
    throw new ThemeResolutionError(reportingPath, "cross-mode", [
      ...trace,
      expression,
    ]);
  }

  let targetNode: Json;
  if (targetPath[0] === "foundation") {
    targetNode = getPath(
      ctx.doc.tokens.foundation as Record<string, Json>,
      targetPath.slice(1),
    );
  } else if (targetPath[0] === "modes") {
    targetNode = getPath(ctx.modeBlock, targetPath.slice(2));
  } else if (targetPath[0] === "semantic" || targetPath[0] === "components") {
    targetNode = getPath(ctx.modeBlock, targetPath);
  } else {
    targetNode = undefined;
  }

  if (targetNode === undefined) {
    throw new ThemeResolutionError(reportingPath, "missing", [
      ...trace,
      expression,
    ]);
  }

  if (isPlainObject(targetNode) && "$value" in targetNode) {
    const v = targetNode.$value;
    if (typeof v === "string" && ALIAS_RE.test(v)) {
      return resolveAlias(v, ctx, [...trace, expression], reportingPath);
    }
    return v;
  }

  return targetNode;
}

function unwrap(node: Json, ctx: ResolveContext, reportingPath: string): Json {
  if (!isPlainObject(node)) return node;
  if ("$value" in node) {
    const v = node.$value;
    if (typeof v === "string" && ALIAS_RE.test(v)) {
      return resolveAlias(v, ctx, [], reportingPath);
    }
    return v;
  }
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = unwrap(
      value,
      ctx,
      reportingPath ? `${reportingPath}.${key}` : key,
    );
  }
  return out;
}

export function resolveTheme(
  doc: ThemeDocument,
  mode: ColorMode,
  overrides?: ThemeOverride[],
): ResolvedTheme {
  const baseModeBlock = doc.tokens.modes[mode] as unknown as Record<
    string,
    Json
  >;

  let modeBlock = baseModeBlock;
  if (overrides && overrides.length > 0) {
    for (const override of overrides) {
      modeBlock = deepMerge(
        modeBlock,
        override as unknown as Record<string, Json>,
      );
    }
  }

  const ctx: ResolveContext = { doc, mode, modeBlock };

  const foundation = unwrap(
    doc.tokens.foundation,
    ctx,
    "foundation",
  ) as ResolvedTheme["foundation"];
  const semantic = unwrap(
    modeBlock.semantic,
    ctx,
    "semantic",
  ) as ResolvedTheme["semantic"];
  const components = modeBlock.components
    ? (unwrap(
        modeBlock.components,
        ctx,
        "components",
      ) as ResolvedTheme["components"])
    : undefined;

  return {
    foundation,
    semantic,
    components,
    meta: { id: doc.id, name: doc.name, mode },
  };
}