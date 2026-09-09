# Spike: sheet editor

> Phase 0 spike from `ROADMAP.md`: *Automerge 3 + ProseMirror: edit a sheet with body + fields, sync
> two tabs, measure doc size after 1k edits.* **Throwaway.** Findings go inline in the roadmap
> item; then this app is deleted, or its editor moves into `apps/web` for Slice 1.

## Run

```
pnpm --filter @archefict/spike-sheet dev     # http://localhost:5174
```

Open it twice. Type in one tab; the other follows. Edit a field in the second; the first follows.

## What it measures

- **saved bytes** — `Automerge.save(doc).byteLength`, the size the document takes in storage.
- **changes** — how many Automerge changes the history holds.
- **1,000 editor edits** — random inserts and short deletes dispatched through ProseMirror, so
  every one crosses the ProseMirror → Automerge mapping the way a person's keystrokes would.
- **1,000 field writes** — the same key rewritten a thousand times: what a stat that changes
  every turn costs.

Each burst reports elapsed time, bytes before and after, and bytes per edit.

## Not the product

Own storage (`archefict-spike` in IndexedDB), own styling, no tokens, no tests. Nothing here is
imported by `apps/web`.
