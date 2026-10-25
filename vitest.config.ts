import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Components use the automatic JSX runtime (Next compiles them itself; tests need to be told).
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // Server code is tested in Node; component tests opt in with `// @vitest-environment jsdom`.
    environment: "node",
    restoreMocks: true,
  },
});
