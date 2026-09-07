import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  optimizeDeps: {
    // Excluded packages are served as-is, so their CommonJS dependencies must still be
    // pre-bundled to get ESM default exports.
    include: [
      // Reached only through linked workspace packages, so the startup scan misses them.
      // Listing them avoids a runtime re-optimization that reloads the page.
      "zod",
      "ai",
      "@openrouter/ai-sdk-provider",
      "@orpc/contract",
      "@orpc/client",
      "@orpc/client/fetch",
      "@automerge/automerge-repo > eventemitter3",
      "@automerge/automerge-repo > bs58check",
      "@automerge/automerge-repo > debug",
      "@automerge/automerge-repo > fast-sha256",
    ],
    // Pre-bundling would create a second copy of the Automerge WASM wrapper next to the one
    // reached through the workspace packages; initializing it twice throws at startup.
    exclude: [
      "@automerge/automerge",
      "@automerge/automerge-repo",
      "@automerge/automerge-repo-storage-indexeddb",
      "@automerge/automerge-repo-network-broadcastchannel",
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
    // The API is a separate process (apps/api). Same-origin in dev through this proxy.
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
  build: {
    target: "es2024",
    sourcemap: true,
  },
});
