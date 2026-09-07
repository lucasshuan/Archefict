# Archefict

AI platform for roleplay, simulation and interactive worlds. See `PRODUCT.md` for what it is, `ROADMAP.md` for where it is going, and `docs/stack.md` for the current technical bets.

## Run

Requires Node 24 and pnpm 12 (pinned in `package.json`). Two ways to get the pinned pnpm:

```sh
npm i -g pnpm@12         # simplest: make it the global pnpm
# or, without touching the global install, prefix every command:
corepack pnpm install
```

Then:

```sh
pnpm install
pnpm dev                 # web on http://localhost:5173, api on http://127.0.0.1:8787
pnpm dev:web             # web only; the model list falls back to the built-in one
```

Known issue: a global pnpm 10 tries to switch to the pinned version by itself and, on Windows, its generated launcher is broken ("is not recognized as an internal or external command"). Use one of the two options above. Git hooks already go through `corepack pnpm` for this reason.

First run: open Settings, paste an OpenRouter API key, and pick narrator/background models (both default to Claude Haiku 4.5). Without a key the app still works as a local narrative log; you narrate both sides.

## Check

```sh
pnpm lint                # Biome (format + lint, includes Solid rules)
pnpm typecheck           # TypeScript 7 across the workspace
pnpm test                # Vitest: kernel packages and the API. The web app has no automated tests
pnpm check               # lint + typecheck + test
```

The web app is verified by playing, not by tests, while its features are still moving. See `ARCHITECTURE.md`.

## Playing

Every slice ends with a real session. Keep the fixture campaign in your own browser and note only findings that change the roadmap or a bet. Export it before wiping storage (export arrives in Slice 2).

## API

One contract in `packages/contract` (oRPC on Zod), implemented by `apps/api` (Hono on Node 24, run with Node's own type stripping, no build step). Three doors on the same server:

```
POST /api/rpc/*        typed client used by the web app
GET  /api/health       plain HTTP, as declared by the contract
GET  /api/models       chat models on OpenRouter with live prices, cached one hour
GET  /api/openapi.json generated from the contract
```

The web app reaches it same-origin: Vite proxies `/api` in dev. The narration call itself does not go through the API. With a device-owned key the browser talks to OpenRouter directly and the server never sees the key.

## Layout

```
apps/api            Hono + oRPC. Model catalogue today; auth, sync and managed AI later.
apps/web            Vite + Solid SPA. Dark theme via semantic tokens in src/app.css.
packages/schema     Zod shapes shared everywhere (entries, provenance, settings).
packages/contract   The API contract; the server implements it, the client is typed from it.
packages/crdt       Automerge documents and the operations that touch them.
packages/ai         Narration over OpenRouter through the AI SDK.
packages/config     Shared tsconfig presets.
docs/               Product bets and architecture notes.
```

Internal packages export TypeScript source directly; Vite, Vitest and Node consume it without a build step. Publishing (the plugin SDK, later) adds a build.

## Editor notes

- TypeScript 7 is the workspace compiler. In VS Code, use the workspace TypeScript version or the TypeScript Native Preview extension; the bundled one may lag.
- Biome handles formatting and linting; disable Prettier and ESLint for this workspace.

## Rules that CI will grow to enforce

From `docs/stack.md`: the main document never sends cross-origin isolation headers, provider keys never leave the device unless the user opts into managed mode, plugin content lives on a separate origin, and every change carries provenance.
