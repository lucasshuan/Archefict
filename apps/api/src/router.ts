import { contract } from "@archefict/contract";
import { implement } from "@orpc/server";
import type { CatalogueSource } from "./models.ts";

export type ApiContext = {
  catalogue: CatalogueSource;
  version: string;
};

const impl = implement(contract).$context<ApiContext>();

export const router = impl.router({
  health: impl.health.handler(({ context }) => ({ ok: true as const, version: context.version })),
  models: {
    list: impl.models.list.handler(({ context }) => context.catalogue.list()),
  },
});
