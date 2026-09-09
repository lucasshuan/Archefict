# Archefict - Architecture

> September 09, 2026. The rules we follow now. Short on purpose. Change it when the code changes.
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

- Automerge is canonical. One document per thing: `campaign-index` (name, instructions, conversations, folders, sheets), `conversation:<id>` (one conversation's timeline of entries), later `sheet:<id>`. Never one document per campaign.
- Every write is a function in `packages/crdt`, then `flush()`. Nothing is durable until flush resolves.
- Mutations return the action they performed. Undo applies the inverse as an ordinary change, so it merges and syncs; document snapshots are never used.
- Local-only state (drafts, settings, campaign registry) is localStorage under `archefict:*`. Never in a CRDT.
- Security state (accounts, membership, keys) is Postgres, later. Never in a CRDT.
- Shapes come from `packages/schema` and are validated at every boundary: storage read, API in and out, LLM output.

## apps/web

```
src/index.tsx      boot only
src/app.css        theme tokens + base layer. The only place a color exists.
src/App.tsx        shell: sidebar, keyed session, full-page views. Routing lands here.
src/api/           typed client (client.ts) + one file per contract area
src/ai/            turn runner. Orchestration only; provider code is packages/ai
src/campaign/      Automerge glue: repo, library (registry), store, conversations, doc-signal
src/components/    UI. Props in, callbacks out. No fetching, no storage.
src/settings/      store + page. Pattern for a feature that owns state and UI
src/workspace/     the tabs of a campaign and the panels inside them (docs/workspace.md)
src/library/       the Library tab: tree, sheet editor (ProseMirror over Automerge), fields
src/<feature>/     later: plugins/
```

- Solid 1.x. Signals and props. `createDocSignal(handle)` is how a document reaches the UI. No other reactive store until a slice proves the need.
- The session is keyed by campaign. Switching remounts it. Per-campaign state lives inside `Session`. A campaign is tabs of panels (`docs/workspace.md`): icon tabs at the right end of the header, every tab mounted and only the open one displayed, so a streaming reply survives a look at another tab. Panels are peers that talk through tab state (`campaign/conversations.ts`), never through each other.
- A screen with its own sections is a page in the shell column, reached from the sidebar, with no back button of its own. The campaign column stays mounted and hidden so a streaming reply survives the detour. Modals are for one short decision. A page commits what is valid as it unmounts.
- All writes to a conversation's timeline go through `campaign/timeline.ts`. It owns persistence, save state and the 50-step undo history, which is per conversation and per device in localStorage. Destructive actions are undoable, so they do not ask for confirmation; archiving a conversation is its own undo.
- Styling: Tailwind utilities on semantic tokens only (`bg-surface`, `text-fg-muted`). The palette is removed; `bg-zinc-900` does not compile. Cursors, scrollbars and other interaction defaults come from the base layer, never per element.
- Dark is the theme. The tokens are the future plugin theming API.
- Icons are lucide-solid, imported one at a time (`lucide-solid/icons/<name>`), never from the package root. Decorative icons carry `aria-hidden`; icon-only buttons carry `aria-label`.
- Regions are separated by surface tone (`bg`, `surface`, `surface-raised`), not by lines: panels and settings sections are borderless `bg-surface` on `bg`. Inputs are the one bordered thing (`components/control.ts`), a well in `bg` cut into the panel; the base layer's focus-visible outline is the only focus treatment. Corners are round: `rounded-app` for controls and panels, `rounded-xl`/`2xl` for cards and bubbles.
- Text on a colored background uses that color's `-fg` token (`text-accent-fg`, `text-danger-fg`). No unlayered CSS in `app.css`: it outranks every utility.
- Page content sits in one column, `max-w-page`, whose width is the `--page-width` token. No page picks its own width.
- Three foreground tones: `fg` for content, `fg-muted` for labels and chrome, `fg-subtle` for supporting text. A section heading outranks its labels by size and weight (15px semibold, `fg`), never by colour. The accent means "selected" or "act here" — the selected tab, the active sidebar item, the primary button, a highlighted row — and nothing decorative. Explanations belong in an info badge tooltip beside the label, not printed under the control; only text describing the chosen value stays on the page.
- Every API call may fail. The app works with the server down. Same-origin `/api`, proxied by Vite in dev.
- The provider key stays on the device. It is never sent to our API.
- Vite: Automerge is excluded from pre-bundling; dependencies reached only through linked packages are listed in `optimizeDeps.include`. `@automerge/prosemirror` is the opposite case — pre-bundled with the ProseMirror packages and `resolve.dedupe`d — or the editor loads two `prosemirror-model`s and every edit throws.

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
