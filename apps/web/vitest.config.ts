import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

// Component tests run in a real Chromium. The sandbox, iframe and WASM code that
// arrives later cannot be tested in a DOM emulation, so we do not start with one.
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Browser mode runs in Chromium; this only stops vite-plugin-solid from requesting jsdom.
    environment: "node",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
