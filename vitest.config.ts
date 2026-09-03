/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: [
      "apps/hosted/src/**/*.test.ts",
      "apps/hosted/src/**/*.test.tsx",
      "apps/hosted/netlify/functions/**/*.test.ts",
    ],
    globals: false,
    css: false,
  },
});
