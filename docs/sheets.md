# The sheet

> September 11, 2026. Supersedes `sheet-fields.md`, which was written for someone already deep in
> the plumbing. This is the recommended shape and changes when the code does.
> Workspace: `workspace.md`. What the model sees: `ai-context.md`. Bets: `stack.md`.

**The criterion is the ceiling, not the plan.** Archefict does not need to contain everything on
day one; it needs to be the surface everything else gets built on. Neither "the roadmap says so"
nor "that work exists already" is a reason to keep anything here.

## Four ideas

Not a list of mechanisms. Four concepts, and everything below is detail of one of them.

1. **A sheet has a body** — a tree of blocks. Most blocks are text. Some are typed things that are
   not text.
2. **A sheet has fields** — a plain map, `name` to `value`.
3. **A sheet has a view** — who draws it. Ours by default; a plugin later.
4. **Anything unrecognised is kept, never destroyed.**

Obsidian is the check on this. Its storage is the most constrained option available — plain text
files — and its ceiling is the highest of any tool in this space, because it has roughly four
ideas too: file, folder, link, and "a plugin can draw it". If this document had grown to twelve
concepts it would have been wrong.

## Fields: typed where you write them, stored where they can be used

The wish is Obsidian + Dataview: type the field in the flow of writing, in raw form, no panel, no
context switch. The wish is right. The encoding Dataview uses to satisfy it is not, because it is
a workaround for a constraint we do not have — in Obsidian the file *is* a string, so structure
has nowhere to live except inside the string.

| Typed | Effect | Renders as |
|---|---|---|
| `class:: Rogue` on its own line | writes `fields.class`, inserts a chip | `class Rogue` |
| `[hp:: 12]` mid-sentence | same | `hp 12` |
| `(hp:: 12)` | same | `12` |
| `{{debt}}` | writes nothing, binds to an existing field | `1100` |
| `[[Mira Vance\|s_2pv]]` | a reference to another sheet | `Mira Vance` |
| `{{Mira Vance\|s_2pv.debt}}` | that sheet's field, live | `900` |

`::` writes. `{{ }}` reads. `[[ ]]` links. Three delimiters, one meaning each.

**The rule that makes it hold: the syntax is an input method, not a format.** `::` is consumed at
the moment of typing and never appears in storage, exactly as `## ` becomes a heading rather than
staying the characters `## `. Nothing downstream parses a body with a regex, ever.

`@` is the authoring trigger: typing `@Mira` opens an inline autocomplete over sheet titles and
inserts a reference; `@Mira.` offers her fields and inserts a transclusion. One trigger, both
results.

It was `#` until Sep 14, 2026, and `#` is Markdown's heading. The two never collided in practice —
`# ` has a space and `#Mira` does not — but the popup had to refuse Enter on an empty query to
keep `#` alone a heading, which is a rule nobody can see. `@` collides with nothing, reads as
*mention* in every other editor, and needs no such rule.

### `/` is the way in

A `/` at the start of a block or after whitespace opens the **command menu** (Sep 14, 2026):
what the block can become — text, headings, lists, quote, code block, table — and the two chips,
each line naming the syntax that does the same thing. Notion, Fibery and LegendKeeper all put it
there and a writer arrives already knowing it.

The menu and the toolbar are one list of commands (`library/commands.ts`), so a heading cannot mean two
things depending on which way it was reached. They differ in one way, on purpose: a toolbar button
shows its own state and a lit one clears back to a paragraph, while a menu line that was searched
for and chosen means *make it this*.

No divider. `horizontal_rule` is in the schema but has no `automerge` mapping, so the binding has
nothing to store one as; the menu offers it the day the node is mapped.

### Why the value lives in the map

The alternative is body-canonical: the prose holds the values and the map is derived by walking or
parsing it. Judged on ceiling rather than on convenience, the map wins.

1. **A field node is a socket; a string is a dead stick.** A plugin can register against a typed
   node — own a field type, supply a renderer, compute a value, validate it. Stored text can only
   ever be re-parsed, and every plugin parses differently. Obsidian's ecosystem pays this in
   public: Dataview, Metadata Menu, Meta Bind and Templater each carry a different notion of what
   a field is, and they conflict.
2. **Many things write one value** — a user in the panel, the same user in a chip, a second
   device, the narrator, a plugin. Map keys merge. Characters inside a paragraph produce `1518`.
3. **The AI has to be able to write it.** `setField(id, "hp", "12")` validates, inverts and
   carries provenance. "Find the node called hp and splice its value" is ambiguous when there are
   two of them.
4. **One key must resolve to one value** for any schema layer to exist at all. Dataview's answer
   to a duplicate key is to coerce the field to a list; that forecloses validation.
5. **A map is cheap to index. A tree walk per document per query is not.**
6. **Provenance is per field.** `ARCHITECTURE.md` requires every change to record who, which
   model, which turn. A map key anchors that; a text span does not.
7. **Not every field wants a sentence,** and one value can have many placements — the same field
   three times in a body, all consistent, because all three are views of it.

### Merge strategy follows the field's type

An open gap in the code today. `setSheetField` writes every value as a text diff, which is right
for prose (`status: recovering from a broken arm`) and wrong for scalars: two devices setting `hp`
to `15` and `18` can merge into `1518`.

Once components claim keys (Slice 4), the claimed type decides: last-write-wins for scalars and
enums, text diff for prose. Unclaimed keys keep the text diff, which is the safer default for
free-form values.

## What a field is

A field's value is always a string. What is added, when someone says so, is a description of
it beside the value, never inside it — `meta[key]` on the sheet document:

| Type | Says | Reads as |
|---|---|---|
| **text** | nothing more | the string |
| **number** | `unit`, `decimals`, `thousands` | `1,100 crowns`, tabular figures, unit dimmed |
| **select** | `options` | one tag, coloured by its place in the list |
| **multi-select** | `options` | several tags; the value is `ally, fence` |
| **checkbox** | nothing more | a box; the value is `true` / `false` |
| **date** | nothing more | reserved for campaign time (Slice 3); shown, not yet editable |
| **formula** | `expr` | computed on read from other fields; stores no value |

**Where a field's type comes from, first match wins:** the sheet's own `meta[key]`; the models
it takes, in the order taken (below); inferred from the value (`^-?\d+(\.\d+)?$` is a number,
`true`/`false` a checkbox); text. A sheet with no `meta` renders
exactly as before. Changing a type never touches the value: `1100` stays `1100`, only shown
differently. Inference never pulls the control away mid-word — typing `true` into a text well
does not turn it into a checkbox until it is committed.

**The index is rows, not a form.** `icon · name · value`; nothing is an input at rest; a value
edits on click in the control its type calls for; the type sits behind the icon with that type's
few options under the same menu; adding one is a quiet row at the bottom. The chip in the prose
reads and edits through the same pieces, so the index and the body never disagree about what
`1,100 crowns` looks like.

**Formulas** are the smallest language that reads `level + prof`: the four operations,
parentheses, unary minus, numbers, and other fields by name — including other formulas, to a
depth that stops a cycle. Errors are sentences (`name is not a number`, `divided by zero`) shown
on hover. It grows when a play session asks, not before. A hyphenated key cannot be told apart
from a subtraction, so formulas see `[A-Za-z_]\w*` names only.

**What stays the same:** chips, the raw view (`[debt:: 1100]`), the merge rules. The model's
view will read `debt: 1100 crowns` — the unit is worth the tokens, the separator is not.
Slice 4's components claim keys the same way `meta` does; nothing here is re-entered when they
arrive, and merge-strategy-by-type (`sheets.md` above) now has a type to follow.

## Transclusion: one value, many sheets

A field can be owned by a sheet other than the one it appears on. This is what stops the same fact
being written down twice and drifting.

```
{{debt}}                        my own field
{{Mira Vance|s_2pv.debt}}       her field, live, one source of truth
```

The delimiters matter. `[[Mira Vance|s_2pv]].debt` was rejected: in raw form the trailing `.debt`
is indistinguishable from prose. Wrapping the whole expression in `{{ }}` removes the ambiguity —
the dot is inside the delimiter, so it cannot be read as a sentence.

**Ownership is enforced, not advisory.** A borrowed value serialises with its owner attached, and
the write pipeline refuses a write aimed at the wrong sheet:

```json
{ "accepted": false, "reason": "debt belongs to Mira Vance [s_2pv]; propose there" }
```

That is the first place the deterministic policy in the write pipeline earns its keep: a rule
catching a plausible-looking mistake rather than a malformed one.

## The four views

A sheet is one document with four presentations. The first three are for writing; the fourth is
for trusting.

| View | Shows | Editable |
|---|---|---|
| **1. Rendered** | Chips as values, variables hidden, toolbar, commands. The default. | yes |
| **2. Rendered + properties** | The same, with the field index opened **above or below** the body | yes |
| **3. Raw** | Literal `::`, `{{ }}`, `[[ ]]`. What was typed. | yes |
| **4. Context** | The exact string sent to the model | no |

Two consequences worth stating:

- **The properties view opens above or below the body, not beside it.** The current side panel
  (`w-72` on the right) becomes a horizontal region. Fields are part of the document, and reading
  them across from the prose fights that.
- **Raw and context should be the same strings.** If view 3 and view 4 agree, a user debugging what
  the model saw has one syntax to learn rather than two. This is a constraint on the serialiser,
  and a cheap one.

**Raw is parsed through the inverse of its serialiser.** Edits replace the rendered document as
they are typed; pair forms also write their field values. Round-trip tests keep Markdown blocks,
marks, tables, references and field placements from changing shape between the two views.

View 4 has no equivalent in Obsidian, Notion or Fibery, and it is the one that makes AI behaviour
debuggable instead of mysterious. It is also nearly free: the serialiser exists for the tools
anyway, and this is a panel that prints its output.

## The ceiling

The recurring instinct is that a permissive format — HTML — has no ceiling: store markup and a
sheet can become anything. Right instinct, wrong layer.

**Format permissiveness is not where malleability comes from.** Excalidraw drawings are Markdown
files. Kanban boards are Markdown files. Canvas is JSON the editor never looks inside. None of
that came from the format being loose. It came from three things the format was not: a pluggable
view layer, a hole for payloads the host does not understand, and a boring queryable core
underneath.

HTML supplies none of the three, and is not the blank cheque it appears to be:

- **It is a fixed vocabulary too.** A plugin's custom thing is `<div data-plugin="...">` — an
  opaque node with attributes, which is the same construct a tree gives you. Browsers just render
  it for free, so the ceiling *feels* higher.
- **It has no preservation contract.** An unknown construct is either stripped by the sanitiser
  (silent data loss) or passed through (a hole on every read path). There is no third outcome, and
  which one you get is decided by a sanitiser config rather than by the plugin author.
- **It does not merge.** Two devices, or a plugin and a user, resolve as characters inside tags.
- **The AI cannot reliably write it.** A sheet that became unrecognisable but can no longer be
  updated by the narrator has lost the product, not extended it.

### What the tree already guarantees

Idea 4 is not something we build. It is something the editor binding refuses to let us skip.

`@automerge/prosemirror` makes every schema designate one node as the place unknown blocks go, and
throws at startup if you do not. Unknown attributes and unknown marks are preserved the same way,
automatically, on every node.

**A sheet extended by a plugin can be opened, edited and saved by a client that has never heard of
that plugin, and come back intact.** Markup cannot promise that. Markdown cannot either. It is a
property of the installed code rather than a plan, and it is the strongest single argument that the
tree's ceiling is above HTML's.

### Where the tree's ceiling actually binds

One place, worth naming rather than avoiding: **a sheet that is not document-shaped.** A map, a
canvas, a spreadsheet. Modelling those as "one node filling the whole body" works but is a fiction,
and fictions leak.

The fix is not a storage format. It is idea 3: a sheet may carry a `view` naming a plugin surface,
and its body becomes that plugin's state rather than prose. Obsidian hit the same wall and answered
it the same way, with `.canvas` as its own file type.

### Extension points

A ceiling exists only if the holes are cut. Plugin state lives **beside** the node, not inside it:
block attributes are written back wholesale rather than diffed, so nested state in an attribute
loses fine-grained merge.

```
node attrs:   { type: "calendar.event", id, v, fallback }   identity only, small
sheet doc:    pluginState[id] = { ...real state... }        merges properly
```

Every hole is also a capability boundary. Plugin content renders in a sandboxed iframe, never in
the host document — which is exactly what makes an opaque node safe where raw HTML was not.
Default-deny, as `stack.md` requires.

## Built, and what building it found

Sep 13, 2026 (`apps/web/src/library/`): the custom adapter (`schema.ts`), tables, the field and
reference chips (`chips.tsx`), the typed syntax (`field-rules.ts`), the `/` / `@` / `{{` popups
(`autocomplete.tsx`), the index-above-body and raw views (`view-store.ts`, `PropertiesBlock.tsx`,
`serialize.ts`), the toolbar. The fields panel is gone. Views 1–3 exist; raw is editable through
the inverse parser; view 4 is Slice 5.

Three things the code taught that the plan did not know:

1. **A table cell is a single line.** Automerge holds a flat run of block markers with
   `parents`, and the binding emits a marker for a container only when the container has a
   textblock child. Cells as boxes of paragraphs would make rows markerless and every row's cells
   indistinguishable from the next row's. Cells as textblocks (`inline*`) make rows emit markers
   and the table rebuild from `parents`, the way a list rebuilds around its items. Enter in a cell
   therefore moves down a column and grows the table, never splits the cell.
2. **The binding leaves a container's default first child implicit,** and an implicit child with
   no text in it is nothing at all — an empty first cell vanished. The row's default type is now
   a phantom node (`cell_slot`, never created) so every real cell is explicit. The same limit
   exists upstream for an empty first paragraph in a blockquote; it is the binding's, not ours.
3. **`hasMarkup` never matches.** The adapter puts `isAmgBlock` and `unknownAttrs` on every node,
   so ProseMirror's deep attribute compare fails against `{ level: 2 }`. Anything that asks "is
   this block an H2" compares only the attributes it asked about. This will bite every node view
   and command written from here on; it is documented at the one place it was hit.

Also confirmed in the browser: a field edited from the index and from its chip at the same time
merges, because both are `updateText` on one map key; a borrowed chip follows the owning sheet's
edit live; every chip and table survives a reload intact.

Later the same day: field types (`FieldMeta` in `packages/schema`, `meta` on `sheet:<id>`,
`fields.ts`, `FieldValue.tsx`), and the index rebuilt as rows. One more finding: a Solid
`<Show keyed>` on a description object that is re-derived on every document change remounts the
control under the person's fingers — the input blurs, the editor closes, the character is lost.
Everything in `FieldValue.tsx` switches on `meta.type`, a string, never on the object.

## Shared structure: models

**Decided Sep 13, 2026, and built the same day.** The noun is **model** (the kernel said
*component* until then; that word now means nothing here). A model is a sheet other sheets take
their shape from. The proposal with mockups and the five options weighed — structure on a
container · one type per sheet · several per sheet · none shared · a copied template — is at
<https://claude.ai/code/artifact/facda9ca-ef56-4037-8fca-7c5bf0819fc6>; this is the third, with
the ergonomics of a template and the convenience of a folder.

- **A model is a sheet** (`kind: "model"` on its index record), made from the Sheets section or
  the Library `⋯`. Its index defines the fields with their types — the same rows, the same type
  menu — and its values are the defaults a taking sheet reads until it has its own. It shows a
  ◆ in the tree and a single *Model* pill under its title.
- **A sheet takes several**, from the pills under its title (`models` on its index record, in
  the order taken). Taking adds the model's fields, typed, grouped under the model's name in the
  index; the first model to claim a key wins; a key nobody claims sits under *Only here*.
  Dropping keeps every value — structure never destroys content, only stops claiming it.
- **A folder hands** models (`models` on the folder) to sheets made inside it, at creation.
  Handed, not imposed: the sheet lists them and can drop them; moving a sheet changes nothing.
- **A claimed field's type menu names its model** and offers the two honest moves: *Edit in
  Character* (every sheet that takes it) or *Override here* (this sheet's own `meta`, which
  always wins). *Back to Character's* undoes the override.
- **Save fields as model** (sheet `⋯`) promotes the shape a sheet already has: keys and types
  copied, values not, taken at once by the sheet it came from. Progressive formalization as a
  button.
- **Chips agree with the index:** a chip reads a model-typed field by that type, and shows the
  model's default dimmed while the sheet has nothing of its own.

Resolution order is now: the sheet's own `meta[key]` → the models it takes, in order → inferred
from the value → text. A key a model never described reads the way the model's own row reads it
(inferred from the model's default), so `level: 1` on a model is a number on every taker.

Not yet: model-driven validation of claimed keys, plugin-shipped models, a model built on
another, renaming a claimed key across sheets (waits for the operations pipeline, Slice 4), and
views over "every Character" (Slices 5–6).

### References

- **LegendKeeper** — calendars with the campaign's own months, weekdays, week and year lengths;
  maps that nest; page templates; an app that looks good. The reference for views and for looks.
- **Tana** — supertags: a tag carries fields, a node takes several, views per tag. The closest
  existing model to "components, several per sheet".
- **Notion, Fibery** — structure on the container (database, type). Views come free; a page has
  one home. The rigidity this design avoids.
- **Obsidian Bases** — no schema; the view decides at query time over frontmatter. The freedom
  this design keeps for sheets that take nothing.

## Now-decisions

Everything here is a type definition or a naming convention. None of it needs the plugin host to
exist. All of it is expensive the day after the first document is written.

| Decide now | Why now |
|---|---|
| Namespaced node type names (`plugin-id:type`) | Renaming a node type after documents exist is a migration |
| `v` (version) attribute on plugin nodes | Later migrations have no anchor without it |
| A fallback text slot in the node spec | Cannot be computed once the plugin is gone |
| Which node is the `unknownBlock` | Mandatory anyway; make it a decision, not an accident |
| An opaque `embed` node in the adapter | Adding a node type later migrates documents |
| `pluginState` side-map on the sheet | The shape above |
| `view` on `SheetSummary` | One field, unused until Slice 15, free today |
| Reserve a `hidden` node (spoiler text) | Requested; not a priority to build, cheap to reserve |
| Key naming: store as typed, compare case-insensitively | Dataview sanitises keys and it surprises people |

Free whenever: full-sheet view renderers, custom serialisers, plugin-registered field types, node
views, custom operations.

## Proposed roadmap edits

- Phase 0 decisions: mark the sheet model confirmed — free body, free fields, optional components.
  Record *fields are a map with inline bindings, not inline text*.
- Phase 0 spikes: add *inline embed node with attributes through a custom `SchemaAdapter`*. Its
  acceptance test includes opening a document containing an unknown block type with an adapter that
  lacks it, editing elsewhere, saving, and confirming the unknown block survives.
- Slice 1: the adapter gains the `field` and `embed` nodes; add the `::`, `{{ }}` and `@` input
  rules and the chip renderer; the fields panel moves above or below the body and is reworded from
  *the structured half* to *the index*; transclusion and ownership land with references.
- Slice 1 (kernel): reserve `view` on `SheetSummary` and a `hidden` node name.
- Slice 2: the Markdown exporter emits `key:: value` for placed fields and frontmatter for the rest,
  so an export opens in Obsidian with its metadata intact.
- Slice 4: merge strategy follows the claimed field type; components are plugin-definable rather
  than a fixed host list.
- Slice 5: view 4 (context) as a panel.
- `stack.md`: the *Not adopted* line for HTML and Markdown storage gains its real reason — not
  safety, but that markup has no preservation contract, no merge semantics and no extension
  registry.
