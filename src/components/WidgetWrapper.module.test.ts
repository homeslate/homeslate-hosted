import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cssPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "WidgetWrapper.module.css",
);

const css = readFileSync(cssPath, "utf8");

function ruleFor(selector: string) {
  const match = css.match(new RegExp(`${selector}\\s*\\{(?<body>[^}]*)\\}`));
  return match?.groups?.body ?? "";
}

describe("WidgetWrapper.module.css", () => {
  it("uses widget component tokens for wrapper border width and radius", () => {
    const wrapperRule = ruleFor("\\.wrapper");

    expect(wrapperRule).toContain("border: var(--token-widget-border-width");
    expect(wrapperRule).toContain("solid var(--token-widget-border-color");
    expect(wrapperRule).toContain("border-radius: var(--token-widget-radius");
  });
});
