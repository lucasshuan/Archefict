import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  optimizeDeps: {
    // Excluded packages are served as-is, so their CommonJS dependencies must still be
    // pre-bundled to get ESM default exports.
    include: [
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
  },
  build: {
    target: "es2024",
    sourcemap: true,
  },
});
