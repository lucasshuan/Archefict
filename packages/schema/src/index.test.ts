import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AiSettings, ModelId, NarrativeEntry } from "./index.ts";

const entryArb = fc.record({
  id: fc.uuid(),
  kind: fc.constantFrom("user", "ai", "system"),
  text: fc.string(),
  createdAt: fc.nat(),
  provenance: fc.record(
    {
      source: fc.constantFrom("user", "ai", "system"),
      model: fc.constantFrom("anthropic/claude-haiku-4.5", "openai/gpt-5-mini"),
      turnId: fc.uuid(),
    },
    { requiredKeys: ["source"] },
  ),
});

describe("NarrativeEntry", () => {
  it("survives a JSON round-trip for any generated entry", () => {
    fc.assert(
      fc.property(entryArb, (entry) => {
        const parsed = NarrativeEntry.parse(JSON.parse(JSON.stringify(entry)));
        expect(parsed).toEqual(entry);
      }),
    );
  });

  it("rejects an empty id", () => {
    expect(() =>
      NarrativeEntry.parse({
        id: "",
        kind: "user",
        text: "x",
        createdAt: 0,
        provenance: { source: "user" },
      }),
    ).toThrow();
  });
});

describe("ModelId", () => {
  it("accepts provider/model with variants", () => {
    expect(ModelId.parse("anthropic/claude-haiku-4.5")).toBe("anthropic/claude-haiku-4.5");
    expect(ModelId.parse("anthropic/claude-sonnet-5:batch")).toBe(
      "anthropic/claude-sonnet-5:batch",
    );
  });

  it("rejects ids without a provider", () => {
    expect(() => ModelId.parse("claude-haiku-4.5")).toThrow();
  });
});

describe("AiSettings", () => {
  it("parses a settings record and drops fields it no longer knows", () => {
    const settings = AiSettings.parse({
      apiKey: "",
      narratorModel: "anthropic/claude-haiku-4.5",
      backgroundModel: "openai/gpt-5-mini",
      systemPrompt: "Narrate.",
    });

    expect(settings.narratorModel).toBe("anthropic/claude-haiku-4.5");
    expect(settings).not.toHaveProperty("backgroundModel");
  });

  it("rejects a model id without a provider", () => {
    const result = AiSettings.safeParse({
      apiKey: "",
      narratorModel: "claude-haiku-4.5",
      systemPrompt: "Narrate.",
    });
    expect(result.success).toBe(false);
  });
});
