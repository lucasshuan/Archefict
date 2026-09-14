import { defineConfig } from "vitest/config";

/**
 * Its own config, not the app's: vite.config.ts carries the Solid plugin, which pulls a DOM
 * and a testing-library setup in behind it. What is tested here is plain logic — search,
 * formatting — so it runs in node with no plugins at all. A component test would need the
 * plugin back, and a config that says so.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
