import type { NarrativeEntry } from "@archefict/schema";
import { createEffect, For, on, Show } from "solid-js";
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
      <div class="mx-auto flex max-w-3xl flex-col">
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
        <Show when={props.streamingText !== null}>
          <EntryView
            entry={{ id: "streaming", kind: "ai", text: props.streamingText ?? "" }}
            streaming
          />
        </Show>
        <div ref={bottom} />
      </div>
    </section>
  );
}
