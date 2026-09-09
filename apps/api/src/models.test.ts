import { describe, expect, it } from "vitest";
import { createModelCatalogue, parseModels } from "./models.ts";

const sample = [
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Anthropic: Claude Haiku 4.5",
    context_length: 200000,
    architecture: { output_modalities: ["text"] },
    pricing: { prompt: "0.000001", completion: "0.000005" },
    supported_parameters: ["max_tokens", "tools", "tool_choice"],
  },
  {
    id: "tencent/hy-mt2-7b",
    name: "Tencent: Hunyuan MT 7B",
    context_length: 32768,
    architecture: { output_modalities: ["text"] },
    pricing: { prompt: "0.0000001", completion: "0.0000002" },
    supported_parameters: ["max_tokens", "temperature"],
  },
  {
    id: "google/gemini-3.1-flash-image",
    name: "Image only",
    context_length: 65536,
    architecture: { output_modalities: ["image"] },
    pricing: { prompt: "0.0000005", completion: "0.000003" },
  },
  { id: "broken/no-pricing", name: "No prices", context_length: 1 },
  { id: "not-a-model-id", name: "Bad id", pricing: { prompt: "0", completion: "0" } },
];

describe("parseModels", () => {
  it("keeps text models with prices, converted to USD per million, and notes tool support", () => {
    const models = parseModels(sample);
    expect(models).toEqual([
      {
        id: "anthropic/claude-haiku-4.5",
        name: "Anthropic: Claude Haiku 4.5",
        contextLength: 200000,
        pricing: { input: 1, output: 5 },
        tools: true,
      },
      {
        id: "tencent/hy-mt2-7b",
        name: "Tencent: Hunyuan MT 7B",
        contextLength: 32768,
        pricing: { input: 0.1, output: 0.2 },
        tools: false,
      },
    ]);
  });

  it("assumes tool support when the provider lists no parameters at all", () => {
    const [model] = parseModels([
      { id: "x/y", name: "Y", context_length: 8, pricing: { prompt: "0", completion: "0" } },
    ]);
    expect(model?.tools).toBe(true);
  });

  it("returns nothing for a malformed payload", () => {
    expect(parseModels({ nope: true })).toEqual([]);
  });
});

describe("createModelCatalogue", () => {
  function fakeFetch(calls: { count: number }): typeof fetch {
    return async () => {
      calls.count += 1;
      return new Response(JSON.stringify({ data: sample }), {
        headers: { "content-type": "application/json" },
      });
    };
  }

  it("fetches once and serves from cache until the ttl passes", async () => {
    const calls = { count: 0 };
    let clock = 1_000;
    const catalogue = createModelCatalogue({
      fetch: fakeFetch(calls),
      now: () => clock,
      ttlMs: 100,
    });

    const first = await catalogue.list();
    const second = await catalogue.list();
    expect(calls.count).toBe(1);
    expect(second).toBe(first);
    expect(first.fetchedAt).toBe(1_000);

    clock = 1_200;
    const third = await catalogue.list();
    expect(calls.count).toBe(2);
    expect(third.fetchedAt).toBe(1_200);
  });

  it("coalesces concurrent loads into one request", async () => {
    const calls = { count: 0 };
    const catalogue = createModelCatalogue({ fetch: fakeFetch(calls) });
    await Promise.all([catalogue.list(), catalogue.list(), catalogue.list()]);
    expect(calls.count).toBe(1);
  });

  it("surfaces a provider failure instead of caching it", async () => {
    const catalogue = createModelCatalogue({
      fetch: async () => new Response("nope", { status: 503 }),
    });
    await expect(catalogue.list()).rejects.toThrow(/503/);
  });
});
