import type { ApiClient } from "@archefict/contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

/**
 * Typed client for the API. Same origin: Vite proxies /api in dev, and production
 * serves both from one host. Every call can fail when the app runs without a server,
 * and callers must treat that as normal (local-only mode is a feature).
 */
const link = new RPCLink({
  url: new URL("/api/rpc", window.location.origin).href,
});

export const api: ApiClient = createORPCClient(link);
