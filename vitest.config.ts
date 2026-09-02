/// <reference types="vitest" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    alias: {
      "@homeslate/schema": fileURLToPath(
        new URL("./packages/schema/src/index.ts", import.meta.url)
      ),
      "@homeslate/google": fileURLToPath(
        new URL("./packages/google/src/index.ts", import.meta.url)
      ),
      "@homeslate/widgets/schemas": fileURLToPath(
        new URL("./packages/widgets/src/schemas.ts", import.meta.url)
      ),
      "@homeslate/widgets": fileURLToPath(
        new URL("./packages/widgets/src/index.ts", import.meta.url)
      ),
      "@homeslate/display/canvas": fileURLToPath(
        new URL("./packages/display/src/canvas/index.ts", import.meta.url)
      ),
      "@homeslate/display": fileURLToPath(
        new URL("./packages/display/src/index.ts", import.meta.url)
      ),
      "@homeslate/editor": fileURLToPath(
        new URL("./packages/editor/src/index.ts", import.meta.url)
      ),
    },
  },
  plugins: [react()],
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "packages/schema/src/**/*.test.ts",
      "packages/google/src/**/*.test.ts",
      "packages/widgets/src/**/*.test.ts",
      "packages/display/src/**/*.test.ts",
      "packages/editor/src/**/*.test.ts",
    ],
    globals: false,
    css: false,
  },
});
