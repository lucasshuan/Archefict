import { type ModelCatalogue, ModelInfo } from "@archefict/contract";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_TTL_MS = 60 * 60 * 1000;

type OpenRouterModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  architecture?: { output_modalities?: unknown } | null;
  pricing?: { prompt?: unknown; completion?: unknown } | null;
};

export type CatalogueSource = {
  list(): Promise<ModelCatalogue>;
};

/**
 * Fetches OpenRouter's public model list and keeps it for `ttlMs`.
 * No key is needed for this endpoint, so the server holds no secret to serve it.
 */
export function createModelCatalogue(deps: {
  fetch: typeof fetch;
  now?: () => number;
  ttlMs?: number;
}): CatalogueSource {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  let cached: ModelCatalogue | null = null;
  let inflight: Promise<ModelCatalogue> | null = null;

  async function load(): Promise<ModelCatalogue> {
    const response = await deps.fetch(OPENROUTER_MODELS_URL, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`OpenRouter models request failed with status ${response.status}`);
    }
    const body = (await response.json()) as { data?: unknown };
    return { models: parseModels(body.data), fetchedAt: now() };
  }

  return {
    async list() {
      if (cached && now() - cached.fetchedAt < ttlMs) return cached;
      inflight ??= load()
        .then((catalogue) => {
          cached = catalogue;
          return catalogue;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
  };
}

/** Keeps text-output models with known prices. Anything malformed is dropped, not guessed. */
export function parseModels(data: unknown): ModelInfo[] {
  if (!Array.isArray(data)) return [];
  const models: ModelInfo[] = [];
  for (const raw of data as OpenRouterModel[]) {
    const modalities = raw.architecture?.output_modalities;
    if (Array.isArray(modalities) && !modalities.includes("text")) continue;
    const candidate = {
      id: raw.id,
      name: typeof raw.name === "string" ? raw.name : raw.id,
      contextLength: typeof raw.context_length === "number" ? raw.context_length : 0,
      pricing: {
        input: perMillion(raw.pricing?.prompt),
        output: perMillion(raw.pricing?.completion),
      },
    };
    const parsed = ModelInfo.safeParse(candidate);
    if (parsed.success) models.push(parsed.data);
  }
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/** OpenRouter prices are USD per token as strings. Convert to USD per million, 3 decimals. */
function perMillion(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const perToken = Number(value);
  if (!Number.isFinite(perToken) || perToken < 0) return null;
  return Math.round(perToken * 1_000_000 * 1000) / 1000;
}
