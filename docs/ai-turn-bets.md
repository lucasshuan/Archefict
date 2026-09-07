# AI turn bets

> September 07, 2026. Undecided; explore as the chat, write pipeline and cloud work land.

An AI turn may include reasoning, reads, searches, code, tool results, narration, state proposals
and deferred work. The provider wire format, stored message format and completed turn do not need
to be the same thing.

## Application-owned message parts **(bet)**

Current lean: store message content as versioned typed parts with stable ids.

```ts
type MessageContent = { version: 1; parts: MessagePart[] };

type MessagePart =
  | { id: string; type: "markdown"; text: string }
  | { id: string; type: "asset"; assetId: string; alt: string }
  | { id: string; type: "reference"; targetId: string; label: string }
  | { id: string; type: "choices"; choices: { id: string; label: string }[] };
```

This could support targeted edits, per-part provenance, useful CRDT merges and future renderers
without making sheets or messages opaque blobs. Stable application ids would also keep assets and
references valid when labels change.

The model would not need to emit this envelope. Normal streamed Markdown could be wrapped as one
part by the application, while tool, reasoning and provenance events remain separate. The open
questions are how unknown or plugin-defined parts degrade, whether every part needs its own
provenance, and whether the benefits survive real editing and sync.

## Model proposals, deterministic writes **(bet)**

The narrator may propose semantic operations such as `setField`, `addReference` or
`createSheet`. Trusted application code would validate, authorize, apply and record them through
the shared write pipeline. Routine campaign updates would not need an executor-model completion.

Stable ids and field/block operations appear preferable to arbitrary document diffs. It remains
open whether proposals are tool calls, a final sidecar, or both, and which changes require review.

## Optional asynchronous worldbuilding **(bet)**

When a new character, place or faction needs substantial research or invention, the narrator may
create a minimal canonical shell and queue an enrichment job. A separately configured
worldbuilder model could inspect a bounded snapshot and return proposed operations while play
continues. It would run selectively, not necessarily once per turn.

Open questions include triggers and budgets, stale snapshots, deduplication, hidden versus known
facts, and whether jobs run in the client or on a server. Server continuation would require cloud
state plus server-usable credentials; local campaigns could instead apply returned operations
when the client is available.

## Possible boundary

```text
provider events -> turn orchestrator -> message parts + proposed operations + queued jobs
                                      -> deterministic write pipeline
```

This boundary is only a candidate. Spike it with a tool-using narration turn and an interrupted
background enrichment before changing the canonical schemas.

## References

- [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling)
- [OpenRouter item streaming](https://openrouter.ai/docs/agent-sdk/call-model/streaming)
- [AI SDK tools with structured output](https://ai-sdk.dev/docs/troubleshooting/tool-calling-with-structured-outputs)
