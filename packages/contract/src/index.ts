/**
 * @archefict/contract
 *
 * The API contract, contract-first. The server implements it, the web client is typed
 * from it, and the OpenAPI document is generated from it. Schemas come from
 * @archefict/schema so the API never invents a second shape for the same thing.
 */
import { ModelId } from "@archefict/schema";
import { type ContractRouterClient, oc } from "@orpc/contract";
import { z } from "zod";

export const ModelInfo = z.object({
  id: ModelId,
  name: z.string(),
  contextLength: z.number().int().nonnegative(),
  /** USD per million tokens. */
  pricing: z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
  }),
});
export type ModelInfo = z.infer<typeof ModelInfo>;

export const ModelCatalogue = z.object({
  models: z.array(ModelInfo),
  /** Wall-clock milliseconds when the catalogue was fetched from the provider. */
  fetchedAt: z.number().int().nonnegative(),
});
export type ModelCatalogue = z.infer<typeof ModelCatalogue>;

export const contract = {
  health: oc
    .route({ method: "GET", path: "/health" })
    .output(z.object({ ok: z.literal(true), version: z.string() })),
  models: {
    /** Chat-capable models on OpenRouter with live prices. Cached server-side. */
    list: oc.route({ method: "GET", path: "/models" }).output(ModelCatalogue),
  },
};

export type Contract = typeof contract;
export type ApiClient = ContractRouterClient<Contract>;
