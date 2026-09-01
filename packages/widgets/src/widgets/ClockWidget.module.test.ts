import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const cssPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "ClockWidget.module.css",
);

const css = readFileSync(cssPath, "utf8");

function ruleFor(selector: string) {
  const match = css.match(new RegExp(`${selector}\\s*\\{(?<body>[^}]*)\\}`));
  return match?.groups?.body ?? "";
}

describe("ClockWidget.module.css", () => {
  it("renders the clock time with plain text color", () => {
    const timeRule = ruleFor("\\.time");

    expect(timeRule).toContain("color: var(--token-text-primary)");
    expect(timeRule).not.toMatch(/background\s*:/);
    expect(timeRule).not.toContain("-webkit-text-fill-color: transparent");
    expect(timeRule).not.toContain("background-clip: text");
  });
});
