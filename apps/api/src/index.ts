import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createModelCatalogue } from "./models.ts";

const port = Number(process.env["PORT"] ?? 8787);
const hostname = process.env["HOST"] ?? "127.0.0.1";

const app = createApp({
  catalogue: createModelCatalogue({ fetch: globalThis.fetch }),
  version: process.env["npm_package_version"] ?? "0.0.0",
});

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`api listening on http://${info.address}:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    process.exit(0);
  });
}
