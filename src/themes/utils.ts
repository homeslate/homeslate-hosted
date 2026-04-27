import type { CSSProperties } from "react";
import type { ResolvedTheme } from "../types/theme";

export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

interface BackgroundImageConfig {
  backgroundImage?: string;
  backgroundImageSize?: "cover" | "contain" | "tile";
  backgroundOverlayOpacity?: number;
}

export function getBackgroundStyle(
  config: BackgroundImageConfig,
): CSSProperties {
  if (!config.backgroundImage) return {};
  const opacity = config.backgroundOverlayOpacity ?? 0.5;
  const size =
    config.backgroundImageSize === "tile"
      ? "auto"
      : (config.backgroundImageSize ?? "cover");
  const repeat = config.backgroundImageSize === "tile" ? "repeat" : "no-repeat";
  return {
    background: `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), url(${config.backgroundImage}) center/${size} ${repeat}`,
  };
}

const KEBAB_RE = /([a-z0-9])([A-Z])/g;
function kebab(s: string): string {
  return s.replace(KEBAB_RE, "$1-$2").toLowerCase();
}

function varName(path: string[]): string {
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

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function walk(
  node: unknown,
  path: string[],
  out: Record<string, string>,
): void {
  if (node === undefined || node === null) return;
  if (isObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      walk(value, [...path, key], out);
    }
    return;
  }
  if (path[0] === "meta") return;
  out[varName(path)] = String(node);
}

export function themeToVars(resolved: ResolvedTheme): Record<string, string> {
  const out: Record<string, string> = {};
  walk(resolved.foundation, ["foundation"], out);
  walk(resolved.semantic, ["semantic"], out);
  if (resolved.components) walk(resolved.components, ["components"], out);

  const brand500 = resolved.foundation.color.brand["500"];
  if (brand500 && brand500.startsWith("#")) {
    const rgb = hexToRgb(brand500);
    if (rgb)
      out["--token-color-brand-500-rgb"] = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  }
  out["--token-glow"] = resolved.semantic.focus.ring;

  return out;
}