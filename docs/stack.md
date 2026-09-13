# Archefict - Stack v2

> September 06, 2026, revised September 11. Converged after the Claude stack review and the GPT counter-review.
> Supersedes `stack-review.md` where they conflict. That file stays as long-form rationale and sources.
> The sheet model this rests on is `sheets.md`; retrieval and context are `ai-context.md`.

## Principles

1. **Automerge is canonical.** Everything else is a rebuildable projection. A cache you cannot delete is not a cache.
2. **Pluralism in the views, not the kernel.** The core is boring and strong. Obsidian, Fibery, LegendKeeper and Risu-like behaviour happen above it.
3. **Progressive formalization.** Unstructured, then a field typed in the flow of writing, then a component claiming that key, then validation, then plugin-enhanced. No step re-enters anything. Schema is never mandatory.
4. **Every write is a typed operation** through one deterministic pipeline, for humans, plugins and AI alike.
5. **Web and desktop are equal execution environments.** A platform interface abstracts secrets, files, network mode and local models.
6. **Plugins are default-deny.** Capabilities are revocable handles, never tokens.

## Kernel primitives

`read` · `query` · `operation` · `transaction` · `event` · `reference` · `provenance`

## Data model

```
Sheet { id, body: rich text (blocks + marks), fields: free-form map,
        refs: stable ids, view?: PluginSurface, components?: ComponentId[],
        pluginState: { [nodeId]: opaque }, meta + provenance }
Component = schema fragment: claimed fields, summary fields, UI hints, AI serializer hints.
Several per sheet. Plugin-definable, not a fixed host list.
Validation applies only to keys a component claims. Everything else is free.
```

- Documents: `campaign-index`, `sheet:<id>`, `timeline:<id>`, `chat:<id>` (chunked), `plugin-state:<id>`. Never one doc per campaign.
- Security state (membership, grants, keys) lives in Postgres. Never in a CRDT.
- Canonical rich structure, then serializers, then human views / compact AI view / Markdown export. Markdown is a representation, not storage.
- Fields are typed inline and stored in the map. `::` writes, `{{ }}` reads, `[[ ]]` links; the syntax is an input method consumed at typing time, never parsed back out of a body. A field may be owned by another sheet, and the write pipeline enforces that ownership **(`sheets.md`)**.
- A sheet that is not document-shaped — a map, a canvas, a board — is a `view`, not a second sheet type.
- Plugin state lives beside its node, keyed by node id, not inside the node's attributes: block attributes are written back wholesale, so nested state in an attribute loses fine-grained merge. Confirm in the Phase 0 adapter spike.
- AI turn, message-part and background-work exploration **(bet)**: [`ai-turn-bets.md`](ai-turn-bets.md).
- Fictional campaign time is its own type. Not `Date`.

## Write pipeline (the real security boundary)

```
proposal (user | plugin | AI)
  → typed operation → schema validation → capability check
  → deterministic policy → risk tier / approval → transaction (+ provenance)
```

Any multi-model split is defense in depth only. A schema-valid proposal can still be malicious. The pipeline must hold with an uncensored local model proposing operations.

## Stack

| Layer | Decision | Note |
|---|---|---|
| Language | TypeScript 7.0 | No programmatic API until 7.1, so lint with Biome. `erasableSyntaxOnly`, `verbatimModuleSyntax` |
| UI | Solid 1.x, Vite 8 | Solid 2.0 is RC; keep the Automerge bridge thin for migration |
| App shell | Vite SPA + client router | SolidStart or Astro only for the public site |
| Editor | ProseMirror + automerge-prosemirror, custom `SchemaAdapter` | Not Tiptap, Milkdown, BlockNote, Lexical. The adapter owns tables, images, mentions, `field` and `embed`, and designates the `unknownBlock` |
| State | Automerge 3 + Automerge Repo, IndexedDB storage | OPFS is not the baseline |
| Reactive projection | Solid stores by default | TanStack DB only if incremental joins prove necessary; prototype behind one interface |
| Local query | PGlite + pgvector, lazy, disposable | IndexedDB VFS on Safari; never inside plugin iframes |
| Panels | Own layout engine | Plugin iframes render in a fixed top layer, never re-parented |
| API | Hono on Node 24 | oRPC or zod-openapi for contracts; `api` and `sync` are separate services |
| Auth | Better Auth (Google, Discord) | Minimal plugin set; host-only cookies; pin and watch advisories |
| Sync | Own Hono WebSocket service | doc to campaign to membership check on every request; transport swappable for Keyhive later |
| Cloud DB | Postgres + Drizzle | JSONB projections, pgvector HNSW, RLS |
| Storage | S3-compatible | Re-encode every image; separate user-content origin |
| AI SDK | Vercel AI SDK 6 | `model-policy` package keeps it replaceable |
| AI sources | OpenRouter-first, provider-independent | Then local, custom endpoint, managed later |
| Keys | Two trust modes | **Device-owned** (keychain or local secure storage, server never sees it) is default. **Managed** (envelope-encrypted, server worker) is opt-in for background execution |
| Plugin logic | quickjs-emscripten, one runtime per plugin | In a Worker, in a sandboxed iframe, on a separate registrable domain. Plugin-owned WASM allowed inside its sandbox |
| Plugin UI | One thin iframe per surface | Explicit versioned message protocol, not Comlink |
| Permissions | `sheets:read/write` `timeline:read/write` `chat:read/input` `ui:view/hud/overlay` `ai:tools/complete` `storage` `net:<host>` | Network default-deny; re-consent when a manifest expands |
| AI code exec | Same sandbox, narrower grant | Server-side execution deferred |
| MCP | Spec 2026-07-28, TS SDK v2 | Client first; Archefict as server later; local stdio via Tauri sidecar |
| Shells | PWA first; Tauri 2 desktop and mobile later | Architecturally equal targets via the platform interface, but both shells ship after the web app |
| Marketplace | Signed, content-addressed, hash-pinned bundles | Revocation list, permission diffs, scanned vs verified tiers, sideload with reduced grants |
| Monorepo | pnpm 12, Turborepo, internal packages export source | Biome 2 with its Solid domain (no ESLint: typescript-eslint cannot run on TS 7 until 7.1), Zod 4 / Standard Schema, Vitest 4 browser mode, Playwright, Testcontainers, fast-check, Changesets with provenance, lefthook. `isolatedDeclarations` only on published packages |

**Not adopted:** Extism as host infrastructure · Effect-TS · Markdown or HTML as storage · inline text as field storage · mandatory sheet types · cross-origin isolation in the main document · Bun in the critical path · Comlink.

Markup is not rejected for safety. It is rejected because it has no preservation contract (an unknown construct is either stripped or is a hole, decided by a sanitiser config rather than the plugin author), no merge semantics (two writers resolve as characters inside tags), and no extension registry. The tree has all three. Extensibility comes from extension points, not from a permissive format — Excalidraw drawings are Markdown files.

## Hard rules

- The main document never requires COOP or COEP. CI checks it.
- Plugin iframes: `sandbox="allow-scripts"` only. No `allow-same-origin`. Never `srcdoc` or `blob:` from the app origin.
- No API for plugins to load code at runtime.
- Unknown blocks, attributes and marks survive a round-trip. A client without a plugin never destroys that plugin's content. Node type names are namespaced, carry a version, and carry fallback text written at authoring time.
- Tool definitions are context and are sent every request; campaign content is not. Tool calls and results die with the turn. Every id sent to a model carries its title.
- Cookies are host-only. Plugin content lives on a separate registrable domain.
- Provider keys never reach plugins, sandboxes or the client bundle.
- Local-only campaigns: storage persistence request, automatic file backups, loud warning.
- Every embedding stores its model id and dimensions.
- Every change records provenance: who, which model, which turn, which plugin.

## Open decisions (answer before the monorepo)

1. ~~Can a campaign have more than one human?~~ **Decided Sep 06, 2026: v1 is single-user, multi-device. Shared campaigns later.** Sync authorization is doc to campaign to owner for now; keep membership as a table so sharing is additive.
2. Plugin network: manifest allowlist enforced by CSP only, or routed through a host proxy for logging and quotas?
3. ~~One or many AI conversations per campaign?~~ **Decided Sep 09, 2026: many.** Built in Slice 0.5.
4. Image generation: was "no", now "maybe". Decide the stance.
5. Content-policy-aware model routing: define it concretely.
6. ~~Revise PRODUCT.md to match this document.~~ **Done Sep 11, 2026** for the sheet model. The AI, plugin and marketplace sections still describe the end state, not a decision.
7. ~~Sheet model.~~ **Decided Sep 11, 2026:** body + fields + view, inline bindings, nothing mandatory. `sheets.md`.

**Unverified:** a published ARK / Keyhive API guide with access levels. Confirm on the Automerge docs before relying on it. The plan does not depend on it either way.

## Sequencing

Ordering lives in `ROADMAP.md`, which is play-first: vertical slices, no kernel-only phase, AI before cloud, shells last. Kernel packages (`schema`, `model`, `crdt`, `serialize`, `ops`) are extracted when a second slice needs them, not built ahead.

## Layout

```
apps/       web · site · api · sync · desktop
packages/   schema · model · crdt · serialize · projection · search · editor · panels
            platform · plugin-sdk · plugin-host · ai · ui · config
docs/       compact product bets and architecture notes
```
