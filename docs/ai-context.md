# What the model sees

> September 11, 2026. The retrieval and context half of the library. `workspace.md` §*What the AI
> sees* named the tools; this replaces that section and adds what surrounds them. The sheet itself
> is `sheets.md`.

## Two rules

1. **Tool definitions are context.** Every schema is sent on every request, ahead of the system
   prompt in cache order. Their count must not depend on how much content a campaign holds.
2. **Content is never context by default.** It is fetched through tools — compact, capped, on
   demand — or placed deliberately by the app.

## The request

```
┌─ tools ────────────────────┐  every request, stable, cached
│  library_tree              │
│  library_search            │
│  library_read              │
│  library_propose           │
├─ system prompt ────────────┤  narrator instructions
├─ on stage ─────────────────┤  headers of sheets in play, capped
├─ conversation ─────────────┤  recent narrative entries
└────────────────────────────┘
```

## Tool definitions

The Zod shape in `packages/schema` is the JSON Schema in the request. One definition, no
duplication — the AI SDK's `tool({ inputSchema })` takes the Zod directly.

**The model is told the input precisely and the output not at all.** There is no output schema in
the wire format; `outputSchema` in the AI SDK validates locally and never reaches the model. So
**the description carries the return contract**, and a description like *"reads a sheet"* forces
the model to call it once to discover what comes back.

```ts
description:
  "Read sheets by id. Returns one compact sheet each: a header line " +
  "'# Title [id] Path', then fields as 'key: value' separated by ·, " +
  "then '---' and the body. Refs appear as [[Title|id]] and can be read next.",
```

**Tool names cannot contain dots.** Anthropic and OpenAI both constrain names to
`^[a-zA-Z0-9_-]{1,64}$`. `library.read` may be rejected by the provider; `library_read` is safe
everywhere. Namespacing survives with an underscore. Confirm before Slice 8 rather than after.

| Tool | Input | Output |
|---|---|---|
| `library_tree` | `root?`, `depth = 1` | `[{ id, kind, title }]` |
| `library_search` | `q`, `limit = 8` | `[{ id, title, path, snippet }]` |
| `library_read` | `ids[]`, `body`, `fields` | compact sheets |
| `library_propose` | `ops[]` | `[{ accepted, reason? }]` |

## Ids always carry their names

**Never emit a bare id to the model.** `s_2pv` is meaningless to it and unverifiable by the user
reading the transcript. Every id travels with its title, in every direction:

```
# Mira Vance [s_2pv]                              a header
[[Mira Vance|s_2pv]]                              a reference
{{Mira Vance|s_2pv.debt}}                         a transclusion
"debt belongs to Mira Vance [s_2pv]; propose there"   a rejection
```

The convention is `Title [id]` in prose positions and `Title|id` inside delimiters. It costs a few
tokens and buys the model an unambiguous handle plus a readable audit trail.

## Tool traffic is scaffolding, not history

Within a turn, every call and result stays in the message array. Across turns it should not,
and the storage model already makes that the natural outcome: messages are rebuilt from narrative
entries in the Automerge document, and tool calls are not narrative entries. **Tool traffic dies
with the turn.** Keep that on purpose.

The cost is amnesia — the next turn re-discovers what the last one looked up. Pay it back with
facts rather than replayed transcripts:

```
On stage: Mira Vance [s_2pv] — fence · loyal
          Varn Ashgrove [s_k3f] — rogue · 5 · wounded · debt 900
```

Headers only, no bodies, hard cap. Cheap, stable across turns, and it makes the common turn need
zero tool calls.

## Four retrieval layers

A round trip is a cost, and the cheapest search is the one that never happens. Layer these; each
catches what the one above it missed.

| Layer | Cost | Catches |
|---|---|---|
| **Explicit references** in the text | zero — the id is already there | "I find `#Mira`" |
| **On-stage set** carried forward | zero | whoever was in the last few beats |
| **Activation keys** | zero | lore with no anchor in the text |
| **Search and embeddings** | one round trip | genuine discovery |

Activation keys — a keyword list on a sheet that injects it when the keyword appears — have a
real but narrow home: **things nobody would ever link to.** Nobody types `#Gullet` when writing
"they meet at the Gullet", yet the Gullet has a controlling faction and a curfew that should be in
play. They are the wrong tool for fetching a named character, because a character has an id and a
reference, and matching a string against a name is strictly worse than following a real link.

Resolving references in the player's own message happens **before** the request is built, in
ordinary code. The model spends nothing finding what the user already pointed at.

## Reads are layered, so wide sheets stay cheap

A sheet with sixty attributes should not cost sixty attributes to look at.

```
library_read(["s_k3f"])                      header + summary fields
library_read(["s_k3f"], fields: "all")       every field
library_read(["s_k3f"], body: "full")        and the prose
```

A model declares which handful of its claimed keys are summary fields (the header line also
names the models a sheet takes: `Characters/Allies · Character, Merchant`). Sheets that take
none fall back to a capped first-n.

This separates two decisions that get confused:

- **Split a sheet when its parts change independently** — a kernel reason. Separate documents mean
  separate merge, separate undo, separate provenance.
- **Layer the read when a sheet is legitimately wide** — a context reason.

Modelling follows the fiction. Reading follows the budget. Splitting a sheet to please a token
budget lets the tooling deform the world.

## Rejections teach

`library_propose` returns a reason per operation, and the reason is read by a model that will try
again. Name the thing, name the fix:

```json
[
  { "accepted": true },
  { "accepted": false,
    "reason": "debt belongs to Mira Vance [s_2pv]; propose there" },
  { "accepted": false,
    "reason": "level is claimed by component 'character' and must be an integer 1-20" }
]
```

## Cost

`library_propose` is the expensive definition: its `ops` is a union of every operation type,
plausibly 1,000–1,500 tokens on every request. Worth paying, and not worth being clever about.

Tool definitions sit at the very front of the request — the most cacheable position there is. A
cache breakpoint after tools and system prompt makes every later request pay a fraction for that
block. The alternative, a lean schema plus a "discover the operations" tool, trades a fixed cached
cost for a round trip *and* a reliability drop, because models are markedly better with a schema in
front of them than fetching one.

The discipline is keeping the **core operation set small** — six to eight — not hiding it.

Plugin operations are namespaced and included only for plugins enabled on that campaign. So rule 1
holds as written: size does not depend on how much content a campaign has. It does depend on how
many plugins are on, which is user-controlled and visible where that cost belongs.

## Proposed roadmap edits

- Slice 8: tool names use underscores; every id emitted carries its title; `library_read` takes
  `fields` as well as `body`; the on-stage block is part of the turn builder, not a tuning
  afterthought; activation keys are scoped to unanchored lore.
- Slice 8: tool traffic is excluded from the rebuilt message array by construction, and a test
  asserts it.
- Slice 5: view 4 of a sheet (`sheets.md`) prints exactly what this document describes.
- `workspace.md`: §*What the AI sees* is replaced by a pointer here.
