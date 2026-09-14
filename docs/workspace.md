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
| **Model** | A sheet other sheets take their shape from: its fields, their types, its values as defaults (`sheets.md`). Was *component* until Sep 13, 2026. | A layout unit; the AI model. |
| **Conversation** | One thread of play; a document of narrative entries. | The campaign's only feed. |
| **Folder** | A node of the library tree. Holds folders and sheets, nothing else. | A sheet. |
| **Sheet** | A document in the library: body, fields, refs, view (`sheets.md`). Has no children. | An HTML page. |
| **Field** | A named value on a sheet. Typed inline, stored in a map (`sheets.md`). | Text inside the prose. |

The brief used *component* for layout units, and the kernel used it for the field bundles that
give a sheet structure. Both uses are gone: layout units are **panels**, and the bundles are
**models** (decided Sep 13, 2026). *Model* meets the AI model only in code, where a sheet's
record says `models` and the AI side says `narratorModel`; in the UI the two never share a
screen.

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

Height `h-6`, a hairline under it, and **no name**: an optional status, then `⋯`, both pushed
right. The bar started with a title and lost it — a panel and its one section were saying the
same word twice, *Conversations* over *OPEN*, *Library* over *SHEETS*, so the name went to the
section, which is where the content it names begins. What is left on the bar is exactly what is
about the panel rather than about what is in it: somewhere to grip, how the document is doing,
and the options. The `title` prop stays as the panel's accessible name and labels its menu.

No hover tint — the only tone a bar could take is the ground's, which reads as a hole punched in
the card rather than a highlight; the grab cursor is what says it is a handle. The menu holds the
panel's own options first, including everything its sections can make, then layout options
(*hide*, *move left*, *move right*, later *split*) after a separator. A hidden panel comes back from
the tab's own `⋯` at the end of the top bar, which lists panels with checkmarks and offers
*Reset layout*. Until Slice 5 that tab menu can be a single *Show conversations* toggle.

Settings is a tab with one panel and an almost empty `⋯`. Uniformity is worth a redundant bar.

### Sections

Inside the body, a panel holds **sections**: a named group with a header of its own — small,
uppercase, `text-fg-subtle` — carrying both the panel's name and that group's actions, the
actions revealed on hover the way a row reveals rename and archive. Every visible name in a tab
is a section's: *CONVERSATIONS*, *SHEETS*, and *ARCHIVED* under each list. *New sheet* and *new folder* belong to the sheets, not to the frame
around them, which is why they left the bar. VS Code's Explorer is the same shape and for the
same reason: one view, several groups, each with its own buttons.

What this buys is room. A panel can grow a second group — an outline, what was opened recently,
a filter — without its bar growing a second set of buttons, and without either group having to
become a panel of its own.

Sections do not collapse. The one thing that folds is **Archived**, which is not a section: it
sits under the list it left, pinned to the bottom of the panel, saying how many there are even
while closed. One shared piece serves both tabs (`list-row.tsx`). It is *set* like a section
header — 11px, uppercase, `text-fg-subtle` — because *Open* and *Archived* are a pair, and a
pair that reads as one thing needs one typeface between them.

Hover-revealed buttons are not discoverable on their own, so every section action is also an item
in the panel's `⋯`. That menu is the answer to "how would anyone know", and it is the keyboard's
way in as well.

### The card

A panel is a rounded card in `--bg`, with no border, on a tab ground of `--surface`; the gutter
of ground between two panels is the whole of what separates them. Tone said it before, which
meant the list and the narrative had to disagree about which of them was the darker one — a
question Slice 5 cannot answer once panels move. A gutter has no such question: every panel is
the same card wherever it lands, and the ground shows through between them, which is also where
a dragged panel will be dropped. The top bar sits on the ground too, outside the cards, so the
campaign title and the tabs read as the shell rather than as part of the story.

The tones inside follow from it: the panel is `--bg`, a row under the pointer `--surface`, the
active row `--surface-raised`, and a text control `--surface-sunken` — a well cut below whatever
holds it, whether that is a panel or a settings card. A row's own buttons darken to `--bg` on
hover instead of lifting, because the panel's tone is the one thing below every row state.

Rows are `rounded-lg`, not `rounded-xl`: at 12px the corner curves away from the accent rule on
the left edge and leaves it floating. Every row in every panel reads `[icon] [label]` from one
inset, so the conversations and the sheets line up across the gutter between two panels; the tree
steps a sheet in by a chevron's width only where there are folders beside it to line up with.

The active row also takes a hairline of accent down its left edge (`ACTIVE_ROW`, `list-row.tsx`),
in the sidebar, the conversations and the tree alike. Two signals rather than one: tone alone is
four steps of lightness in a dark theme, and the smallest dose of accent that reads is a 2px rule.

### Moving and resizing

Shipped ahead of the rest of Slice 5, because a panel that says *move me* with a bar and a `⋯`
and then cannot be moved is worse than no bar at all. What exists:

- **Drag the bar** to change the order along the row. The press has to travel 4px first, so the
  bar's buttons still take clicks, and a panel only changes place once the pointer is past the
  midpoint of the panel it is passing — otherwise a still hand makes two panels flicker.
- **Drag a gutter** to change the widths. One panel per tab takes the leftover (`width={null}`);
  the others carry pixels, and a gutter resizes whichever of its two neighbours has pixels.
  Arrow keys on a focused gutter move it 16px at a time. Widths clamp to 160-720px.
- **Move left / move right** in the panel's `⋯`, after a separator, which is the same rearranging
  for a keyboard.
- Order and widths are remembered per tab in `localStorage`, like drafts and the sidebar. They are
  a device's preference, not campaign content, so they never reach the document.

Position is CSS `order`, never DOM order: a dragged panel keeps its element, so a streaming reply,
a scroll position and a ProseMirror view all survive the move. Panels take the even orders and the
gutters between them the odd ones.

Still Slice 5's: moving a panel between tabs, splitting, stacking, vertical arrangement, hiding
from a tab-level `⋯`, and *Reset layout*.

## Story

```
┌────────────────────────────────────────────────────────┬──────────────────────────────┐
│                                                     ⋯  │                           ⋯  │
│                                                        │ CONVERSATIONS             +  │
│   …feed…                                               │   ● The Ashgrove Heist       │
│                                                        │     Downtime, week 3         │
│ ┌────────────────────────────────────────────────────┐ │                              │
│ │ composer                                           │ │                              │
│ └────────────────────────────────────────────────────┘ │ › ARCHIVED (1)               │
└────────────────────────────────────────────────────────┴──────────────────────────────┘
```

- **Conversations panel**: list, create, rename inline, archive (undoable, so no confirm),
  reorder. Active one highlighted. Width `w-64`, collapsible, and on the **right**: the prose
  is what the eye returns to, so it keeps the left edge, and hiding the list widens the reading
  column instead of sliding it sideways. The Library's tree sits right for the same reason.
  Slice 5 lets anyone move either.
- **Narrative panel**: the existing feed and composer, bound to the active conversation. Undo
  history is already per document; it becomes per conversation for free if keyed by doc url.
- Data: `campaign-index` gains `conversations: [{ id, title, docUrl, createdAt, archivedAt? }]`;
  one `conversation:<id>` document each. The session opens the active one; switching swaps the
  handle, not the session.
- The meta channel (Slice 3) is not designed here. Keep it possible: a conversation may later hold
  more than one channel, or meta may be campaign-wide. Neither is blocked by this shape.

## Library

```
┌───────────────────────────────────────────────────────────────┬────────────────────────┐
│                                                            ⋯  │                     ⋯  │
│ ↶ ↷ │ ¶ H1 H2 H3 │ B I <> │ ≡ ≣ ❝ ⌨ ▦ │ ⇤ │ # {}        ☰ </> │ SHEETS            + +  │
│   Varn Ashgrove                                               │   ▾ Characters         │
│                                                               │     ▾ Allies           │
│   class Rogue   level 5   status wounded                      │         Varn Ashgrove ●│
│                                                               │     ▸ Rivals           │
│   Varn runs the docks above the Gullet. He owes [Mira Vance]  │   ▸ Places             │
│   a sum of [850] crowns.                                      │   ▸ Factions           │
│                                                               │                        │
│                                                               │ › ARCHIVED (2)         │
└───────────────────────────────────────────────────────────────┴────────────────────────┘
```

Two panels: the **sheet** (body editor) against the reading edge, the **tree** far right. The
fields panel is gone (Sep 13, 2026): fields are typed into the body and live there as chips, and
the index of them is a *view* of the sheet, not a place beside it — see below.

The sheet panel carries a **formatting toolbar** between its bar and its body — undo and redo,
block type, marks, lists, quote, code block and table, lift, then the two chip triggers — the
one strip in the app that is always visible rather than hover-revealed, because formatting is
what the panel is for. Buttons reflect the selection and a lit block button clears back to a
paragraph; inside a table the table tools take the place of the insert button. Markdown prefixes
(`## `, `- `, `1. `, `> `, ```` ``` ````) become blocks as they are typed. The block commands left
the panel `⋯` the day the toolbar arrived; the bar is a handle, not a toolbar.

At the toolbar's right end sit the **view switches**, which are about the sheet rather than the
text: *Fields* opens the index above the body — one row per field, `icon · name · value`, typed
(`sheets.md`), nothing an input at rest, edited on click, a quiet row to add one, the type behind
the icon — and *Raw* replaces the rendered body with the editable source as
typed (`::`, `{{ }}`, `[[ ]]`, Markdown blocks, pipe tables). Both are one choice
for every sheet on the device (`archefict:sheet-view`), so switching sheets keeps them, and both
are repeated in the panel `⋯`. Hidden by default: fields live where they were written.

The fourth presentation — the exact string sent to the model — is a Slice 5 panel. All four are
specified in `sheets.md`.

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

1. **Workspace shell.** Tab bar, `Panel` with bar and `⋯`, Story tab with a two-panel layout,
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
