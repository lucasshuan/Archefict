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
pnpm dev                 # http://localhost:5173
```

Known issue: a global pnpm 10 tries to switch to the pinned version by itself and, on Windows, its generated launcher is broken ("is not recognized as an internal or external command"). Use one of the two options above. Git hooks already go through `corepack pnpm` for this reason.

First run: open Settings, paste an OpenRouter API key, pick a model (default: Claude Haiku 4.5). Without a key the app still works as a local narrative log; you narrate both sides.

## Check

```sh
pnpm lint                # Biome (format + lint, includes Solid rules)
pnpm typecheck           # TypeScript 7 across the workspace
pnpm test                # Vitest: node tests in packages, Chromium tests in apps/web
pnpm test:e2e            # Playwright against the dev server
pnpm check               # lint + typecheck + test
```

Component and end-to-end tests need a browser: `pnpm --filter @archefict/web exec playwright install chromium` once.

## Playtest

Every slice ends with a real session. Write what you played, what broke and what felt wrong in `docs/playtests/`, using the template there. The fixture campaign is the one in your own browser; export it before wiping storage (export arrives in Slice 2).

## Layout

```
apps/web            Vite + Solid SPA. Dark theme via semantic tokens in src/app.css.
packages/schema     Zod shapes shared everywhere (entries, provenance, settings).
packages/crdt       Automerge documents and the operations that touch them.
packages/ai         Narration over OpenRouter through the AI SDK.
packages/config     Shared tsconfig presets.
docs/               Product, roadmap, stack review, playtests, ADRs.
```

Internal packages export TypeScript source directly; Vite and Vitest consume it without a build step. Publishing (the plugin SDK, later) adds a build.

## Editor notes

- TypeScript 7 is the workspace compiler. In VS Code, use the workspace TypeScript version or the TypeScript Native Preview extension; the bundled one may lag.
- Biome handles formatting and linting; disable Prettier and ESLint for this workspace.

## Rules that CI will grow to enforce

From `docs/stack.md`: the main document never sends cross-origin isolation headers, provider keys never leave the device unless the user opts into managed mode, plugin content lives on a separate origin, and every change carries provenance.
