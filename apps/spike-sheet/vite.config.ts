import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/**
 * Same Automerge handling as apps/web: the WASM wrapper must exist once, so every package
 * that reaches it is served as-is rather than pre-bundled, and their CommonJS dependencies
 * are pre-bundled by name so they still arrive as ESM.
 *
 * ProseMirror is the opposite case. Its packages compare node instances by class identity,
 * so the binding and the app must share one prosemirror-model. The binding is therefore
 * pre-bundled together with the ProseMirror packages (Automerge stays external to that
 * bundle, being excluded), and `dedupe` pins every ProseMirror import to one copy. Served
 * raw, the binding resolved its own copy and every edit failed with "multiple versions of
 * prosemirror-model were loaded".
 */
export default defineConfig({
  plugins: [solid()],
  optimizeDeps: {
    include: [
      "@automerge/automerge-repo > eventemitter3",
      "@automerge/automerge-repo > bs58check",
      "@automerge/automerge-repo > debug",
      "@automerge/automerge-repo > fast-sha256",
      "@automerge/prosemirror",
    ],
    exclude: [
      "@automerge/automerge",
      "@automerge/automerge-repo",
      "@automerge/automerge-repo-storage-indexeddb",
      "@automerge/automerge-repo-network-broadcastchannel",
    ],
  },
  resolve: {
    dedupe: ["prosemirror-model", "prosemirror-state", "prosemirror-view", "prosemirror-transform"],
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
