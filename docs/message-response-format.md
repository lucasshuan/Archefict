# Message response format exploration

> September 07, 2026. **(bet)** Explore during the Slice 3 chat schema work; not decided.

## Question

Should model responses and stored messages use versioned typed parts, or should messages stay
Markdown text with separate tool events?

## Current lean (bet)

A possible canonical application shape:

```ts
type MessageContent = {
  version: 1;
  parts: MessagePart[];
};

type MessagePart =
  | { id: string; type: "markdown"; text: string }
  | { id: string; type: "asset"; assetId: string; alt: string }
  | { id: string; type: "reference"; targetId: string; label: string }
  | { id: string; type: "choices"; choices: { id: string; label: string }[] };
```

The exact parts, fields and versioning are open. If adopted, stable part ids could support
targeted edits, provenance and CRDT merging. This would apply to messages; sheets would retain
canonical rich structure.

Possible generation path:

- Try schema-constrained Structured Outputs through `streamText` + `Output.object` when the
  selected model and provider route support them.
- Try rendering growing Markdown through `partialOutputStream`; `elementStream` waits for a
  complete, validated array element.
- Consider raw Markdown as the fallback and normalize it to one part after completion.
- Keep state changes in typed tools and the validated write pipeline, not display parts.

## Open questions

- Should the model wire format and stored format be the same?
- Is the extra schema and partial-stream complexity worth it for mostly Markdown responses?
- How do edits, CRDT merges and unknown future part types behave?
- Which models and provider routes need a plain-text fallback?
- Can plugin-defined parts be namespaced, capability-checked and rendered safely?
- Assets would still need application-owned ids; Markdown would still need sanitization.

## Spike

Compare raw Markdown with a structured `parts` response on the default model and at least two
alternatives. Measure time to first visible prose, validation/fallback rate, token use, narration
quality and edit behavior. Adopt only if typed parts create near-term value beyond their cost.

Feasibility is plausible: OpenRouter supports streaming JSON Schema outputs on compatible
models, and the current default Claude Haiku 4.5 reports support. This does not settle the design.

## References

- [OpenAI Responses API: JSON Schema output](https://developers.openai.com/api/reference/cli/resources/beta/subresources/responses)
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [AI SDK structured data and streaming](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Claude Haiku 4.5 capabilities on OpenRouter](https://openrouter.ai/anthropic/claude-haiku-4.5/)
