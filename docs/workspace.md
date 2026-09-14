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
| **Tab** | A full-screen layout reached from the campaign's right sidebar. | A browser tab. |
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

Tabs are icons in the campaign's full-height **right sidebar**, a rail. At its top sits the
campaign's **cover**, edge to edge, which is the way into **Campaign Settings**: the thing you
press to change the campaign is the picture of it, not a row filed among the working views — so
the workspace carries no title bar of its own and the panels start at the top of the page. The
campaign's **name** is in the cover's tooltip and in Campaign Settings, where it is changed.
**Story** and **Library** are the working destinations below the cover.

- Both app sidebars are rails, `w-14`, and there is no wider form: covers and icons are the
  labels, and the name of anything lives in its accessible name and in a tooltip of the app's
  own (`rail.tsx`), beside it on the side away from the edge — never the browser's `title`
  bubble. Either rail **hides** rather than shrinking — to nothing, the workspace taking the
  whole width — and the one thing left of a hidden rail is a button at that side's top corner,
  over whatever is there, to bring it back. Each side's shown/hidden state persists on the device.
- A shown rail's hide control is pinned to its own top corner, never floating over the page. On
  the left it sits in the header; on the right there is no header — the cover fills the top — so
  it sits on the cover's corner over a scrim of the ground, and the list leaves the slot's height
  clear above the cover. A hidden rail's show control is the one floating thing in the shell: a
  tab stuck to that side's edge at the top corner, part of its length outside the screen and the
  icon on the part inside. At rest it is a translucent bare icon, no ground and no border; when
  the pointer comes within 40px of that edge it takes a scrim and a border and reads as the tab
  it is. Keyboard focus reveals it the same way. Nearness is read from the pointer's position,
  not from a hover zone, because a zone over the workspace's edge would take its clicks. The
  icon is
  the chevron pair for that side — `panel-left-close`/`panel-left-open` on the left,
  `panel-right-close`/`panel-right-open` on the right — so the glyph says both which panel it is
  and which way it will go.
- **Nothing re-anchors itself when a rail hides.** The width takes 200ms and goes to zero;
  everything inside is laid out for the rail's own width and anchored to the edge the rail keeps,
  so the rail slides out under its clip rather than reflowing on the way. No label hides, no
  column count changes, no cover changes shape.
- The selected row lifts to `surface-raised`, takes an accent rule on the inner edge, and gives
  its icon the accent. Others are `text-fg-muted`, `hover:text-fg`. The cover is a tab like the
  others — same tablist, same arrow keys — so selected it takes the same inner-edge accent rule
  and gives its gear the accent. It is the one thing in the sidebar with no gutter: a picture
  framed inside the sidebar reads as a thumbnail, and one that fills it reads as the campaign's.
  Its settings affordance appears on hover, never at rest: a gear parked on the cover would be
  the only thing anyone ever sees of it.
- Default tabs: **Story** and **Library**. Campaign Settings is not among them and is not
  removable; it hangs off the cover. Users add, remove, reorder and build their own tabs in
  Slice 5; nothing here should preclude it, nothing here builds it.
- Tab order and layout are a device preference (`archefict:layout:<campaign>` in localStorage)
  until Slice 5 decides whether layouts sync. Defaults need no storage at all.

The **left sidebar** belongs to the app rather than to a campaign: campaigns, global Settings and
the user. It is a rail in the shell, never a drawer. Campaigns are **cards**, not rows: a
campaign is a place, and its picture tells it from the others faster than its name does. A
card is the campaign's square cover, and the cards are one column: a shelf of covers to pick
from rather than a list to read down. The current one is marked by being the only card at full
strength: the rest sit back — darker, flatter, colour half drained — and lift partway towards it
on hover. That is a filter, not opacity: opacity over the ground darkens a cover but leaves it as
saturated and as contrasty as the current one, so a shelf of bright covers still shouts. An
accent pill at the rail's edge is the second mark — tall for the current campaign, short for the
one under the pointer, the way a rail of avatars does it. It sits in the gutter outside the
picture, so it is a state of the card and never a frame on the picture. The name lives in a
tooltip of the app's own beside the picture, never the browser's `title` bubble. *Delete* is not
on the card: deleting a campaign needs its name in view to be safe, and the card has no room for
it, so it lives in Campaign Settings behind a confirmation. Hiding the rail gives the workspace
its width, and the choice persists on the device. Navigation does not hide it and there is no
backdrop.

### Covers

A campaign's picture is one thing drawn one way (`CampaignCover`): the card you pick it from and
the cover inside it never drift. `CampaignIndexDoc.cover` holds the campaign's chosen image;
absent, a **marble in the campaign's own colour** stands in — four soft shapes in the colours of
one oklch ramp, blurred into one another over a ground of the same ramp.

The hue is a hash of the campaign's document url, so a campaign keeps its colour for as long as it
exists, on every device, with nothing stored, and two campaigns side by side are told apart by
colour before either name is read. The seed also sets the ramp's register — how dark its dark
end goes, how light its light end, how much chroma it carries, how far round the wheel the hue
travels — so campaigns differ in tone as well as hue: one deep and saturated, one pastel, one a
hard contrast between the two. Two rules bound it. The ends are held a minimum distance apart in
lightness, so no campaign is a flat tint; and chroma is capped as lightness rises, so a pastel
stays a pastel rather than clipping to neon. The same seed reaches both places a cover appears,
so one campaign is one colour throughout.

The composition is the seed's too. Each shape is dealt one quarter of the frame and jittered
inside it, so no seed can pile all four into a corner and leave the rest bare ground. The drawing
is a 320×180 SVG sliced to whatever box holds it. Today every box is a square — the card in the
left rail, the cover atop the right one — and shows the centre of the frame; the frame is 16:9 so
a wider cover can come later without the picture changing. Plain shapes and one blur, no noise
filter and no canvas, is what keeps it cheap to draw a dozen times over.

Nothing in the sidebar says an image is still missing. The cover fills the sidebar edge to edge,
and a dashed frame around it to say so would be a frame on the picture; the placeholder is drawn
to read as a picture rather than as a gap. Choosing an image belongs to Campaign Settings, the
cover's destination. **Nothing sets `cover` yet** — choosing an image is not built.

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

The rule that makes this hold: **a tab contains panels and nothing else.** The two navigation
sidebars are shell chrome outside the active tab; neither is one of its movable panels.
Arrangement is fixed per default tab today and edited in Slice 5.

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
the active destination's `⋯` in the campaign sidebar, which lists panels with checkmarks and offers
*Reset layout*. Until Slice 5 that tab menu can be a single *Show conversations* toggle.

Campaign Settings is the cover's destination, and it is the one tab with **no panels at all**. The
others are workspaces — things you arrange, hide, drag and work inside — and a panel is what makes
a region one of those. This is a form you visit, change and leave, so it takes the shape of the
global Settings page instead: one scrolling column of raised `Section` cards on the page ground,
each a titled group of `Field`s, each field a label, an info badge carrying the explanation, and a
well for the control. `Section`, `Field` and `FieldLabel` are one shared implementation
(`components/settings-form.tsx`) so the two never drift. The one thing the tab does not borrow is
that page's row of tabs, which one group does not need yet. A `Section`'s `action` sits on its
heading row and is always visible — *Reset to default* for the campaign's instructions — because a
settings page has no `⋯`, and the only action a group has should not be the first thing that needs
discovering. Its tabpanel also skips the `p-2` panel gutter and sits flush.

Today it holds two groups. **Campaign** carries the campaign's name, which the sidebar shows and
only this page changes; an emptied field is not a rename, the name stays and the field shows it
again. Its heading row carries *Delete campaign*, behind a confirmation that names the campaign:
the one destructive thing in the app, kept where the campaign's name is in view. **Narrator**
carries the instructions.

### Sections

Inside the body, a panel holds **sections**: a named group with a header of its own — small,
uppercase, `text-fg-subtle` — carrying both the panel's name and that group's actions, the
actions revealed on hover the way a row reveals rename and archive. Every visible name in a tab
is a section's: *CONVERSATIONS*, and *ARCHIVED* under each list. *New conversation* belongs to the
conversations, not to the frame around them, which is why it left the bar. VS Code's Explorer is
the same shape and for the same reason: one view, several groups, each with its own buttons.

The Library has no section any more (Sep 14, 2026). Its header held the word SHEETS and three
`+` buttons, and every one of them had to mean something different the moment models and assets
became lists of their own. What replaced it says each of those things once: a search box whose
placeholder names the list being searched, a row of icon tabs, and one create action belonging to
whichever list is open. See *Library* below.

What this buys is room. A panel can grow a second group — an outline, what was opened recently,
a filter — without its bar growing a second set of buttons, and without either group having to
become a panel of its own.

Sections do not collapse, and neither does **Archived**, which is not one. It is a strip pinned to
the bottom of the panel saying how many there are, and it opens a dialog (Sep 14, 2026): the list,
*Restore* on each row, a bin on each row, and *Delete all* at its foot. One shared piece serves
both tabs (`ArchiveShelf.tsx`). The strip is *set* like a section header — 11px, uppercase,
`text-fg-subtle` — because *Open* and *Archived* are a pair, and a pair that reads as one thing
needs one typeface between them.

It folded open in place until delete arrived, which is what changed it. Archiving is its own undo
and never asks; deleting is not undoable and always asks. A permanent action does not belong in a
fold a stray click can open beside the list it would destroy, so the two live in a room you walk
into instead. Deleting drops the record *and* its document — `sheet:<id>`, the conversation's
timeline — so the space actually goes.

Hover-revealed buttons are not discoverable on their own, so every section action is also an item
in the panel's `⋯`. That menu is the answer to "how would anyone know", and it is the keyboard's
way in as well.

### A row's own `⋯`

Every row in every list carries one `⋯`, hidden until the row is hovered or the menu focused,
except on the active row, which keeps it (Sep 14, 2026). It replaced the strip of icons a row used
to reveal. Three reasons, in order: a row grew a fourth action, and four icons across a 288px panel
leave the name no room; the actions differ per row — a folder makes things, a sheet is duplicated
and archived, a folder holding something cannot be removed — and a strip that changes shape between
neighbours reads as noise; and a menu says all of it in words, at one width, with a keyboard path
already built.

A sheet's menu is *Open*, *Rename*, *Duplicate*, *Archive*. *Open* is absent on the sheet already
open rather than present and dead. A folder's is *New sheet*, *New folder*, *Rename*, then *Remove
folder*, which is disabled and says *empty it first* in its own label, because a disabled item
explains nothing on its own. A conversation's is the sheet's four.

*Models for new sheets…* was in a folder's menu and is not (Sep 14, 2026). A folder handing its
models to what is made inside it is a rule you set once and then read back out of a badge, and it
sat in the menu beside four things you do. The field survives in the schema and `createSheet`
still honours a list already set, so a campaign that had one keeps it and the badge still says
so — nothing in the app writes one any more.

The list is a portal in viewport coordinates, not a box inside the row: a row lives in a panel that
scrolls and clips, and a menu clipped by its own list is no menu. It flips upward near the foot of
a panel, and any scroll closes it, because the position it was given goes stale.

### The card

A panel is a rounded card in `--bg`, edged in `--border/50`, on a tab ground of the same `--bg`;
the border is the whole of what draws the card, and the gutter between two panels is where a
dragged one will be dropped. Half-strength, the same hairline the panel bar draws under itself and
the sidebars draw down their sides — one weight of rule everywhere. Tone said it alone before,
which meant the list and the narrative had to disagree about which of them was the darker one — a
question Slice 5 cannot answer once panels move. A border has no such question: every panel is the
same card wherever it lands. The campaign header and both sidebars sit outside the cards, so the
title and navigation read as the shell rather than as part of the story.

Once there is an edge, a second tone for the same boundary is a second mark for one thing, and it
was the more expensive of the two: a panel brighter than its ground pushed every state above it
brighter still, and pinned the panel to the bottom of the ladder. At `--bg` the ladder is free
again and the panel sits inside it: a row under the pointer lifts toward `--surface`, the active
row is fully `--surface-raised`, and a text control sinks to `--surface-sunken` — a well cut below
whatever holds it, whether that is a panel or a settings card. A row's own buttons still darken
rather than lift, now to `--surface-sunken`, because what is below the panel is the one thing
below every row state.

Nothing inside a panel tones itself against the panel any more: a sheet's name, models, toolbar
and body, and the story's feed and composer, are all simply the card. What used to need a well cut
at body size — the writing is the control, so the tone had to say so — needs no tone at all now
that the card is already at the bottom.

Rows are `rounded-lg`, not `rounded-xl`: at 12px the corner curves away from the accent rule on
the left edge and leaves it floating. Every row in every panel reads `[icon] [label]` from one
inset, so the conversations and the sheets line up across the gutter between two panels; the tree
steps a row in by its depth and by nothing else.

The active row also takes a hairline of accent down its left edge (`ROW_RULE` and
`ROW_RULE_ACTIVE`, `list-row.tsx`), in the sidebar, the conversations and the tree alike. Two
signals rather than one: tone alone is four steps of lightness in a dark theme, and the smallest
dose of accent that reads is a 2px rule. The hairline is on every row at rest, scaled to nothing,
and grows in on the row you land on: a pseudo-element that only exists while active appears in one
frame, and a mark that appears in one frame reads as a jump. The two halves are split for a second
reason too — a Solid `classList` key that turns false removes every class in it, so nothing a row
needs at rest may live in the active half.

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

Two panels: the **sheet** (body editor) against the reading edge, the **library** far right. The
fields panel is gone (Sep 13, 2026): fields are typed into the body and live there as chips, and
the index of them is a *view* of the sheet, not a place beside it — see below.

### Search, then three lists

The library panel is a **search box**, a row of **icon tabs**, and the list they choose
(Sep 14, 2026).

The tabs are *Sheets*, *Models* and *Assets*, icons only. Three words across 288px would leave the
list no width, and these name kinds of thing rather than actions, which is what an icon is for. The
name is in the tooltip, the accessible name, and the search placeholder, which reads *Search models*
when models is the open list.

- **Sheets** is the folder tree, models excluded. A model still fills the folder it sits in, so a
  folder holding one still refuses to be removed — the tree is handed that list as `hidden`.
- **Models** is flat, by title. A model's place is this tab, so the folder it was created in would
  be a place nothing shows; new models go to the root. Nothing here drags: order is not drawn, so
  there is nothing to reorder against.
- **Assets** is empty and says so. Images and files are not built yet; the tab exists because the
  library is where they will land, and a tab that arrives later moves everything beside it.

A **search** answers within the open list, never across the three: the tab underneath it would be a
lie otherwise. Its answer is flat — a search is the way out of the tree — ranked whole name, start
of name, start of a word, anywhere in it, each row saying which folders it came from under the
title (`library/search.ts`, tested). Switching tabs clears the query, because a query is about one
list. Escape clears it too; there is nothing here to close.

A sheet in the tree is **dragged by its own row** (Sep 14, 2026). There is no grip: the row is
the sheet, and a sheet is the thing that moves, so anything else would be a second handle for one
object. The press has to travel 4px before it counts, the way a panel bar does, so the row still
takes a click to open the sheet. Three marks say where it would land — a rule above or below a
sheet row for *between these two*, the folder row lit for *last inside this one*, and a rule
under the whole tree for *back out to the root*. The ground below the tree is a drop target for
that last reason alone: taking a sheet out of a folder needs somewhere to put it, and the root
has no row of its own. Near either end of the panel a drag scrolls the tree under itself.

`Alt` with an arrow does the same from the row, because a drag is not a thing a keyboard can do
and a hover-revealed affordance is not discoverable on its own: up and down reorder among
siblings, left takes the sheet out to the folder around its folder, right puts it in the folder
drawn directly above it. Focus follows the sheet through the move, so it can be repeated.

Folders do not move yet. A folder drop has three answers rather than two — before, inside,
after — and folders and sheets are separate lists at each level, so the gesture is a larger
decision than this one; it waits until the tree needs it.

The sheet panel carries a **formatting toolbar** between its bar and its body — undo and redo,
block type, marks, lists, quote, code block and table, lift, then `@` for a reference — the
one strip in the app that is always visible rather than hover-revealed, because formatting is
what the panel is for. Buttons reflect the selection and a lit block button clears back to a
paragraph; inside a table the table tools take the place of the insert button. Markdown prefixes
(`## `, `- `, `1. `, `> `, ```` ``` ````) become blocks as they are typed. The block commands left
the panel `⋯` the day the toolbar arrived; the bar is a handle, not a toolbar.

*Place a field* left the toolbar on Sep 14, 2026 and lives in the `/` menu instead. `{{` is
reached for mid-sentence, and a strip of icons above the text is not where a hand already in the
middle of a line goes. The toolbar keeps one chip button, `@`, because a reference is the thing a
writer needs to be told exists.

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
   from day one since the spike passed. Sheets became draggable Sep 14, 2026; folders have not.
   Search, the three icon tabs, the row `⋯` and the archive dialog landed the same day.
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
