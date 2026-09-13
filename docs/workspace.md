# The campaign workspace

> September 09, 2026, revised September 11. The names and the folder model were decided the same
> day and are marked so; the rest is the recommended shape and changes when the code does.
> This file owns the **workspace**: tabs, panels, and how they are arranged. Two things it used to
> own moved out on Sep 11 — the sheet itself is `sheets.md`, and what the model sees is
> `ai-context.md`. `ROADMAP.md` has taken the edits listed at the end.

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
| **Sheet** | A document in the library: body, fields, refs, view (`sheets.md`). Has no children. | An HTML page. |
| **Field** | A named value on a sheet. Typed inline, stored in a map (`sheets.md`). | Text inside the prose. |

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
┌────────────────────────┬───────────────────────────────────────────────────────────────┐
│ Library         [+] ⋯  │ Varn Ashgrove                                             ⋯  │
│ ▾ Characters           │                                                               │
│   ▾ Allies             │   class Rogue   level 5   status wounded                      │
│     Varn Ashgrove   ●  │                                                               │
│     Mira Vance         │   Varn runs the docks out of a rented room above the          │
│   ▸ Rivals             │   Gullet. He owes the Thieves' Guild  900  crowns.            │
│ ▸ Places               │                                                               │
│ ▸ Factions             ├───────────────────────────────────────────────────────────────┤
│                        │ Fields                                                    ⋯  │
│                        │ class Rogue · level 5 · status wounded · debt → Mira Vance    │
└────────────────────────┴───────────────────────────────────────────────────────────────┘
```

Three panels: the **tree**, the **sheet** (body editor), **fields**.

Fields are typed inline, in the flow of writing, and stored in a map — `sheets.md` owns that
model. The fields panel is therefore not "the structured half" but **the index**: every field on
the sheet, including ones never placed in the body, and the place to see a field's owner when it
is borrowed from another sheet.

It sits **above or below the body, not beside it**. Fields are part of the document; reading them
across a vertical gutter fights that. It is still a panel, so it can be hidden or moved by anyone
who disagrees.

A sheet has four presentations — rendered, rendered with the field index, raw, and the exact
string sent to the model. The fourth is a Slice 5 panel. All four are specified in `sheets.md`.

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

### Not HTML, not Markdown

The stored thing is a block tree. Markdown and HTML are outputs, never storage. The full argument
— including why a permissive format is *not* where extensibility comes from, and the preservation
contract the tree gets for free — moved to `sheets.md` on Sep 11.

"Apps" — user-authored JS pages — are Slice 15 plugin surfaces in sandboxed iframes, not a sheet
type. They can be *pinned* into the library tree as entries later; they are not sheets. A sheet
that is not document-shaped is answered by a sheet-level `view`, not by a second sheet type.

Slice 1's spike (ProseMirror + Automerge, doc size after 1k edits) is the bet everything here
rests on. It ran on Sep 09, 2026 and holds — findings inline on the roadmap item. The untested
part is the custom adapter: tables, images, mentions, and the `field` and `embed` nodes the basic
adapter does not cover. Slice 1 writes that adapter first.

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

Moved to `ai-context.md` on Sep 11, 2026, and extended there: the four retrieval layers, the
on-stage block, layered reads for wide sheets, the `Title [id]` convention, and why tool traffic
must die with the turn.

Two rules survive as the reason the library exists at all, and the second is the one that matters:

1. **Tool definitions are context.** Every schema is sent on every request, ahead of the system
   prompt in cache order. Their count must not depend on how much content a campaign has.
2. **Content is never context by default.** It is fetched through tools — compact, capped, on
   demand — or placed deliberately by the app.

Phase 0's acceptance test — hand-write the compact form for three real sheets — is still not done
and should be done *against* `ai-context.md` before Slice 8 builds it.

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
4. **Custom schema adapter** (Slice 1): tables, images, mentions, and the `field` and `embed`
   nodes. Inline fields, transclusion and the field index move with it (`sheets.md`).
5. **Serializer and read tools** (Slice 8), after the three-sheet acceptance test
   (`ai-context.md`).

## Roadmap edits

Applied to `ROADMAP.md` on Sep 09 and Sep 11, 2026. Kept here as the record of what this file
changed.

- Phase 0 decisions: *Story* (tab 1), *Library* (tab 2), *folders as their own entity*, and *many
  conversations per campaign* — Sep 09.
- Slice 3: the conversations panel; `timeline:<id>` becomes `conversation:<id>`.
- Slice 5: the panel engine builds on panels that already exist; *tab state* is the contract
  between panels.
- Slice 7: catalogue carries tool support; the picker disables models without it.
- Slice 8: the four named tools replace "read sheet, query index, list timeline".
- `ARCHITECTURE.md`: *panel* and *tab* join the vocabulary; `campaign-index` holds conversations,
  folders, sheets and instructions.

Still pending, tracked in the two documents that own them now: the sheet model edits in
`sheets.md`, the retrieval and context edits in `ai-context.md`.
