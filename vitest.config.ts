import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    /* Explicitly exclude Playwright specs — defense-in-depth so *.spec.ts
       never bleeds into the Vitest run even if someone widens the include. */
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    passWithNoTests: true,
  },
});
