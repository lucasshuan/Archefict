import { splitReply } from "@archefict/ai";
import type { NarrativeEntry } from "@archefict/schema";
import { createEffect, createMemo, For, Index, on, Show } from "solid-js";
import { EntryView } from "./EntryView.tsx";

/**
 * A reply is stored as one entry per line (see splitReply). Consecutive AI entries from the
 * same turn are one run and sit as close as paragraphs; a new speaker or turn gets the wide gap.
 */
function continuesRun(previous: NarrativeEntry | undefined, entry: NarrativeEntry): boolean {
  if (previous === undefined) return false;
  if (previous.kind !== "ai" || entry.kind !== "ai") return false;
  const a = previous.provenance.turnId;
  const b = entry.provenance.turnId;
  return a === undefined || b === undefined || a === b;
}

export function NarrativeFeed(props: {
  entries: readonly NarrativeEntry[];
  streamingText: string | null;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  let bottom: HTMLDivElement | undefined;

  /**
   * The reply in flight, already cut the way it will be stored (one part per line). Parts
   * that have ended in a line break mount as their own entries while later text still
   * streams, so the feed grows entry by entry instead of showing one block that shatters
   * at the end. Nothing is written until the reply completes; this is only how it looks.
   * An empty stream is one empty part, so the caret shows while the model thinks.
   */
  const streamingParts = createMemo<readonly string[] | null>(() => {
    if (props.streamingText === null) return null;
    const parts = splitReply(props.streamingText);
    return parts.length > 0 ? parts : [""];
  });

  createEffect(
    on(
      () => [props.entries.length, props.streamingText] as const,
      () => bottom?.scrollIntoView({ block: "end" }),
    ),
  );

  return (
    <section
      class="flex-1 overflow-y-auto px-4 pt-1 pb-6"
      aria-label="Narrative"
      aria-live="polite"
    >
      <div class="mx-auto flex max-w-page flex-col">
        <Show when={props.entries.length === 0 && props.streamingText === null}>
          <p class="py-16 text-center font-narrative text-fg-muted">
            The story has not started. Write what you do.
          </p>
        </Show>
        <For each={props.entries}>
          {(entry, index) => (
            <EntryView
              entry={entry}
              continued={continuesRun(props.entries[index() - 1], entry)}
              onEdit={(text) => props.onEdit(entry.id, text)}
              onDelete={() => props.onDelete(entry.id)}
            />
          )}
        </For>
        <Show when={streamingParts()}>
          {(parts) => (
            // Index, not For: parts are keyed by position, so a settled part keeps its DOM
            // and only the last one re-renders as tokens arrive.
            <Index each={parts()}>
              {(text, i) => (
                <EntryView
                  entry={{
                    id: `streaming-${i}`,
                    kind: "ai",
                    get text() {
                      return text();
                    },
                  }}
                  continued={i > 0}
                  streaming={i === parts().length - 1}
                />
              )}
            </Index>
          )}
        </Show>
        <div ref={bottom} />
      </div>
    </section>
  );
}
