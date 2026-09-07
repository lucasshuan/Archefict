import { contract } from "@archefict/contract";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { type ApiContext, router } from "./router.ts";

/**
 * One contract, three doors:
 *   /api/rpc/*        the web app's typed client
 *   /api/*            plain HTTP per the contract's routes, for plugins and tools later
 *   /api/openapi.json the document describing the second door
 *
 * No CORS on purpose: in dev the web app proxies /api to this server, in production
 * they share an origin. Cross-origin access is a decision for the plugin phase.
 */
export function createApp(context: ApiContext): Hono {
  const app = new Hono();
  app.use(secureHeaders());

  const rpc = new RPCHandler(router);
  const rest = new OpenAPIHandler(router);
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  app.get("/api/openapi.json", async (c) =>
    c.json(
      await generator.generate(contract, {
        info: { title: "Archefict API", version: context.version },
        servers: [{ url: "/api" }],
      }),
    ),
  );

  app.use("/api/rpc/*", async (c, next) => {
    const { matched, response } = await rpc.handle(c.req.raw, {
      prefix: "/api/rpc",
      context,
    });
    if (matched) return c.newResponse(response.body, response);
    await next();
  });

  app.use("/api/*", async (c, next) => {
    const { matched, response } = await rest.handle(c.req.raw, { prefix: "/api", context });
    if (matched) return c.newResponse(response.body, response);
    await next();
  });

  return app;
}
