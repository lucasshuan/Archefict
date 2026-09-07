# Archefict - Architecture

> September 07, 2026. The rules we follow now. Short on purpose. Change it when the code changes.
> Product truth: `PRODUCT.md`. Bets and why: `docs/stack.md`. Order of work: `ROADMAP.md`.

## Monorepo

```
apps/web           Solid + Vite SPA. The product.
apps/api           Hono + oRPC on Node 24. Model catalogue today; auth, sync, managed AI later.
packages/schema    Zod shapes. The only place a shape is defined.
packages/contract  API contract. Server implements it, client is typed from it.
packages/crdt      Automerge documents + operations. No browser, no Solid.
packages/ai        Provider calls + message mapping. Runtime-agnostic.
packages/config    Shared tsconfig presets.
```

- pnpm 12 workspaces. Versions live in the `pnpm-workspace.yaml` catalog. Packages say `catalog:`. A new dependency is a decision; the commit says why.
- TypeScript 7. ESM only. `.ts` in import paths. Erasable syntax only: no enums, no parameter properties, no namespaces. Internal packages export source; no build step.
- Biome lints and formats. No ESLint, no Prettier.
- Tests: Vitest in `packages/*` and `apps/api`. None in `apps/web`. The web app is verified by playing.
- Turborepo runs tasks. `pnpm dev` starts web and api together.

## Data, both apps obey

- Automerge is canonical. One document per thing: `campaign-index`, `timeline:<id>`, later `sheet:<id>`, `chat:<id>`. Never one document per campaign.
- Every write is a function in `packages/crdt`, then `flush()`. Nothing is durable until flush resolves.
- Local-only state (drafts, settings, campaign registry) is localStorage under `archefict:*`. Never in a CRDT.
- Security state (accounts, membership, keys) is Postgres, later. Never in a CRDT.
- Shapes come from `packages/schema` and are validated at every boundary: storage read, API in and out, LLM output.

## apps/web

```
src/index.tsx      boot only
src/app.css        theme tokens + base layer. The only place a color exists.
src/App.tsx        shell: sidebar, keyed session, dialogs. Routing lands here.
src/api/           typed client (client.ts) + one file per contract area
src/ai/            turn runner. Orchestration only; provider code is packages/ai
src/campaign/      Automerge glue: repo, library (registry), store, doc-signal
src/components/    UI. Props in, callbacks out. No fetching, no storage.
src/<feature>/     a feature that owns state and UI gets a folder (later: sheets/, timeline/, plugins/)
```

- Solid 1.x. Signals and props. `createDocSignal(handle)` is how a document reaches the UI. No other reactive store until a slice proves the need.
- The session is keyed by campaign. Switching remounts it. Per-campaign state lives inside `Session`.
- Styling: Tailwind utilities on semantic tokens only (`bg-surface`, `text-fg-muted`). The palette is removed; `bg-zinc-900` does not compile. Cursors and other interaction defaults come from the base layer, never per element.
- Dark is the theme. The tokens are the future plugin theming API.
- Icons are lucide-solid, imported one at a time (`lucide-solid/icons/<name>`), never from the package root. Decorative icons carry `aria-hidden`; icon-only buttons carry `aria-label`.
- Regions are separated by surface tone (`bg`, `surface`, `surface-raised`), not by lines. Borders are the exception, not the default. Inputs are filled and show a focus ring. Corners are round: `rounded-app` for controls, `rounded-xl`/`2xl` for cards and bubbles.
- Text on a colored background uses that color's `-fg` token (`text-accent-fg`, `text-danger-fg`). No unlayered CSS in `app.css`: it outranks every utility.
- Every API call may fail. The app works with the server down. Same-origin `/api`, proxied by Vite in dev.
- The provider key stays on the device. It is never sent to our API.
- Vite: Automerge is excluded from pre-bundling; dependencies reached only through linked packages are listed in `optimizeDeps.include`.

## apps/api

```
src/index.ts       process: env, serve, signals. Nothing else.
src/app.ts         Hono app: headers, mounts rpc + rest + openapi. No logic.
src/router.ts      implement(contract): thin handlers that delegate.
src/<domain>.ts    logic. Dependencies injected (fetch, now, later db). Pure where possible.
src/*.test.ts      beside the code. Domain: unit tests with fakes. App: app.request().
```

- Contract first. A route exists in `packages/contract` before its handler. No ad-hoc Hono routes except `/api/openapi.json`.
- Runs source with Node's type stripping. No build, no tsx.
- A context object carries dependencies. No globals, no singletons.
- No CORS. Same origin as web. Cross-origin is a plugin-phase decision.
- No secrets today. When keys arrive: envelope-encrypted, opt-in managed mode only.
- Two services later: `api` stateless, `sync` stateful. They are never merged.
