import type { ModelCatalogue } from "@archefict/contract";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

const catalogue: ModelCatalogue = {
  models: [
    {
      id: "anthropic/claude-haiku-4.5",
      name: "Claude Haiku 4.5",
      contextLength: 200000,
      pricing: { input: 1, output: 5 },
      tools: true,
    },
  ],
  fetchedAt: 1_000,
};

const app = createApp({
  catalogue: { list: async () => catalogue },
  version: "test",
});

describe("api", () => {
  it("answers health over plain HTTP", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, version: "test" });
  });

  it("serves the model catalogue over plain HTTP", async () => {
    const response = await app.request("/api/models");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(catalogue);
  });

  it("serves the same procedure over the RPC door", async () => {
    const response = await app.request("/api/rpc/models/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { json: ModelCatalogue };
    expect(body.json.models[0]?.id).toBe("anthropic/claude-haiku-4.5");
  });

  it("publishes an OpenAPI document that lists both routes", async () => {
    const response = await app.request("/api/openapi.json");
    expect(response.status).toBe(200);
    const spec = (await response.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(spec.paths).sort()).toEqual(["/health", "/models"]);
  });

  it("falls through for unknown paths", async () => {
    const response = await app.request("/api/nope");
    expect(response.status).toBe(404);
  });
});
