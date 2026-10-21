import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@components": path.resolve(rootDir, "src/components"),
      "@lib": path.resolve(rootDir, "src/lib"),
      "@server": path.resolve(rootDir, "src/server"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    esbuild: {
      jsx: "automatic",
    },
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
