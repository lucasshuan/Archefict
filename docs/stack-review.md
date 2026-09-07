# Archefict - Stack & Architecture Review

> Review date: September 06, 2026 (legacy)
> Reviews the pre-monorepo plan against PRODUCT.md. Version and status claims were checked against the sources listed at the end; everything else is judgement.
> Status legend: **KEEP** · **KEEP WITH CHANGES** · **DROP / DEFER** · **ADD**
> **Superseded where they conflict by `stack.md`** (the compact converged version). Notably: sheet types are optional components, not mandatory; the two-model handoff is defense in depth, not the security boundary; two BYOK trust modes instead of server-side storage; desktop is a first-class target.

---

## 0. Executive verdict

The stack is broadly well chosen. The direction (local-first CRDT core, Postgres cloud, sandboxed plugins, BYOK AI) is coherent and matches the product. Three things are genuinely wrong or under-specified, and they are the three that are expensive to change later.

1. **Three overlapping local stores.** TanStack DB + Automerge + PGlite are each a store with their own persistence and reactivity. Picking one source of truth and demoting the other two to derived indexes is the single most important decision in this document. See section 2.
2. **Sync has no authorization story.** `automerge-repo` ships no per-document access control. Document IDs behave as bearer capabilities. This must be solved in your own sync server before any multi-user feature ships. See section 5.3.
3. **The sheet data model does not exist yet.** PRODUCT.md describes sheets as "rich text markdown" but the product it describes (Notion/Fibery/Dataview replacement, LLM-queryable, plugin-extensible) requires a typed schema system. Everything downstream (LLM serialization, plugin APIs, timeline, import/export) depends on it. See section 3.1 and section 10.

Secondary but material: **Extism is the wrong tool for this plugin system** (section 6.2), **cross-origin isolation and third-party plugin iframes are mutually hostile** and you must choose (section 6.4), and **plugin-supplied LLM tools are a prompt-injection amplifier** that your existing two-model handoff idea can be upgraded to defend against (sections 3.3 and 7.4).

### Summary table

| Area | Planned | Verdict |
|---|---|---|
| TypeScript | TypeScript | **KEEP**. TS 7.0 GA, with a tooling caveat (section 9) |
| UI framework | SolidJS | **KEEP**. Stay on 1.x, Solid 2.0 is still RC (section 4.1) |
| Build | Vite | **KEEP**. Vite 8 / Rolldown |
| App shell | (unstated) | **ADD**. Plain SPA + router; SolidStart only for the public site (section 4.1) |
| Query layer | TanStack DB | **KEEP WITH CHANGES**. As a derived index over CRDT, not a store (section 2.3) |
| Editor | ProseMirror | **KEEP**. With `automerge-prosemirror`; ProseMirror direct, not Tiptap (section 4.2) |
| CRDT | Automerge / Automerge Repo | **KEEP**. Automerge 3, one doc per sheet, not per campaign (section 2.2) |
| Local persistence | PGlite + OPFS | **KEEP WITH CHANGES**. IndexedDB for CRDT storage; PGlite demoted to local search index (section 2.4) |
| Sync | Automerge sync protocol | **KEEP WITH CHANGES**. Own the sync server, do not ship the demo relay (section 5.3) |
| Auth | Better Auth | **KEEP**. It does give you the full route/provider surface you want (section 5.2) |
| API | Hono | **KEEP**. With a caveat about RPC type inference at scale (section 5.1) |
| Cloud DB | Postgres + JSONB + pgvector | **KEEP**. Plus a note on where JSONB stops being the right tool (section 5.4) |
| Object storage | S3-compatible | **KEEP**. Serve from a separate origin (section 5.5) |
| Plugin logic | WebAssembly + Extism | **DROP for v1**. Use QuickJS directly; keep the WASM path open (section 6.2) |
| Plugin UI | Sandboxed iframe + RPC | **KEEP WITH CHANGES**. Separate origin per plugin, explicit protocol not Comlink (sections 6.3 and 6.5) |
| AI code exec | QuickJS/WASM in Worker | **KEEP WITH CHANGES**. The Worker is not the boundary; the origin is (section 6.6) |
| MCP | Future adapter | **KEEP**. Spec 2026-07-28, TS SDK v2 is stable, so this is now a concrete target (section 6.6) |

---

## 1. What PRODUCT.md does not yet decide (and must, before the monorepo)

These are not stack questions, but the stack cannot be laid out without them.

1. **Is a campaign single-player or shared?** PRODUCT.md never says. If campaigns are ever shared (a game master plus players, or one user across devices, which the local/cloud toggle already implies), then you need per-document authorization, presence, per-sheet permissions, and a conflict-presentation UI. If they are strictly single-user-multi-device, the sync problem collapses to "one identity, many devices" and gets dramatically easier. **Decide this first.** Everything in section 5.3 and section 2.2 depends on it.
2. **What is a sheet, structurally?** See section 3.1. "Rich text markdown" is a rendering format, not a data model.
3. **Does a campaign have one AI conversation or many?** Affects chat storage, context strategy, and cost accounting.
4. **Are plugins allowed to make network requests?** This is the single biggest capability decision in the plugin model. It determines whether the marketplace can meaningfully be "scanned", whether data exfiltration is possible, and whether plugins can bring their own AI. Recommendation in section 6.5.
5. **Offline AI.** Nothing AI-driven works offline with cloud providers. Local-only mode is therefore "your data and your editor work offline, the AI does not." Say so in the product doc, because it is a support burden otherwise.
6. **Data durability promise.** Browser storage is evictable. See section 2.5. The product needs an explicit backup story, not just an import/export feature.

---

## 2. The local data layer, the central decision

### 2.1 The problem with the current plan

TanStack DB, Automerge and PGlite each want to be the place data lives:

- **Automerge** holds documents, persists them through a storage adapter, and emits change events.
- **PGlite** is a full Postgres in WebAssembly with its own persistence and its own live-query system.
- **TanStack DB** holds collections in memory, persists them, and runs incremental live queries with optimistic mutations.

Wiring all three as peers gives three write paths, three conflict models and three cache-invalidation problems. This is the failure mode that kills local-first projects.

### 2.2 Recommendation: Automerge is the only source of truth

Everything else is a **derived, disposable index** that can be dropped and rebuilt from the CRDT at any time. If a cache cannot be deleted without data loss, it is not a cache.

**Document granularity matters more than any other Automerge decision.** Do not put a campaign in one document.

```
campaign-index  (Automerge doc)  membership, sheet list, sheet-type registry, plugin set, settings
sheet:<id>      (Automerge doc)  one per sheet
timeline:<id>   (Automerge doc)  one per timeline, chunked by era if it grows
chat:<id>       (Automerge doc)  one per session, chunked, old chunks become read-only
```

Automerge documents load and sync as a unit, and history accumulates per document. Per-sheet documents give lazy loading, bounded memory, per-document authorization, and per-document compaction. A single campaign document would grow without bound and force a full load to read one sheet.

**On the CRDT choice itself.** Automerge 3.0 cut memory usage by more than ten times while staying backwards compatible, and is the default when installing current Automerge Repo. It has a native rich-text representation with inline marks and blocks, and the ProseMirror binding is the reference integration.

Loro is faster and adds a movable-tree CRDT. Yjs has the smallest footprint. Both are reasonable. **Automerge is still the right pick** for three product-specific reasons:

- The rich-text-with-blocks model maps directly onto ProseMirror and onto the "sheets are prose plus structure" requirement.
- Automerge has the richest history model of the three. The product sells a fully editable timeline and needs to answer "what did the AI change in this turn, and can I undo just that". History is a feature here, not overhead.
- The upstream access-control work is being built for Automerge specifically. It is pre-alpha today, but it is the only CRDT with a credible local-first authorization roadmap.

The cost accepted: Automerge is the slowest of the three on large documents and the heaviest in history storage. Per-document granularity plus periodic compaction is how that is paid.

### 2.3 TanStack DB: keep it, as a view layer

TanStack DB fits the query side of this app. Queries are live by default, joins and aggregates are incremental, and it is designed to sit over some other sync engine rather than be one. As of 2026 it is on the 0.6 line with 1.0 signalled but not shipped, and 0.6 added persistence and hierarchical data.

**Use it like this:** write a custom collection whose sync function subscribes to Automerge change events and pushes normalized rows in. Mutations do not go through its optimistic transaction machinery to a server. They go to Automerge, which is already optimistic and already local. The change event flows back and updates the collection. One write path.

Do not use its persistence layer. Automerge's storage adapter is the persistence layer.

Two caveats: it is pre-1.0 and the docs already say dependency arrays are being removed in 1.0, so expect churn. And there is no official Automerge collection, so you write and maintain that adapter. Keep it in one small package so it stays replaceable.

### 2.4 PGlite: demote it, do not delete it

As the primary local store PGlite is wrong here. It is single-connection by design, roughly 3MB gzipped of WebAssembly, and its OPFS filesystem is not supported on Safari, with IndexedDB recommended for browsers instead. Layering it under a CRDT that already persists is duplicated machinery.

It has one job it is genuinely excellent at, and that job is in this product: **local semantic and structured search over sheets**. The vector extension ships for PGlite as a separate package. That gives you, entirely on-device:

- Embedding storage and vector search over sheet chunks, so "AI should query campaign sheets strategically" works in local-only mode without shipping campaign text to your server.
- A real SQL surface for a Dataview-style query language inside sheets, which is exactly the Obsidian workflow the product replaces.

So: **PGlite is a rebuildable index derived from Automerge, loaded lazily when the user opens search or a query block.** Not on the boot path. This also resolves the encryption tension in section 5.4, because client-side embeddings mean a future end-to-end encrypted campaign mode does not lose search.

Never enable it inside plugin iframes.

### 2.5 Storage, quotas and eviction, an under-planned risk

PRODUCT.md says local mode uses IndexedDB. The stack plan says OPFS and PGlite. Resolve to: **Automerge storage on IndexedDB, PGlite index on OPFS where available and IndexedDB elsewhere.** IndexedDB is the compatible baseline and Automerge Repo has a mature adapter for it.

The real risk is not which API, it is eviction. Browser storage is best-effort:

- Call the storage persistence request on first campaign creation and surface the result. Without it the origin is evictable under pressure.
- Safari on iOS evicts script-writable storage for sites unused for about seven days unless the site is installed to the home screen. For a local-only campaign that is data loss.
- A credentialless iframe's storage is ephemeral and cleared when the top-level document unloads, so plugins must never be told their own storage is durable.

**Required product work:** periodic automatic export of local-only campaigns to a user-chosen file, a visible "last backed up" indicator, and a loud warning when a local-only campaign is created. This is a feature, not a footnote.

---

## 3. Sheets, the LLM boundary, and serialization

### 3.1 Sheets need a type system, not just rich text

The product wants sheets that are simultaneously human-editable prose, machine-queryable structure, LLM-serializable, plugin-extensible, and diffable. That is a Notion or Fibery database row, not a markdown file.

Recommended shape. A sheet is one Automerge document containing both halves:

```
Sheet {
  id            stable, never reused
  typeId        points at a SheetType in the campaign index
  fields        typed map, validated against the SheetType
  body          Automerge rich text (blocks and marks), the prose half
  refs          outbound references to other sheet ids
  meta          created and updated timestamps, provenance (user or AI turn id)
}

SheetType {                      // first-class campaign object, itself editable
  id, name, version
  fields: [{ key, label, kind, required, enum, refType, default }]
  bodyTemplate                   // starting structure for new sheets
  aiHints                        // how to summarize and serialize this type for the LLM
}
```

This one decision unlocks the rest of the product:

- **Compact LLM serialization** becomes derivable from the type rather than guessed per sheet.
- **Plugins** get a schema to write against, and a reason to be typed.
- **The timeline** can reference sheet states at points in time.
- **Import and export** have something stable to map onto.
- **Validation of AI edits** becomes possible. See section 3.3.

Sheet types should be user-definable and plugin-definable. The Scenarios feature in PRODUCT.md is essentially a bundle of sheet types plus plugins plus an initial form. That makes Scenarios cheap once this exists, and impossible before.

### 3.2 Do not make Markdown the source of truth

Markdown round-tripping loses fidelity on exactly the things this product needs: tables with typed cells, custom block types, mentions with stable ids, images with metadata. And a text-diff CRDT over markdown source produces broken documents when two people edit structure concurrently.

**Source of truth: Automerge rich text, edited through ProseMirror.** Markdown is an export format and part of the LLM view. Keep that mapping in one package so import, export and LLM serialization all share it.

### 3.3 The LLM contract is a security boundary, so specify it now

PRODUCT.md says sheets are cleanly serialized and that one AI hands off to a background model. Two additions turn this from a performance idea into a safety architecture:

- **The LLM never emits documents, it emits operations.** Define a typed patch format (set field, insert block, add reference, create sheet of type X) validated against the sheet type before being applied. An invalid operation is rejected and shown to the user, never partially applied. This is the same API plugins use, so there is one code path and one audit point.
- **The handoff is a validated typed plan, not free text.** The context model reads untrusted content (sheets, plugin output, chat) and produces a structured plan. The executor model, the one holding the tools, acts on that validated plan and is not given the raw untrusted text. This is the dual-model quarantine pattern, currently the strongest known architectural defence against indirect prompt injection. The product already has the two-model shape, so making the trust boundary explicit buys the defence almost for free.

Record provenance on every change: which model, which turn, which plugin. It powers "undo that AI turn", it is required for debugging, and it is the audit trail when something goes wrong.

---

## 4. Frontend

### 4.1 SolidJS, Vite, and the app shell

- **Solid 1.x is the target. Solid 2.0 is still a release candidate** as of this review, with APIs that may change before stable. It reworks async handling, Suspense and batching, and changes store semantics. Do not start a greenfield product on an RC. Do prepare for the migration: keep the Automerge-to-Solid bridge in one package, and avoid patterns that 2.0 is known to replace, such as deep resource waterfalls.
- **SolidStart 2.0 went stable on August 4, 2026.** It dropped Vinxi for Vite's Environment API, runs on Vite 8 with Rolldown, and requires Node 24 or newer. It is a server-rendering meta-framework. Archefict's app is a client-heavy local-first SPA built on WebAssembly and IndexedDB, and gains nothing from server rendering. **Use a plain Vite SPA with a client router for the app.** Use SolidStart (or Astro) only for the public site and marketplace pages that need SEO, as a separate app in the monorepo.
- **Ecosystem size is the real Solid cost.** You will write more infrastructure yourself than a React team would. The place this bites hardest is the "permissive UI structuring" requirement: there is no first-class dockable layout library for Solid. Options are the vanilla core of dockview, or golden-layout, both of which fight you the moment panels contain plugin iframes.

**Own the panel system.** It is a core differentiator, and there is one non-obvious constraint that generic docking libraries violate:

> Moving an iframe element to a different parent in the DOM reloads it. A docking library that re-parents panels on drag will destroy every plugin's state each time the user rearranges the layout.

The fix is structural: **render plugin iframes in a fixed top-layer "plugin surface", positioned over panel rectangles with a resize observer, never inside the panel DOM.** This is how editors with webviews already work. It also gives the host absolute control of stacking order, lets the host disable pointer events on all plugin surfaces while a host dialog is open, and makes HUD and overlay placement trivial. This design shows up again in the security section.

### 4.2 Editor: ProseMirror directly, bound to Automerge

- **ProseMirror, not Tiptap, Milkdown, BlockNote or Lexical.** The others are React-first, and their rich-text-over-CRDT stories are Yjs-shaped. The Automerge team maintains the ProseMirror binding as the reference integration for their rich-text model. That is the only path where the editor, the CRDT and the data model agree on what a document is.
- Pieces you will need beyond the core: table support, a mention or reference node keyed by stable sheet id, an image node that stores an asset id rather than a URL, and Solid-rendered node views for custom blocks such as query blocks and embeds. ProseMirror owns its DOM, so the Solid wrapper is thin: mount in a ref, bridge through plugins.
- **Undo is not free.** ProseMirror history covers the body. Nothing covers typed fields, the timeline, or "undo everything the AI did in turn 42". Plan an app-level undo manager that records inverse patches per intent, keyed by the provenance from section 3.3. This is a real work item and it belongs in the kernel, not the UI.
- Markdown import and export through the ProseMirror markdown package plus a GFM-capable parser for tables, with custom serializers for your node types. This is the same mapping the LLM view uses. One package.
- **Sanitization is mandatory on every render path** for content from users, plugins, imports and the LLM. Concrete vectors in markdown: `javascript:` and `data:` links, SVG uploads carrying scripts, and external images acting as tracking beacons that leak the reader's IP. Block external images by default in cloud campaigns, proxy them when allowed, and re-encode every uploaded image (section 5.5).

### 4.3 Shells: PWA first, Tauri for desktop, mobile last

- **Progressive web app first.** It is the fastest path to web, and to mobile, and it forces the storage discipline from section 2.5 early.
- **Tauri 2 for desktop.** It is production-proven on desktop and buys three things this product wants: a native keychain for the user's AI keys (far better than browser storage), filesystem access for vault-style backups, and sidecar processes for local MCP servers or local models. OAuth returns through deep links, which the auth layer supports.
- **Tauri mobile is functional but younger than desktop**, and it runs on three different web engines (WebView2, WKWebView, Android WebView). Expect CSS and WebAssembly inconsistencies. Start mobile as the installed PWA and revisit Tauri mobile once the desktop shell is stable. Electron only if a single consistent Chromium becomes a hard requirement, which nothing in the product suggests.
- Whatever the shell, the isolation rule in section 6.4 applies unchanged.

### 4.4 UI kit and utilities

- Headless components: Kobalte or Ark UI for Solid. Styling: Tailwind 4 or Panda. Solid Primitives for the small stuff.
- Virtualize chat and timeline lists from day one. Long campaigns are the normal case, not the edge case.
- Drag and drop: Atlassian's pragmatic-drag-and-drop is framework-agnostic and works with Solid; it also handles the panel system.
- Date and time: the campaign timeline is fictional time, not wall-clock time. Do not model it with Date. Define a campaign-time type in the schema package.

---

## 5. Backend, auth, cloud data

### 5.1 Hono

Good choice, and it is not obscure anymore. It runs on Node, Bun, Deno, Cloudflare Workers and Lambda, has a typed RPC client and OpenAPI generation through its Zod OpenAPI package, and validators accept Standard Schema.

- **Caveat:** the RPC client's type inference is known to slow the editor down in large route trees. Split routes per domain and compose, or go contract-first with oRPC (Standard Schema in, OpenAPI out, mounts on Hono). TypeScript 7's speed reduces this pain but the editor language service is what you feel.
- **Runtime: Node 24 LTS.** Bun is tempting, but the sync server holds long-lived WebSockets and runs Automerge's WebAssembly, and Node is the boring, correct choice there. Hono keeps the API portable, which matters because per-campaign sync rooms are a natural fit for Cloudflare Durable Objects later.
- **Two services from day one:** a stateless `api` and a stateful `sync`. They scale, deploy and fail differently. Folding sync into the API process is a mistake you would undo within a year.

### 5.2 Better Auth

It is what you want, and it satisfies the "full routes and strategies" preference: it mounts a complete route set on Hono with Google and Discord providers, account linking, sessions, and plugins for organizations, API keys, bearer tokens, JWT with JWKS, passkeys, two-factor, admin and rate limiting.

State of the project as of this review: the 1.6 line is current and 1.7 is landing with OAuth and OIDC fixes, DPoP, and safer defaults. The old OIDC-provider and MCP plugins are deprecated in favour of a separate OAuth provider package. There were security advisories through 2025 and 2026 and the project now runs a dedicated security-review workstream. Read that as: actively maintained, actively attacked, and worth pinning and watching.

Guidance:

- Enable the minimum plugin set. Every plugin is auth surface.
- Database sessions with cookie caching. Not stateless JWT for the browser session.
- **Cookies must be host-only.** A session cookie set with a `Domain` attribute for the app domain would be sent to every subdomain, including any plugin subdomain. Never set `Domain`. Better still, put plugin content on a separate registrable domain (the pattern used for user content domains by large providers) so cookie scope and origin can never overlap.
- There are three principals in this system, not one: the **user**, the **device** (sync), and the **plugin**. Mint short-lived JWTs from the session for the sync server, scoped to a campaign. Mint capability tokens for plugins from the host, never derived from the user session.
- On Tauri, use the bearer plugin with deep-link callbacks and store tokens in the OS keychain.

### 5.3 Sync authorization is the missing piece

`automerge-repo` has no per-document authorization. The reference sync server is a relay: any client that knows a document id can sync it. Document ids are unguessable, but they leak through URLs, logs, screenshots and exports. That is capability-by-obscurity and it is not acceptable for user data.

**Build your own sync service.** It is not large:

1. Hono with WebSocket. On connect, verify the campaign-scoped JWT.
2. On every document request, resolve document id to campaign to membership in Postgres (cached). Refuse unknown or unauthorized documents. Never relay by id alone.
3. The server holds its own Repo with a storage adapter backed by object storage (incremental change chunks plus periodic compacted snapshots, keyed by document id) and metadata in Postgres.

**Keep security-relevant state out of CRDTs.** Membership, permissions, plugin grants and keys live in Postgres and are server-authoritative. A CRDT server cannot cleanly reject an individual change without forking history, so the only enforceable boundary is "who may write which document". Design the document set (section 2.2) so that boundary is sufficient.

Upstream, Ink and Switch's Keyhive (local-first access control, with the Beelay sync protocol) is the long-term answer and was presented at FOSDEM 2026, but the Rust workspace is pre-alpha with unstable APIs. Design the transport as swappable and watch it. The device-based end-to-end auth provider for Automerge Repo exists but changes the whole account model and is not recommended for version one.

### 5.4 Postgres, JSONB, pgvector

- **Two server-side representations of every document:** the Automerge binary (authoritative, opaque) and a JSONB projection (derived, for search, embeddings and admin views). A background projector job rebuilds the projection on change. Write the Automerge-to-plain-object mapper once, in a shared package, and use it on both client and server.
- **JSONB is right for** projections, sheet-type schemas and plugin manifests. **It is wrong for** anything needing referential integrity or migrations: users, campaigns, membership, keys, marketplace records. Those are ordinary tables.
- pgvector with HNSW is enough for years. Use half-precision vectors above 2000 dimensions, and its iterative scans for filtered queries. DiskANN-style extensions only matter at tens of millions of vectors. Store the model id and dimension alongside each embedding so re-embedding is possible.
- Row-level security is cheap defense in depth since every request already carries a user id. Add it on user- and campaign-keyed tables.
- **Encryption tension, decided:** server-side embeddings and AI need plaintext. Cloud campaigns are not end-to-end encrypted in version one. Keep an "encrypted campaign" mode as a future option where search runs client-side in PGlite (section 2.4) and the server is a blind relay.
- ORM: Drizzle. It has pgvector and JSONB typing, a migration tool, and a Better Auth adapter. Kysely if you prefer a pure query builder. Driver: postgres.js or node-postgres.

### 5.5 Object storage

S3-compatible is fine. Managed options without egress fees exist. For self-hosting, Garage is the lean choice; treat MinIO with caution given its 2025 licensing and maintenance direction.

Non-negotiable rules:

- Presigned uploads directly from the client, with size and type limits, and per-user quotas.
- **Re-encode every uploaded image server-side.** This neutralizes script-bearing SVGs and polyglot files in one step. Reject anything that does not decode.
- Serve user content from a **separate origin** with a strict CSP and `Content-Disposition` for non-images. Never from the app origin.
- Campaign export bundles live here too, behind expiring links.

---

## 6. The plugin sandbox

### 6.1 Threat model

Plugins are untrusted code from strangers running inside a logged-in user's session. Assets to protect: the user's AI keys, session cookies and tokens, other campaigns' data, the integrity of the host UI, and the LLM's instruction channel. Attacker goals: exfiltrate, steal keys, phish through fake UI, and prompt-inject the AI into acting. Explicitly out of scope for version one: resource exhaustion beyond basic CPU and memory caps, and side channels.

### 6.2 Logic runtime: drop Extism for version one, use QuickJS directly

Extism's browser SDK works, but as of this review it is still pre-1.0 (release-candidate versions with possible breaking changes), and background threads need a cross-origin-isolated context, which collides with section 6.4.

The deeper problem is the fit. Extism's model is "call a function with bytes, get bytes back". That is excellent for compute and awkward for stateful, event-driven plugins that drive UI. And your plugin authors will write TypeScript. A JavaScript Extism plugin is QuickJS compiled into the plugin's own WebAssembly through the JS plugin development kit. You would be running **QuickJS inside WebAssembly inside Extism**: two layers, a private QuickJS copy per plugin, slower startup, and every host call marshalled through bytes.

**Use quickjs-emscripten directly.** It is actively maintained (the vendored engine was updated in early 2026), supports an interrupt handler for CPU limits, memory limits, modules and async, and it is the same WebAssembly isolation guarantee in one layer. It is also the design Figma settled on for the same reasons.

Recommended shape:

- One QuickJS runtime per plugin, so plugins are isolated from each other.
- That runtime lives in a Worker inside a sandboxed cross-origin iframe (section 6.3). Defense in depth: if QuickJS is ever escaped, the attacker lands in an origin with no cookies, no storage and no capabilities beyond the message channel.
- The host API is a transport-agnostic message protocol with capability handles (section 6.5), so the runtime is swappable.

**Keep the WebAssembly path open, on the plugin side.** A plugin that needs heavy compute (dice engines, simulation) can bundle its own `.wasm` and load it inside its own sandbox. Extism belongs there, if anywhere. The host never needs to know. Reinstate Extism as host infrastructure only if multi-language plugins become a product requirement, which PRODUCT.md does not ask for.

### 6.3 UI isolation: a separate origin per plugin

The **origin** is the real security boundary; the sandbox attribute is a second layer.

- Serve plugin bundles from a **separate registrable domain, with a per-plugin subdomain** (plugin id and version in the hostname). This isolates plugins from the host and from each other. Never `srcdoc` or `blob:` from the app origin.
- `sandbox="allow-scripts"` and nothing else unless a surface genuinely needs forms. Crucially **without** `allow-same-origin`, which yields an opaque origin with no storage and no cookies. Never `allow-top-navigation`, `allow-modals`, or popups that escape the sandbox.
- CSP on the plugin origin: default deny, scripts from self only, connections only to hosts in the manifest allowlist, ancestors restricted to the app origin. A Permissions-Policy that denies camera, microphone, geolocation and payment.
- Plugin storage exists only through the host, campaign-scoped and quota'd, stored with the campaign so it syncs with it.

**UI redress is the attack to design against.** A plugin surface that draws a convincing "enter your API key" dialog is the cheapest attack in this system. Mitigations, all of which the top-layer plugin surface from section 4.1 makes possible:

- Every plugin surface carries always-visible host chrome with the plugin's name.
- Host dialogs render above all plugin surfaces, and plugin surfaces lose pointer events while a host dialog is open.
- The host never asks for a secret on any screen where a plugin surface is mounted. Key entry lives in a settings page with no plugin surfaces.

### 6.4 Cross-origin isolation versus third-party iframes: pick one

SharedArrayBuffer and WebAssembly threads require the top document to be cross-origin isolated (COOP plus COEP). With COEP `require-corp`, every embedded iframe must opt in. COEP `credentialless` relaxes that, but it is Chrome and Edge only, and credentialless iframes get ephemeral partitioned storage wiped on unload.

Cross-origin-isolating the main app therefore makes third-party plugin iframes fragile across browsers.

**Decision: the main app does not require cross-origin isolation.** No SharedArrayBuffer in the main document. Anything that needs it (multi-threaded WebAssembly, PGlite's synchronous OPFS access) runs in a dedicated "isolated worker host" iframe on its own origin, which *is* isolated and embeds nothing third-party, and talks to the app over message ports. One rule, testable in CI.

### 6.5 Capabilities, RPC, and the manifest

- **Not Comlink.** Proxy-based RPC exposes a wide surface and makes it easy to leak a live object across the boundary. Define an explicit, versioned message protocol. Validate every inbound message against a schema from the shared schema package. Reject unknown message types.
- **Capabilities are handles.** At activation the host computes the plugin's grant set (manifest permissions intersected with the user's consent) and mints a capability table for that plugin and campaign. Each capability is a random handle mapped host-side to a scoped function. Revocation deletes the entry. Plugins never see user ids, other campaigns, tokens, or provider keys.
- **Initial permission vocabulary:** `sheets:read`, `sheets:write` (optionally per sheet type), `timeline:read`, `timeline:write`, `chat:read`, `chat:input`, `ui:view`, `ui:hud`, `ui:overlay`, `ai:tools` (register tools for the LLM), `ai:complete` (request completions through the host under the user's model policy, never touching the key), `storage`, and `net:<host>` entries.
- **Network is default-deny.** Grant only through the manifest's host allowlist, enforced twice: by CSP on the plugin origin and by the host proxy if traffic routes through it (which buys logging and quotas). Sideloaded plugins get no network regardless of manifest.
- **No dynamic code loading, enforced by omission.** There is simply no API to fetch and evaluate code at runtime. This is what makes marketplace review meaningful.
- **Version the host API from day one.** `hostApiVersion` in the manifest, the host supports the previous major, deprecations get a published timeline. Obsidian's unversioned API became a permanent compatibility tax; do not repeat it.
- Surfaces: each view, HUD slot, timeline component or overlay is its own thin iframe on the plugin origin. The plugin's logic runs in one hidden background iframe. The host routes messages between them. Simple, and it maps onto the panel system.

### 6.6 AI code execution

**A Web Worker is not a security boundary.** A same-origin worker can fetch with credentials, read IndexedDB and use caches. QuickJS-in-WebAssembly is what sandboxes; the Worker only provides a thread you can kill.

So the AI code runner is the **same substrate as plugins with a narrower grant**: QuickJS in a Worker in a cross-origin sandboxed iframe, given read access only to the sheets it was told about, returning values, with no UI and no network. Limits: an interrupt handler on operations, a memory cap, worker termination on a wall-clock deadline, and an output size cap.

Server-side execution becomes necessary the moment a background model must run while the client is closed. Defer it to version two, and when it arrives run the **same QuickJS bundle** on a server runtime (isolate-based platforms or a WebAssembly runtime) so semantics match. Design the runner interface now so location is a deployment detail.

**MCP is now a concrete target, not a "future adapter".** The 2026-07-28 specification and the stable version 2 TypeScript SDK bring a stateless core, header-based routing, hardened authorization and a formal extensions framework. A browser client can consume remote MCP servers over HTTP with the user's OAuth grant. Local stdio servers need the Tauri shell. Exposing Archefict itself as an MCP server, so external agents can read and write campaigns, is a natural version-two feature built on the auth layer's OAuth provider package.

---

## 7. The AI layer

### 7.1 SDK

**Vercel AI SDK 6** (released May 2026) is the pragmatic choice: provider-agnostic, agents as a first-class abstraction with a tool loop and stop conditions, human-in-the-loop tool approval, stable structured outputs with tool calling, a stable MCP client over HTTP with OAuth, and dev tools for stepping through multi-call runs. That maps directly onto BYOK, per-feature model policy, the handoff pattern, and the MCP roadmap. The alternative, direct provider SDKs behind your own abstraction, is less churn but more work and you would rebuild the tool loop. Keep provider and model configuration in a `model-policy` package regardless, so the SDK is replaceable.

### 7.2 BYOK key handling, decided

Because the background or handoff model will eventually run server-side, provider keys must be usable server-side. That forces the design:

- **Envelope encryption at rest.** A per-user data encryption key, wrapped by a key-management-service master key. Decrypt in memory per request. Never persist plaintext. Never log. Redact in error reporting and traces.
- A "revoke all keys" action that is one click and immediate.
- Keys never reach plugins, sandboxes, or the client bundle. Plugins request completions through `ai:complete` and the host applies the user's model policy.
- **On Tauri, offer a "keys stay on device" mode:** keys in the OS keychain, sent per request over TLS, nothing stored server-side. This is a real trust differentiator for a product whose users have already been burned by SaaS key handling.
- Direct browser-to-provider calls are an optimization, not the architecture. Only one major provider supports it explicitly, and it does not work for background execution.

### 7.3 Spend controls are a feature, not a setting

PRODUCT.md has "which part of the app uses which model". Add:

- Per-request token accounting, persisted, with model id and price snapshot.
- Per-campaign and per-month budgets with hard stops, and an estimate shown before large-context runs.
- A ledger view. Users who bring their own keys want to see where the money went.
- Model policy as a user-editable document the executor reads at runtime, not a hardcoded map.

### 7.4 Prompt injection, specifically here

Untrusted inputs in this product: sheet content (which may be imported from anywhere), plugin tool descriptions and tool results, chat content the user pastes, and marketplace scenarios. Controls, in priority order:

1. The dual-model split from section 3.3, with the executor acting only on a validated typed plan.
2. **Tool approval** for any tool that writes, spends, or reaches the network. The SDK supports this natively.
3. Plugin tools are namespaced, their descriptions are reviewed content at publish time, and each carries a risk tier that determines whether approval is required.
4. Delimit untrusted content explicitly in prompts and parse tool results defensively (strip instruction-shaped text from data fields where the schema says a field is data).
5. Rate and size limits on tool calls, and a full provenance log of every tool invocation.

Treat the model as an untrusted principal with the user's delegated authority, never as the user.

### 7.5 Retrieval

Chunk sheets by block, embed on change. Server-side for cloud campaigns, client-side in PGlite for local ones. Hybrid search: vector plus full-text, both of which Postgres does. The embedding model is part of model policy. Store model id and dimensions with every embedding so re-embedding is a batch job, not a migration.

---

## 8. Marketplace and supply chain

### 8.1 Distribution

- **Signed, content-addressed bundles.** The campaign pins a plugin by hash. Publishers sign with a key registered to their account (or through Sigstore). The client verifies the signature and checks a server-side revocation list on load. A kill switch per plugin version is table stakes.
- **Permission diffs on update.** When a new version expands its manifest, installation pauses for re-consent. This is the single highest-value control in browser extension stores and it is cheap.
- **Two tiers, shown in the UI:** scanned (automated only) and verified (automated plus manual review). Automated checks: manifest validation, bundle size, dependency vulnerability scan, and static rules for suspicious patterns. Because there is no dynamic code loading API, what is reviewed is what runs.
- Sideloading: allowed, with a warning, with the bundle hash shown, and with reduced default grants (no network, no `ai:tools`).

### 8.2 Your own supply chain

The 2025 npm worm compromised hundreds of packages and returned in August 2026 through a widely used caching library. It propagated through install lifecycle scripts. This is the environment you are building in, and the mitigations are concrete:

- pnpm 11 with `minimumReleaseAge` (defaults to one day; set it strict), `strictDepBuilds` with an explicit `onlyBuiltDependencies` allowlist, and frozen lockfile installs in CI.
- GitHub Actions pinned by commit SHA, with OIDC instead of long-lived secrets.
- **Trusted publishing with provenance** for the plugin SDK package, since third parties will install it.
- Vulnerability scanning on the lockfile, secret scanning on commits, and a software bill of materials on release.
- Renovate with a cooldown that matches the release-age setting.

---

## 9. Monorepo baseline

A concrete list. Every item is either current stable or a deliberate exception noted inline.

| Concern | Choice | Notes |
|---|---|---|
| Package manager | pnpm 11, workspaces, catalogs | Supply-chain settings from section 8.2 in `pnpm-workspace.yaml` |
| Task runner | Turborepo | moon is the credible less-known alternative if you want toolchain pinning; Nx only if you want generators |
| Language | TypeScript 7.0 | GA July 8, 2026, native compiler, roughly ten times faster type checks. **Caveat:** no stable programmatic API until 7.1, so typescript-eslint and other API consumers cannot run on it |
| TS config | Project references, `isolatedDeclarations`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, ESM only | `erasableSyntaxOnly` lets Node 24 run scripts with type stripping and no build |
| Lint and format | Biome 2 for everything, plus ESLint with only the Solid plugin on the web app | Solid's reactivity rules exist only in the ESLint plugin. Because Biome does not need the TS API, this sidesteps the TS 7 caveat for most of the repo |
| Schemas | Zod 4 with Standard Schema | One `schema` package feeds API validation, DB shapes, LLM tool JSON Schema, plugin manifests, sheet types |
| Effect-TS | No | Powerful, but invasive, and it would poison the ergonomics of the public plugin SDK. A small Result type with typed errors is enough |
| Tests | Vitest with browser mode, Playwright, Testcontainers for Postgres, fast-check | Property tests are the right tool for the serializer round-trip and CRDT bridge invariants. The sandbox and iframe code cannot be tested in jsdom |
| Package builds | tsdown or Vite library mode, with publint and "are the types wrong" checks in CI | Only the plugin SDK and a few shared packages need publishing |
| Release | Changesets | Provenance-enabled publishing for the SDK |
| Runtime | Node 24 LTS | Bun stays out of the critical path |
| Hooks | lefthook | Conventional commits optional |
| Docs | Compact architecture notes only when they change implementation | No ADR or per-playtest filing requirement |
| Containers | Distroless images, a devcontainer | |

---

## 10. Gaps in PRODUCT.md, beyond section 1

Things the product doc should say, because the architecture depends on them:

1. **Sheet types** as a first-class, user- and plugin-definable object (section 3.1). This is the heart of the product and it is absent.
2. **History and undo** as a feature: per-turn undo, per-sheet history, and "what changed since". The CRDT gives most of it; the product should claim it.
3. **Plugin permissions and consent UX**, including the sideload tier and the re-consent flow.
4. **Plugin API versioning and deprecation policy**, published, so third parties can plan.
5. **Backup and durability** for local-only campaigns (section 2.5).
6. **Spend controls** beyond model selection (section 7.3).
7. **Account deletion, data retention and export**, and what happens to a shared campaign when a member leaves.
8. **Content policy** for the marketplace and for user-generated roleplay content, and a clear statement that with BYOK the provider's terms apply to the user's own key.
9. **Offline scope**: editor and data offline, AI not.
10. **Telemetry stance**: what is collected, opt-in or out, and that campaign content is never in telemetry.
11. **Licensing** of the plugin SDK separately from the app, since third parties will depend on it.
12. A one-line **out of scope for version one** list. Candidates: end-to-end encryption, server-side code execution, Tauri mobile, multi-language plugins, image generation (already stated).

---

## 11. Risks and unknowns

| Risk | Severity | Mitigation |
|---|---|---|
| Solid 2.0 stable lands mid-build with breaking reactivity changes | Medium | Thin bridge package, avoid patterns 2.0 replaces, budget a migration sprint |
| TanStack DB churn before 1.0 | Medium | One adapter package; the query layer is replaceable by design |
| Automerge performance on very large sheets or long chats | Medium | Per-document granularity, chunked chats, scheduled compaction, measure early with realistic campaigns |
| No upstream sync authorization; own sync server must be right | High | Section 5.3; treat it as security-critical code with its own tests and review |
| Browser storage eviction losing local-only campaigns | High | Persistence request, automatic file backups, loud UX |
| Plugin UI phishing for keys | High | Top-layer surfaces, host chrome, no secrets on plugin-adjacent screens |
| Prompt injection through plugins or imported sheets | High | Dual-model split, tool approval, reviewed tool descriptions |
| Cross-origin isolation accidentally required by a dependency | Medium | The section 6.4 rule, enforced by a CI check that the main document has no COOP or COEP headers |
| Three-webview inconsistency on Tauri | Low to medium | Desktop first, one engine at a time, Playwright on each |
| TypeScript 7 tooling gaps until 7.1 | Low | Biome-first linting; pin a TS 6 devDependency only where the API is needed |
| Better Auth advisory cadence | Medium | Pin, subscribe, minimal plugin set, fast upgrade path in CI |
| Keyhive or Beelay never stabilizes | Low | Own sync server is the plan of record either way |

---

## 12. Suggested layout and sequencing

### 12.1 Package layout

```
apps/
  web/            Vite SPA, Solid 1.x, TanStack Router
  site/           SolidStart 2 (or Astro): marketing, marketplace pages
  api/            Hono, Node 24, Better Auth, Drizzle
  sync/           Hono + WebSocket, Automerge Repo server, authz
  desktop/        Tauri 2 shell (later)
packages/
  schema/         Zod 4: sheet types, manifests, API contracts, LLM tools, JSON Schema export
  model/          Domain types, campaign-time, ids, provenance
  crdt/           Automerge document shapes, migrations, compaction, Automerge-to-object mapper
  serialize/      Markdown import/export and LLM view, one mapping
  db-bridge/      Automerge-to-TanStack DB collection adapter
  search/         PGlite index, embeddings, hybrid search (client and server share the query shapes)
  editor/         ProseMirror schema, node views, Automerge binding, undo manager
  panels/         Layout engine and top-layer plugin surfaces
  plugin-sdk/     Published: types, manifest schema, client library for plugin authors
  plugin-host/    Sandbox runtime, capability table, message protocol, QuickJS worker
  ai/             AI SDK 6 wiring, model policy, handoff plan schema, tool registry
  ui/             Kobalte-based components, theme
  config/         Shared tsconfig, Biome, Vitest presets
tooling/
  scripts/        Repo scripts runnable via Node type stripping
docs/
  adr/            Decision records
```

### 12.2 Sequencing

The order below front-loads the decisions that are expensive to change and defers everything that is merely large.

1. **Kernel:** `schema`, `model`, `crdt`, `serialize`. Sheet types, the operation format, the LLM view, provenance. Property tests for round-trips. No UI yet.
2. **Editor and local app:** `editor`, `db-bridge`, `apps/web` with local-only campaigns on IndexedDB, backups, undo. This is the first usable product.
3. **Cloud:** `apps/api` with Better Auth, `apps/sync` with authorization, Postgres projections, object storage. Multi-device sync is the first cloud feature.
4. **AI:** `ai` with model policy, BYOK envelope encryption, the two-model handoff with a typed plan, tool approval, client-side code runner.
5. **Plugins:** `plugin-host`, `plugin-sdk`, `panels` with top-layer surfaces, the permission vocabulary, sideloading.
6. **Marketplace and retrieval:** signing and revocation, tiers, `search` with pgvector and PGlite.
7. **Shells:** Tauri desktop with keychain mode, then evaluate mobile.

Steps one and two produce something you can play with. Step three is where the security-critical code lives, and it should be reviewed as such.

---

## Sources checked for this review

Version and status claims above were verified against these on September 6, 2026.

- Automerge 3.0 announcement: https://automerge.org/blog/automerge-3/
- Automerge rich text model: https://automerge.org/docs/reference/documents/rich-text/
- automerge-prosemirror: https://github.com/automerge/automerge-prosemirror
- Keyhive design overview, FOSDEM 2026: https://fosdem.org/2026/schedule/event/BZ9CAE-automerge/
- Keyhive Rust workspace (pre-alpha): https://github.com/inkandswitch/keyhive
- Local-first auth provider for Automerge Repo: https://www.npmjs.com/package/@localfirst/auth-provider-automerge-repo
- TanStack DB 0.6 release: https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes
- TanStack DB live queries: https://tanstack.com/db/latest/docs/guides/live-queries
- PGlite filesystems (OPFS and Safari note): https://pglite.dev/docs/filesystems
- PGlite extensions (pgvector package): https://pglite.dev/extensions/
- Zero 1.0 release: https://www.infoq.com/news/2026/06/zero-version-1/
- Zero, when to use (offline write limits): https://zero.rocicorp.dev/docs/when-to-use
- Extism JS SDK (browser support, pre-1.0 status): https://github.com/extism/js-sdk
- quickjs-emscripten and JS sandboxing survey: https://simonwillison.net/2026/Mar/22/javascript-sandboxing-research/
- IFrame credentialless: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/IFrame_credentialless
- COOP and COEP guide: https://web.dev/articles/coop-coep
- SolidJS 2.0 beta coverage: https://www.infoq.com/news/2026/05/solidjs-2-async/
- SolidStart v2 stable: https://github.com/solidjs/solid-start/discussions/2281
- Hono Zod OpenAPI: https://github.com/honojs/middleware/tree/main/packages/zod-openapi
- Better Auth 1.5 and changelog: https://better-auth.com/blog/1-5 and https://better-auth.com/changelog
- Better Auth security update, June 2026: https://better-auth.com/blog/security-update-june-2026
- MCP 2026-07-28 specification: https://blog.modelcontextprotocol.io/posts/2026-07-28/
- MCP TypeScript SDK v2: https://ts.sdk.modelcontextprotocol.io/v2/
- Vercel AI SDK 6: https://vercel.com/blog/ai-sdk-6
- TypeScript 7.0 release: https://www.infoq.com/news/2026/08/typescript-7-released/
- pnpm supply chain settings: https://pnpm.io/supply-chain-security
- Shai-Hulud August 2026 return: https://tuxcare.com/blog/npm-attack-shai-hulud/
- pgvector index guide, March 2026 update: https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/
- OWASP LLM prompt injection prevention: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- Tauri 2 mobile guide: https://www.oflight.co.jp/en/columns/tauri-v2-mobile-ios-android
