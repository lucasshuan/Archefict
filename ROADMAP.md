# Archefict - Roadmap

> Started: September 06, 2026
> `PRODUCT.md` is the truth. This file tracks how we get there. `docs/stack.md` and `docs/stack-review.md` are current bets, not decisions.
> **(bet)** = rests on a tentative technology choice, may be redone. **(decide)** = open question, not work. **(kernel)** = core code that gets pulled into existence by the slice that first needs it.
> Phases are ordering, not deadlines. Move items freely.

## How we work

- **Play first.** Every slice ends with a real campaign or session. Keep only findings that change the plan, inline in the relevant roadmap item or bet; no separate playtest report.
- **Vertical slices, not layers.** A slice touches data, editor, UI and tests together. There is no kernel-only phase. Kernel code appears when a slice needs it and gets extracted into a package when a second slice needs it too. Property tests land at extraction time.
- **Bets are tested by playing with them,** not by reading about them. A spike that cannot be poked at inside a throwaway app shell within a day is too big.
- **Tests only where they pay: the API and the kernel packages.** The web app has no component or end-to-end tests while its features are undecided; it is verified by playing. A bug found in play that lives in kernel or API code becomes a test there. One real campaign from your past sessions is the permanent fixture.

---

## Phase 0 - Decide and de-risk

### Decisions (decide)
- [x] Can a campaign have more than one human? **Decided Sep 06, 2026: v1 is single-user, multi-device.** Shared campaigns are planned but hard, see Later. Sync authorization is doc to campaign to owner; keep a membership table anyway so sharing can be added without a migration.
- [ ] Sheet model: free body + free fields + optional components (current lean) vs mandatory types. Confirm.
- [ ] Plugin network access: none, manifest allowlist via CSP, or routed through a host proxy.
- [x] One or many AI conversations per campaign. **Decided Sep 09, 2026: many.** The index lists them; each has its own entries document. Built in Slice 0.5. Tab names (*Story*, *Library*) and folders as their own entity were decided the same day: `docs/workspace.md`.
- [ ] AI sources for v1: BYOK keys (PRODUCT.md) vs OpenRouter-first vs both. Where keys live (device only, server encrypted, or both as modes).
- [ ] Background/handoff execution: client-only while the app is open, or server-side when the client is closed. Determines whether keys must ever reach the server.
- [ ] Image generation stance: PRODUCT.md says no for now. Keep or revise.
- [x] Mobile for v1: **Decided Sep 06, 2026: later.** Desktop shell also later. Multi-device in v1 means the web app on several devices.
- [ ] Revise `PRODUCT.md` with the outcomes above. Keep it the truth.

### Playable spikes (throwaway, inside a scratch app shell so you can poke them)
- [x] Automerge 3 + ProseMirror: edit a sheet with body + fields, sync two tabs, measure doc size after 1k edits. **(bet) Ran Sep 09, 2026 (`apps/spike-sheet`): holds.** Rich text, marks and fields sync both ways between tabs and survive a reload. 1,000 editor edits: ~11 B each, 0.6 → 11.7 KB; 1,000 rewrites of one field: ~8 B each, → 19.9 KB; 2,053 changes, ~5 B per body char. Findings that change the plan: (1) `@automerge/prosemirror` must be *pre-bundled with* the ProseMirror packages and `resolve.dedupe`d in Vite — served raw it loads a second `prosemirror-model` and every edit throws; carry that into `apps/web/vite.config.ts` for Slice 1. (2) `handle.change` costs 7–16 ms per call in a tight loop through automerge-repo, so imports and AI-proposed batches go in one change, never one per field. (3) The basic schema adapter covers paragraphs, headings, lists, quotes, code, an image block and link/em/strong/code marks. Tables are the one gap, and mentions can ride the link mark. The binding is 0.2.0 and says so.
- [ ] QuickJS in Worker in sandboxed cross-origin iframe: run untrusted code, enforce CPU + memory limits, kill it, call a host capability. **(bet)**
- [ ] Panel layout with plugin iframes in a fixed top layer: drag panels, confirm iframes never reload. **(bet)**
- [ ] Reactive projection: Solid stores vs TanStack DB over the same Automerge change stream, with one join (timeline x sheets). Pick one. **(bet)**
- [ ] PGlite + pgvector as a lazy local index: build from Automerge, run a vector + full-text query, delete and rebuild. Test on Safari. **(bet)**
- [ ] Compact AI serialization: hand-write the target format for three real sheets from your own campaigns. This is the acceptance test for Slice 4.
- [ ] Storage eviction: confirm persistence request behaviour and iOS Safari eviction with a real installed PWA.
- [ ] Direct browser-to-provider AI call with a device-held key (OpenRouter and at least one direct provider). Confirms Phase 3 needs no server.

---

## Phase 1 - Foundation, just enough

Only what is needed to run and test the web app. The rest is done alongside Phase 2, never before it.

### Before Slice 1
- [x] pnpm 12 workspace with catalogs; `minimumReleaseAge` 3 days (non-strict: strict mode fails on every fresh transitive publish, non-strict still never installs a young version), `strictDepBuilds` with an `allowBuilds` allowlist, `blockExoticSubdeps`
- [x] TypeScript 7.0.2; `verbatimModuleSyntax`, `erasableSyntaxOnly`, ESM only, internal packages export source. `isolatedDeclarations` deferred to published packages: it forces explicit annotations on every exported Zod schema
- [x] Biome 2 with its Solid rule domain; shared `config` package. ESLint dropped: its Solid plugin needs typescript-eslint, which cannot run on TypeScript 7 until 7.1
- [x] Vitest 4.1 (browser mode in Chromium) + Playwright 1.62 green; fast-check in use
- [x] CI: lint, typecheck, test, build, e2e; actions pinned by SHA; frozen lockfile
- [x] `apps/web` on Solid 1.9 + Vite 8; `schema`, `crdt` and `ai` packages (not empty: Slice 0 pulled them in)
- [x] `README.md`: how to run, how to playtest

### Alongside Phase 2
- [x] Turborepo 2.10, local cache. Remote cache not configured
- [ ] Changesets; publishing with provenance (needed at Phase 5 for the SDK)
- [ ] Security CI: vulnerability scan on lockfile, secret scanning, SBOM on release
- [ ] lefthook done (pre-commit Biome, pre-push typecheck + test). Renovate with cooldown: pending
- [ ] Remaining package skeletons from `docs/stack.md` as slices need them

---

## Phase 2 - Local app, playable from the first slice

Everything here works offline, without an account, on IndexedDB. No AI beyond Slice 0's narration.

### Slice 0 - A narrative you can write into (built Sep 06, 2026)
Pulled forward from Slices 3 and 7 so there is something to play with on day one.
- [x] Dark theme through semantic tokens in `app.css`; Tailwind's palette is removed so utilities only know the tokens
- [x] Narrative feed + composer; entries render sanitized Markdown and persist their editable source to IndexedDB through Automerge Repo; tabs sync over BroadcastChannel
- [x] Storage persistence request on boot. Its result is no longer shown anywhere (Sep 08, 2026: no storage setting wanted); the loud durability warning for local-only campaigns remains a Slice 2 item
- [x] OpenRouter narration through the AI SDK with a device-held key; the streamed reply is written to the document once, with model, turn id and token usage in provenance
- [x] Settings is a page with icon tabs (AI only for now) and titled sections (Provider, Narrator), not a modal: key, narrator model autocomplete (default Claude Haiku 4.5), narrator instructions, storage state. A second model is not configured: the bets doc replaced the executor handoff with deterministic writes, and any worldbuilder model comes back only when that bet is spiked
- [x] (kernel) NarrativeEntry, Provenance, AiSettings schemas; `campaign-index` and `timeline:<id>` documents
- [x] Tests: schema property test, CRDT round-trip, message mapping, API. Web component and e2e tests were removed on Sep 07, 2026 (decision above)
- [x] `apps/api` (Hono + oRPC on Node 24) and `packages/contract` created early to fix the boundary: health, model catalogue with live prices, OpenAPI document. Narration stays in the browser with the device-owned key
- [x] Writes are flushed to IndexedDB after every entry and the header shows saving/saved; a reload inside the Repo's save debounce used to lose the entry
- [x] Unsent composer draft kept per campaign across reloads
- [x] Undo/redo, 50 steps per campaign, next to the composer and on Ctrl+Z / Ctrl+Shift+Z. Inverse actions in `packages/crdt`, stack in localStorage so it survives reloads. Appending a split reply is one step. Entry delete no longer confirms
- [x] Animated hamburger + left drawer: campaign list with create, switch and two-step delete; Settings entry; mock guest user. Icons via lucide-solid; contrast bug fixed (an unlayered rule in app.css beat every utility); title renames inline. Campaign list is a local registry (`campaign/library.ts`) until it becomes the account's list in Slice 11
- [x] Entries are editable and deletable in place (hover reveals edit/delete, Ctrl+Enter saves, delete confirms). Edits are Automerge text diffs, so concurrent edits merge; `editedAt` marks them. The AI's entries are editable too: the timeline is the player's
- [ ] **Play:** one real session with the AI; capture only findings that change the plan.
- Known gaps: key in plain localStorage; context is the last 40 entries; no meta channel; no undo (edits and deletes are final until the undo manager in Slice 4); no export; Vite dev needs Automerge excluded from pre-bundling (see `vite.config.ts`); ESLint's Solid rules are covered by Biome only until typescript-eslint supports TS 7.1

### Slice 0.5 - The workspace shell (built Sep 09, 2026)
Pulled forward from Slices 3 and 5 so the library has somewhere to land. Design: `docs/workspace.md`.
- [x] Tabs: icons at the right end of the campaign header; Story and Settings. Every tab stays mounted, the open one is displayed
- [x] Panels: every region of a tab, behind a slim bar with actions, status and `⋯`. Peers that talk through tab state, never through each other
- [x] Story tab: Conversations panel (create, rename inline, archive, restore, hide) beside the Narrative panel, bound to the active conversation
- [x] (kernel) `Conversation` shape; `campaign-index` lists conversations and carries `instructions`; one `conversation:<id>` entries document each; Slice 0 indexes migrate on open
- [x] Campaign Settings tab: narrator instructions per campaign, synced; unset means the device default, and the Settings page's field is now that default
- [x] Undo history, drafts and the open conversation are per conversation and per device
- [ ] Reorder and delete conversations; tab-level `⋯` for hidden panels and layout reset (the Library tab landed Sep 09, 2026, in Slice 1)
- [ ] **Play:** one session across two conversations. Does splitting the story into threads help or scatter it?

### Slice 1 - A sheet you can write
- [x] ProseMirror bound to Automerge; one sheet document persisted to IndexedDB **(bet)** — built Sep 09, 2026 as the Library tab: tree panel (folders as their own entity, create/rename/archive/restore, remove empty folders), sheet panel (title, ProseMirror body, block commands in the panel `⋯`), fields panel. `@automerge/prosemirror` pre-bundled with ProseMirror and deduped in Vite, as the spike found. Move-to-folder and reorder exist in the kernel, not yet in the UI
- [x] Free-form fields panel (key: value) on every sheet (Sep 09, 2026; values are text diffs, so two devices merge)
- [ ] References and mentions between sheets with stable ids; tables; images from local assets. The basic schema adapter already carries an image block and a `link` mark; a mention can ride the link mark with a `sheet:` href. Tables are the open gap
- [ ] Sanitized rendering on every content path; external images blocked by default. Pasted `<img>` is stripped for now, until images come from local assets
- [ ] (kernel) stable ids; Sheet shape: body, fields, refs, meta. Body and fields done Sep 09, 2026; refs and meta pending
- [x] (kernel) `sheet:<id>` Automerge document shape; `Folder` and `SheetSummary` records in `campaign-index` (Sep 09, 2026)
- [ ] **Play:** rewrite three characters and one location from a past campaign. Notice what the editor cannot express.

### Slice 2 - A campaign you will not lose
- [x] Create, open, list campaigns; `campaign-index` document (done in Slice 0's sidebar; rename by clicking the title)
- [ ] Storage persistence request; loud durability warning on local campaign creation
- [ ] Automatic file backups; "last backed up" indicator
- [ ] Campaign bundle export and import (documents + assets + manifest)
- [ ] Markdown export of a sheet as a representation, never storage
- [ ] (kernel) `campaign-index` document; bundle format
- [ ] **Play:** export, wipe browser storage, import. Nothing lost. Then open the export in Obsidian and see what survives.

### Slice 3 - Timeline and chat, by hand
Naming: the tab is *Story* and each thread a *conversation* (Slice 0.5). *Timeline* here means fictional-time events, a panel of its own (`docs/workspace.md`).
- [ ] Timeline: create, reorder, edit, delete events; link events to sheets
- [ ] Chat: narrative channel vs meta channel (sheet/timeline updates, off-immersion notes). Manual messages, you play both sides
- [ ] Images placed freely in chat and sheets
- [ ] (kernel) `timeline:<id>`; `chat:<id>` chunked; campaign-time type (fictional time, not `Date`); message kind
- [ ] **Play:** transcribe one past session into chat and timeline. Does the narrative/meta split feel right? Does the timeline need branching?

### Slice 4 - Structure when you want it
- [ ] Components: define, attach several to one sheet, component-driven forms, validation only for claimed fields
- [ ] Undo/redo across body, fields and timeline
- [ ] (kernel) typed operation set: set field, insert/replace/delete block, add/remove reference, create/archive sheet, attach/detach component, timeline and chat ops
- [ ] (kernel) write pipeline: validation, policy stub, transaction with provenance; inverse operations grouped by intent; event stream out
- [ ] (kernel) compact AI view driven by attached components, degrading cleanly for untyped sheets; must match the Phase 0 hand-written target
- [ ] (kernel) extract `schema`, `model`, `crdt`, `serialize`, `ops` packages; property tests for round-trips and inverses land here
- [ ] **Play:** take the untyped sheets from Slice 1 and progressively attach components. Nothing should need re-entering. Undo an hour of edits.

### Slice 5 - Your layout
- [ ] Own panel engine: split, dock, tabs, saved layouts per campaign; builds on Slice 0.5's panels and tab state **(bet)**
- [ ] Fixed top-layer surface wired now, empty, for future plugin iframes
- [ ] Virtualized chat and timeline lists; command palette; context menus; keyboard model
- [ ] **Play:** build the layout you actually want for a session. Drag things around while a sheet is open.

### Slice 6 - Find and query
- [ ] Reactive projection over Automerge, whichever spike won **(bet)**
- [ ] PGlite lazy index: full-text and structured queries over sheets **(bet)**
- [ ] Query blocks inside sheets (Dataview-like) reading from the index
- [ ] **Play:** answer "who is in this city right now?" without opening a sheet.

**Done when:** you run a full solo session's bookkeeping in Archefict instead of Obsidian, with no AI.

---

## Phase 3 - AI, locally

Moved ahead of cloud: this is where playing starts for real, and none of it needs a server. Everything runs in the browser against providers directly with a device-held key.

### Slice 7 - Talk
- [ ] Model policy: which app area uses which model; user-editable, read at runtime
- [x] Catalogue carries tool support (`supported_parameters`); the picker shows models without it dimmed, tagged and unselectable, and the caption warns when one is typed by hand (built Sep 09, 2026, with Slice 0.5)
- [ ] AI sources per Phase 0 (BYOK and/or OpenRouter), provider-independent adapter **(bet)**
- [ ] Device-owned key mode: key never leaves the device **(bet)**
- [ ] Spend: per-request token accounting, per-campaign and monthly budgets with hard stops, ledger view
- [ ] Chat with a model in the narrative channel; meta channel stays yours
- [ ] **Play:** one full session, chat only. The AI sees nothing but the conversation.

### Slice 8 - The AI reads
- [ ] Tools: `library.tree`, `library.search`, `library.read`; typed once in the schema package, the AI SDK takes the Zod directly (`docs/workspace.md`)
- [ ] Strategic sheet querying: retrieval over the PGlite index, chunked by block, hybrid search; client-side embeddings **(bet)**
- [ ] Prompt hygiene: untrusted content delimited, tool results parsed defensively
- [ ] **Play:** one session where the AI answers from sheets it looked up itself. Notice what it should have looked up and did not.

### Slice 9 - The AI writes
- [ ] Context model produces a typed plan; executor model emits operations through the pipeline
- [ ] `library.propose`: one write tool for every operation type; the pipeline validates each
- [ ] Approval tiers for write tools; "undo this AI turn"; provenance on every AI change
- [ ] Deterministic policy in the pipeline is real now, not a stub
- [ ] **Play:** one session where the AI updates sheets and timeline. Inspect every change. Undo at least one.

### Slice 10 - The AI runs code
- [ ] On-demand code runner in the client sandbox: read-only access to named sheets, CPU/memory/time limits, output cap **(bet)**
- [ ] Results come back as operations, never applied directly
- [ ] **Play:** ask for something that needs computation (a roster, a dice table, a relationship graph).

**Done when:** a full session where the AI updates campaign state through operations you inspected, approved and undid.

---

## Phase 4 - Cloud, one user on many devices

### Slice 11 - Account
- [ ] Better Auth with Google and Discord; sign-up, login, account linking **(bet)**
- [ ] Host-only cookies; plugin content domain reserved and separate
- [ ] Hono API service; contract-first routes with generated client **(bet)**
- [ ] Postgres with Drizzle: users, campaigns, membership (owner only for now), document metadata, assets **(bet)**
- [ ] Row-level security; account deletion; data export; retention policy

### Slice 12 - Sync
- [ ] Sync service with per-document authorization: doc to campaign to owner on every request **(bet)**
- [ ] Server-side document storage: change chunks + compacted snapshots in object storage
- [ ] Campaign storage mode: cloud (default) or local; migrate either way
- [ ] Short-lived campaign-scoped tokens; device as a principal
- [ ] **Play:** same campaign on laptop and phone browser. Edit offline on one, reconnect.

### Slice 13 - Cloud extras
- [ ] Background projector: Automerge to JSONB on change
- [ ] Object storage: presigned uploads, quotas, image re-encoding, separate user-content origin
- [ ] Managed key mode with envelope encryption, only if Phase 0 chose server-side execution **(bet)**
- [ ] Rate limiting and abuse controls; observability with secret redaction
- [ ] **Play:** wipe one device completely. Everything comes back.

**Done when:** the same campaign edits on two devices and survives one of them being wiped.

---

## Phase 5 - Plugins

### Slice 14 - Host and SDK
- [ ] Plugin host: one QuickJS runtime per plugin, in a Worker, in a sandboxed cross-origin iframe **(bet)**
- [ ] Explicit versioned message protocol; every inbound message schema-validated
- [ ] Capability table per plugin per campaign; revocation; `hostApiVersion` in manifests
- [ ] Permission vocabulary: sheets, timeline, chat, ui, ai:tools, ai:complete, storage, net; network default-deny
- [ ] Plugin SDK package: types, manifest schema, client library, published with provenance
- [ ] Plugin-scoped storage synced with the campaign

### Slice 15 - Surfaces
- [ ] Custom views, timeline components, HUDs, overlays as thin iframes in the top layer
- [ ] Chat input control surface
- [ ] Always-visible plugin chrome; pointer events off while host dialogs are open; no secrets on plugin-adjacent screens
- [ ] Plugin-supplied LLM tools: namespaced, risk-tiered, descriptions treated as reviewed content
- [ ] Enable/install per campaign; consent screen; re-consent on permission expansion
- [ ] Sideload from file with a warning, hash shown, reduced default grants
- [ ] **Play:** write a HUD plugin yourself using only the SDK docs. Then write a deliberately malicious one and confirm it cannot read another campaign, cookies or keys.

**Done when:** a third party could build a HUD from the SDK docs alone, and the malicious plugin fails.

---

## Phase 6 - Scenarios and marketplace

- [ ] Scenario format: rules, required plugins, components, custom initial campaign form
- [ ] Marketplace listing of plugins and scenarios; install from listing
- [ ] Signed, content-addressed bundles pinned by hash; revocation list checked on load; kill switch per version
- [ ] Scanned tier and verified tier, shown in the UI; publisher accounts and keys; content policy
- [ ] **Play:** package one of your own campaigns' setups as a scenario and start a fresh campaign from it.

**Done when:** a scenario installs its plugins, shows its form, and produces a ready campaign.

---

## Phase 7 - Shells, later

Nothing earlier may depend on a shell. The platform interface keeps the door open.

- [ ] Platform interface: secrets, files, network mode, local model runtime; web implementation first
- [ ] Tauri 2 desktop: OS keychain keys, file vault backups, deep-link OAuth, local MCP via sidecar **(bet)**
- [ ] Zero-network desktop mode
- [ ] Installed PWA on mobile validated; Tauri mobile evaluated

---

## Cross-cutting checklists

### Playtesting (every slice)
- [ ] The fixture campaign updated with whatever the slice added
- [ ] Every bug found in play has a test

### Security (verify each phase)
- [ ] Main document never sends COOP/COEP; CI asserts it
- [ ] Plugin iframes: `allow-scripts` only, separate registrable domain, never `srcdoc`/`blob:`
- [ ] No runtime code-loading API exists for plugins
- [ ] Provider keys never reach plugins, sandboxes, logs or the client bundle
- [ ] Every uploaded image re-encoded; user content on its own origin
- [ ] Security state (membership, grants, keys) only in Postgres
- [ ] Threat model document updated per phase; external review before marketplace launch

### Quality
- [ ] Property tests: serializer round-trips, operation inverses, CRDT merge invariants
- [ ] Browser-mode tests for sandbox, iframe and WASM code
- [ ] Sync and plugin-host code get tests when they exist; the web UI does not
- [ ] Performance budgets: boot, large sheet open, long chat scroll

### Docs and ops
- [ ] Plugin SDK docs and a sample plugin
- [ ] Terms, privacy, BYOK/provider terms notice, telemetry stance
- [ ] Backups and restore drill for cloud data

---

## Later / not now

- Shared campaigns (more than one human): planned, difficult. Needs per-member document authorization, presence, conflict presentation, and what happens when a member leaves
- Desktop and mobile shells (Phase 7)
- Image generation (PRODUCT.md: no for now)
- Automatic marketplace verification
- Server-side code execution
- End-to-end encrypted campaigns (client-side search via PGlite keeps this possible)
- Archefict as an MCP server; remote MCP client
- Multi-language (WASM-first) plugins at the host level
- Managed Archefict AI source
- Keyhive/ARK as the sync authorization layer, if it stabilizes
