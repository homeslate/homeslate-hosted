import type { MantineColorsTuple, MantineThemeOverride } from "@mantine/core";
import type { ResolvedTheme } from "./resolvedTypes";

function spreadHexShadesFrom(
  palette: Record<string, string>,
): MantineColorsTuple {
  const ordered = [
    "50",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ];
  const shades = ordered
    .map((k) => palette[k])
    .filter((v): v is string => typeof v === "string");
  if (shades.length === 10) return shades as unknown as MantineColorsTuple;

  const seed = palette["500"] ?? Object.values(palette)[0] ?? "#6366f1";
  return Array.from(
    { length: 10 },
    (_, i) => palette[ordered[i]] ?? seed,
  ) as unknown as MantineColorsTuple;
}

export function mantineThemeFromResolved(
  resolved: ResolvedTheme,
): MantineThemeOverride {
  return {
    primaryColor: "brand",
    colors: {
      brand: spreadHexShadesFrom(resolved.foundation.color.brand),
    },
    fontFamily: resolved.foundation.typography.family.base,
    fontFamilyMonospace: resolved.foundation.typography.family.mono,
    radius: {
      sm: resolved.foundation.radius.sm,
      md: resolved.foundation.radius.md,
      lg: resolved.foundation.radius.lg,
    },
    headings: {
      fontFamily:
        resolved.foundation.typography.family.display ??
        resolved.foundation.typography.family.base,
    },
  };
}