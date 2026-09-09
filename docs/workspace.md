# The campaign workspace

> September 09, 2026. The names and the folder model were decided the same day and are marked
> so; the rest is the recommended shape and changes when the code does. `ROADMAP.md` takes the
> edits listed at the end; this file is the reference for the workspace until then.

A campaign is a set of **tabs**. A tab is a full-screen arrangement of **panels**. A panel shows one
kind of thing — the narrative, a list of conversations, the library tree, one sheet, settings —
behind a slim bar with a `⋯` menu. Tabs and panels are the UI's only nouns; everything else is
content.

## Vocabulary, and one collision

| Term | Means | Not |
| --- | --- | --- |
| **Tab** | A full-screen layout of a campaign, one icon on the top bar. | A browser tab. |
| **Panel** | A region of a tab with a bar and a `⋯` menu. Every region is one. | *Component* — that word is taken. |
| **Component** | A typed bundle of fields attached to a sheet (Slice 4). Unchanged. | A layout unit. |
| **Conversation** | One thread of play; a document of narrative entries. | The campaign's only feed. |
| **Folder** | A node of the library tree. Holds folders and sheets, nothing else. | A sheet. |
| **Sheet** | A document in the library: body, fields, refs. Has no children. | An HTML page. |

The brief used *component* for layout units. Slice 4 already uses it for the field bundles that
give a sheet structure, and the AI serialization is "driven by attached components". Two meanings
for the word the kernel is built around would cost more than a rename now: layout units are
**panels**.

## Tabs

Icons only, at the **right end** of the top bar, Settings last. Right end rather than beside the
title because the title is editable and varies per campaign; a tab that jumps with the title's
length defeats muscle memory. The far right is also where every desktop app keeps per-window
controls, and it gives Settings a fixed anchor.

- Selected tab takes `text-accent`; the sidebar already spends the accent on the active item, so
  this is the same meaning. Others `text-fg-muted`, `hover:text-fg`. `aria-label` and a tooltip
  on each; no visible text.
- Default tabs: **Story**, **Library**, **Settings**. Settings is `removable: false` and movable.
  Users add, remove, reorder and build their own tabs in Slice 5; nothing here should preclude
  it, nothing here builds it.
- Tab order and layout are a device preference (`archefict:layout:<campaign>` in localStorage)
  until Slice 5 decides whether layouts sync. Defaults need no storage at all.

### Why *Story*, not *Timeline*

Decided Sep 09, 2026: **Story**.

The brief calls the first tab "Timeline, the one we already made". The roadmap already uses
*Timeline* for something else: fictional-time events with reorder and sheet links (Slice 3), a
sibling of *Chat*, which has narrative and meta channels. `PRODUCT.md` says "separate timeline
from chat". The document is named `timeline:<id>` today because Slice 0 pulled the chat forward
under the wrong name.

Two things called Timeline will collide the day Slice 3 lands. The tab is where the story is
played: **Story**. Each thread in it is a **conversation**. The events timeline arrives later as a
panel of its own. Renaming the document to `conversation:<id>` is free at the moment the shape
changes anyway — when a campaign gets more than one.

## Panels

Every region of a tab is a panel, including the sidebar the brief was unsure about. The doubt
was real: a conversation list *belongs to* the narrative next to it, and making them peers seems
to lose that. It doesn't, if the relationship lives in the tab rather than in the tree:

- A tab has **state** — `activeConversationId`, later `activeSheetId`, a selection.
- Panels read and write tab state. The conversations panel writes `activeConversationId`; the
  narrative panel reads it. Neither knows where the other is.
- So the list can sit left, right, above, or in a second column, and the narrative still follows
  it. That is the whole of Slice 5's malleability, and it costs nothing now.

The rule that makes this hold: **a tab contains panels and nothing else.** No bare content, no
special-cased sidebar. Arrangement is fixed per default tab today and edited in Slice 5.

### The bar

Height `h-8`. Title in `text-fg-muted text-xs`, an actions slot (the panel's one or two primary
buttons: *new conversation*, *new sheet*), then `⋯`. The menu holds the panel's own options first;
layout options (*hide*, later *move*, *split*) after a separator. A hidden panel comes back from
the tab's own `⋯` at the end of the top bar, which lists panels with checkmarks and offers
*Reset layout*. Until Slice 5 that tab menu can be a single *Show conversations* toggle.

Settings is a tab with one panel and an almost empty `⋯`. Uniformity is worth a redundant bar.

## Story

```
┌──────────────────────────────┬────────────────────────────────────────────────────────┐
│ Conversations         [+] ⋯  │ Narrative                                          ⋯  │
│ ────────────────────────────│                                                        │
│ ● The Ashgrove Heist         │   …feed…                                               │
│   Downtime, week 3           │                                                        │
│   (archived) Session zero    │                                                        │
│                              │ ┌────────────────────────────────────────────────────┐ │
│                              │ │ composer                                           │ │
└──────────────────────────────┴─┴────────────────────────────────────────────────────┴─┘
```

- **Conversations panel**: list, create, rename inline, archive (undoable, so no confirm),
  reorder. Active one highlighted. Width `w-64`, collapsible.
- **Narrative panel**: the existing feed and composer, bound to the active conversation. Undo
  history is already per document; it becomes per conversation for free if keyed by doc url.
- Data: `campaign-index` gains `conversations: [{ id, title, docUrl, createdAt, archivedAt? }]`;
  one `conversation:<id>` document each. The session opens the active one; switching swaps the
  handle, not the session.
- The meta channel (Slice 3) is not designed here. Keep it possible: a conversation may later hold
  more than one channel, or meta may be campaign-wide. Neither is blocked by this shape.

## Library

```
┌────────────────────────┬────────────────────────────────────────────────┬──────────────┐
│ Library         [+] ⋯  │ Varn Ashgrove                              ⋯  │ Fields    ⋯  │
│ ▾ Characters           │                                                │ class  Rogue │
│   ▾ Allies             │   …body…                                       │ level  5     │
│     Varn Ashgrove   ●  │                                                │ status alive │
│     Mira             │                                                │ faction  →   │
│   ▸ Rivals             │                                                │              │
│ ▸ Places               │                                                │ + field      │
│ ▸ Factions             │                                                │              │
└────────────────────────┴────────────────────────────────────────────────┴──────────────┘
```

Three panels: the **tree**, the **sheet** (body editor), **fields**. The fields panel is separate
from the sheet panel on purpose: it is the structured half, the part the AI reads first and the
part Slice 4's components attach to. It can be hidden or docked under the body by anyone who
prefers that.

### The name

Decided Sep 09, 2026: **Library**. It names a place, not a type: sheets live there now, plugin views and
assets can live there later, and folders are natural in a library. *Codex* is the flavourful
alternative and fits the domain; it implies lore entries specifically, which is fine today and
narrower tomorrow. The item stays a **sheet** either way.

### Folders and sheets

Decided Sep 09, 2026: **folders are their own entity.** A folder holds folders and sheets; a sheet
holds nothing. The Notion-style alternative — every sheet can contain sheets, a folder being a
sheet with children — was considered and declined in favour of the classic model.

Two lists in `campaign-index`: `folders: [{ id, title, parentId, order }]` and
`sheets: [{ id, title, folderId, order, docUrl, archivedAt? }]`. Bodies live in `sheet:<id>`,
one document each, as `ARCHITECTURE.md` already says. Move, rename and archive are one operation
set that takes either kind, and the AI's `library.tree` returns both, tagged.

### Not HTML, not Markdown: a tree with two projections

The brief floats HTML storage with a serializer for the AI. The roadmap already answers this
and the answer is better than either: Slice 1 binds **ProseMirror to Automerge** and Slice 2 says
Markdown export is *a representation, never storage*. The stored thing is a block tree.

- **Editor** renders the tree to HTML. Sanitization is a rendering concern, not a storage one; an
  HTML store would make every read path an XSS boundary.
- **AI** reads the tree through the compact serializer below. No parsing of markup, no
  guessing at structure.
- **CRDT** merges typed nodes, not characters inside tags. Two devices editing one paragraph
  merge as a paragraph.

"Apps" — user-authored JS pages — are Slice 15 plugin surfaces in sandboxed iframes, not a sheet
type. They can be *pinned* into the library tree as entries later; they are not sheets.

Slice 1's spike (ProseMirror + Automerge, doc size after 1k edits) is the bet everything here
rests on. It ran on Sep 09, 2026 and holds — findings inline on the roadmap item. The one
untested part is the schema for tables, images and mentions, which the basic adapter does not
cover; Slice 1 writes that adapter first.

## Settings

The campaign's own settings; the global page keeps what is global.

| Global (existing page) | Campaign (new tab) |
| --- | --- |
| Provider key | **Instructions** — moved here |
| Default narrator model | Narrator model override, later (Slice 7 model policy) |
| | Plugins enabled here (Slice 15), export and backups (Slice 2) |

Instructions are content, and content syncs: `campaign-index.instructions`, nullable. Null means
"use the global default", and the textarea shows the default text with *Reset to default* in its
`⋯`. This keeps the global field meaningful — it is the template — without a copy step.
Keys stay in localStorage as `ARCHITECTURE.md` requires.

## What the AI sees

This is what the library is *for*. Two rules, and the second is the one that matters:

1. **Tool definitions are context.** Every schema is sent on every request, ahead of the system
   prompt in cache order. Their count must not depend on how much content a campaign has.
2. **Content is never context by default.** It is fetched through tools, compact, capped, on
   demand.

### The compact sheet

A candidate. Phase 0's acceptance test — hand-write the target for three real sheets — has not
been done and should be done *against* this before Slice 8 builds it.

```
# Varn Ashgrove  [s_k3f]  Characters/Allies
class: Rogue · level: 5 · status: alive · faction: [[Thieves' Guild|s_9qa]]
---
Body as compact Markdown. Headings, lists and pipe tables survive; emphasis inside prose
survives; empty formatting, alignment and images drop to (image: alt). A mention is
[[Title|s_id]] so the model can follow it with one call.
```

Header first because it is cheapest and most useful: id, path, fields, refs, one line each. Body last because it is largest and often unnecessary: `read` takes `body: "none" | "summary"
| "full"`. Ids are short and stable so the model can hold several in working memory. Every string
that came from a sheet is untrusted — Slice 8's prompt hygiene delimits it.

### The tools

Slice 8 defines three. Slice 9 adds one. There is no fourth read tool and there is no tool per
component: components are *data inside* `read`'s answer, which is what "compact AI view driven by
attached components, degrading cleanly for untyped sheets" means.

| Tool | Input | Output | Why it exists |
| --- | --- | --- | --- |
| `library.tree` | `root?`, `depth = 1` | `[{ id, kind, title }]` | Orientation. Cheap. Folders and sheets, tagged, so the model sees the shape before searching. |
| `library.search` | `q`, `limit = 8` | `[{ id, title, path, snippet }]` | Titles and fields now; the PGlite index in Slice 6/8. |
| `library.read` | `ids[]`, `body = "full"` | compact sheets | Batched: three characters is one call, not three round trips. |
| `library.propose` | `ops[]` | `[{ accepted, reason? }]` | Slice 9. One tool for every operation type; the write pipeline validates each. |

Names are short and namespaced; descriptions terse; results capped by `limit` and snippet length;
every id echoed back so the model can chain calls. Zod once, in `packages/schema`: the AI SDK's
`tool({ inputSchema })` takes it directly, so the contract and the tool definition are one shape.

What the narrator gets **without asking** is a tuning question for Slice 8, not a design one:
plausibly the sheets mentioned in the last few entries, in compact form, capped. It cuts the
common case to zero round trips and is worth measuring, not assuming.

## Models that cannot do this

364 of 431 models in today's OpenRouter catalogue advertise `tools`. The rest — `openrouter/fusion`,
Gemini image variants, the Hunyuan translators — would take the narrator's instructions and
silently fail every tool call.

- `ModelInfo.tools: boolean`, from `supported_parameters` containing `"tools"`. The built-in
  fallback list is all `true`.
- In the picker: **dimmed, tagged *no tools*, not selectable** — click and Enter refuse, arrow
  keys skip, sorted after supported models of the same rank. Shown rather than hidden so the
  absence explains itself.
- The field stays free text, because any id is valid to send; the caption under it says plainly
  that the model cannot use tools. That is a fact today and becomes a warning at Slice 8.

## Order of work

1. **Workspace shell.** Tab bar, `Panel` with bar and `⋯`, Story tab with fixed two-panel layout,
   Settings tab with Instructions moved. Conversations in `campaign-index`. Reuses every part of
   Slice 0. Pulled forward the way Slice 0 was.
2. **Tools flag** in the catalogue and the picker. Small; alongside 1.
3. **Library tab.** Done Sep 09, 2026: tree, create/rename/archive, fields panel, ProseMirror body
   from day one since the spike passed. Move-to-folder and reorder are in the kernel, not yet the UI.
4. **Serializer and read tools** (Slice 8), after the three-sheet acceptance test.

## Proposed roadmap edits

- Phase 0 decisions: record *Story* (tab 1), *Library* (tab 2) and *folders as their own
  entity*, all Sep 09, 2026. Mark *One or many AI conversations per campaign* decided: many.
- Slice 3: rename to *Story: conversations, meta channel, events*; add the conversations panel;
  note `timeline:<id>` → `conversation:<id>`.
- Slice 5: the panel engine builds on panels that already exist; add *tab state* as the contract
  between panels.
- Slice 7: add *catalogue carries tool support; picker disables models without it*.
- Slice 8: replace "Tools: read sheet, query index, list timeline" with the three named above.
- `ARCHITECTURE.md`: *panel* and *tab* join the vocabulary; `campaign-index` holds
  conversations, folders, sheets and instructions.
