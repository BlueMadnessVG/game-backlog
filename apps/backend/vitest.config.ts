import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts", "modules/**/*.ts", "providers/**/*.ts"],
      exclude: [
        "db/**",
        "index.ts",
        "config.ts",
        "drizzle.config.ts",
        "middleware/**",
        "**/__tests__/**",
        "**/*.test.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
