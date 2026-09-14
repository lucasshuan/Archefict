import type { ModelInfo } from "@archefict/contract";
import { describe, expect, it } from "vitest";
import { highlightParts, rankModels, scoreModel, words } from "./model-search.ts";

function model(id: string, name: string, tools = true): ModelInfo {
  return {
    id,
    name,
    contextLength: 128_000,
    pricing: { input: 1, output: 2 },
    tools,
  };
}

const GLM_FLASH = model("z-ai/glm-4.6-flash", "Z.AI: GLM 4.6 Flash");
const GLM_AIR = model("z-ai/glm-4.5-air", "Z.AI: GLM 4.5 Air");
const HAIKU = model("anthropic/claude-haiku-4.5", "Anthropic: Claude Haiku 4.5");
const GEMINI_FLASH = model("google/gemini-3.8-flash", "Google: Gemini 3.8 Flash");
const CATALOGUE = [GLM_AIR, HAIKU, GEMINI_FLASH, GLM_FLASH];

const rank = (query: string) => rankModels(CATALOGUE, query, () => 0).map((found) => found.id);

describe("scoreModel", () => {
  it("finds a model from two words that are not next to each other in the id", () => {
    // The regression: a broken split meant "glm flash" matched nothing at all.
    expect(scoreModel(GLM_FLASH, "glm flash")).not.toBeNull();
  });

  it("ignores case, order and separators", () => {
    for (const query of ["GLM Flash", "flash glm", "glm-flash", "glm_flash", "glm.4.6 flash"]) {
      expect(scoreModel(GLM_FLASH, query.toLowerCase()), query).not.toBeNull();
    }
  });

  it("matches a word that only the name carries", () => {
    expect(scoreModel(HAIKU, "claude haiku")).not.toBeNull();
  });

  it("refuses a word that is nowhere", () => {
    expect(scoreModel(GLM_FLASH, "glm sonnet")).toBeNull();
  });

  it("ranks exact, contiguous and scattered matches in that order", () => {
    const exact = scoreModel(GLM_FLASH, "z-ai/glm-4.6-flash") as number;
    const contiguous = scoreModel(GLM_FLASH, "glm-4.6") as number;
    const scattered = scoreModel(GLM_FLASH, "glm flash") as number;
    expect(exact).toBeLessThan(contiguous);
    expect(contiguous).toBeLessThan(scattered);
  });

  it("treats punctuation on its own as no query", () => {
    expect(scoreModel(GLM_FLASH, "/")).toBe(0);
  });
});

describe("rankModels", () => {
  it("keeps only the models every word reaches", () => {
    expect(rank("glm flash")).toEqual([GLM_FLASH.id]);
  });

  it("puts the closer match first", () => {
    expect(rank("flash")).toEqual([GEMINI_FLASH.id, GLM_FLASH.id]);
    expect(rank("glm")).toEqual([GLM_AIR.id, GLM_FLASH.id]);
  });

  it("returns the whole catalogue for an empty query", () => {
    expect(rank("")).toHaveLength(CATALOGUE.length);
  });

  it("sinks a model that cannot use tools", () => {
    const noTools = model("z-ai/glm-4.6-flash-lite", "Z.AI: GLM 4.6 Flash Lite", false);
    const ranked = rankModels([noTools, GLM_FLASH], "glm flash", () => 0);
    expect(ranked.map((found) => found.id)).toEqual([GLM_FLASH.id, noTools.id]);
  });
});

describe("highlightParts", () => {
  it("marks every word of the query in the id", () => {
    expect(highlightParts("z-ai/glm-4.6-flash", "glm flash")).toEqual([
      { text: "z-ai/", hit: false },
      { text: "glm", hit: true },
      { text: "-4.6-", hit: false },
      { text: "flash", hit: true },
    ]);
  });

  it("merges marks that touch", () => {
    expect(highlightParts("glmflash", "glm glmf")).toEqual([
      { text: "glmf", hit: true },
      { text: "lash", hit: false },
    ]);
  });

  it("leaves a text the query never reached in one piece", () => {
    expect(highlightParts("openai/gpt-5-mini", "glm")).toEqual([
      { text: "openai/gpt-5-mini", hit: false },
    ]);
  });
});

describe("words", () => {
  it("splits on anything that is not a letter or a digit", () => {
    expect(words("Z.AI: GLM-4.6_flash/x")).toEqual(["z", "ai", "glm", "4", "6", "flash", "x"]);
  });
});
