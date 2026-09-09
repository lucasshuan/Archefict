import { SUGGESTED_MODELS } from "@archefict/ai";
import type { ModelInfo } from "@archefict/contract";
import { api } from "./client.ts";

/** The built-in list, in the same shape as the live catalogue. Used when the API is unreachable. */
export const FALLBACK_MODELS: readonly ModelInfo[] = SUGGESTED_MODELS.map((m) => ({
  id: m.id,
  name: m.label,
  contextLength: 0,
  pricing: { input: m.inputPerM, output: m.outputPerM },
  // Every suggested model takes tools; the list is chosen that way.
  tools: true,
}));

export type ModelList = {
  models: readonly ModelInfo[];
  source: "live" | "fallback";
};

export async function loadModels(): Promise<ModelList> {
  try {
    const { models } = await api.models.list();
    if (models.length === 0) return { models: FALLBACK_MODELS, source: "fallback" };
    return { models, source: "live" };
  } catch {
    return { models: FALLBACK_MODELS, source: "fallback" };
  }
}
