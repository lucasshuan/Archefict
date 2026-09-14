import { splitReply } from "@archefict/ai";
import type { NarrativeEntry } from "@archefict/schema";
import { createEffect, createMemo, For, Index, on, Show } from "solid-js";
import { EntryView } from "./EntryView.tsx";

type Kind = NarrativeEntry["kind"];

/**
 * A reply is stored as one entry per line (see splitReply), and a continue carries the same
 * prose on under a new turn id. Consecutive AI entries are one run whatever turn produced
 * them: they sit as close as paragraphs, and only a change of speaker opens the wide gap.
 */
function continuesRun(previous: Kind | undefined, entry: Kind): boolean {
  return previous === "ai" && entry === "ai";
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
      class="flex-1 overflow-y-auto px-4 pt-4 pb-6"
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
              continued={continuesRun(props.entries[index() - 1]?.kind, entry.kind)}
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
                  continued={i > 0 || continuesRun(props.entries.at(-1)?.kind, "ai")}
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
