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
      "@homeslate/widgets": fileURLToPath(
        new URL("./packages/widgets/src/index.ts", import.meta.url)
      ),
      "@homeslate/widgets/schemas": fileURLToPath(
        new URL("./packages/widgets/src/schemas.ts", import.meta.url)
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
    ],
    globals: false,
    css: false,
  },
});
