import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const widgetsDir = dirname(fileURLToPath(import.meta.url));

const cssFiles = readdirSync(widgetsDir)
  .filter((file) => file.endsWith(".module.css"))
  .sort();

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("widget CSS theme tokens", () => {
  it("does not reference malformed or library-private theme tokens", () => {
    const offenders = cssFiles.flatMap((file) => {
      const css = stripComments(readFileSync(join(widgetsDir, file), "utf8"));
      const matches = css.match(/--token-[\w-]*\$[\w-]*|--mantine-(?:color|radius)-[\w-]+/g) ?? [];
      return matches.map((match) => `${file}: ${match}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps widget color styling on theme-provided tokens", () => {
    const literalColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*(?!var\(--token-)[^)]+\)|(?:^|[\s,(])(?:white|black)(?=[\s,);]|$)/g;

    const offenders = cssFiles.flatMap((file) => {
      const css = stripComments(readFileSync(join(widgetsDir, file), "utf8"));
      return css
        .split("\n")
        .filter((line) => line.includes(":"))
        .flatMap((line) => {
          const value = line.slice(line.indexOf(":") + 1);
          const matches = value.match(literalColorPattern) ?? [];
          return matches.map((match) => `${file}: ${match.trim()}`);
        });
    });

    expect(offenders).toEqual([]);
  });
});
