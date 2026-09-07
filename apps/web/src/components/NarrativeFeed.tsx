import type { NarrativeEntry } from "@archefict/schema";
import { createEffect, createSignal, For, on, Show } from "solid-js";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { EntryView } from "./EntryView.tsx";

export function NarrativeFeed(props: {
  entries: readonly NarrativeEntry[];
  streamingText: string | null;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  let bottom: HTMLDivElement | undefined;
  const [pendingDelete, setPendingDelete] = createSignal<string | null>(null);

  createEffect(
    on(
      () => [props.entries.length, props.streamingText] as const,
      () => bottom?.scrollIntoView({ block: "end" }),
    ),
  );

  return (
    <section class="flex-1 overflow-y-auto px-4 py-6" aria-label="Narrative" aria-live="polite">
      <div class="mx-auto flex max-w-3xl flex-col gap-5">
        <Show when={props.entries.length === 0 && props.streamingText === null}>
          <p class="py-16 text-center font-narrative text-fg-muted">
            The story has not started. Write what you do.
          </p>
        </Show>
        <For each={props.entries}>
          {(entry) => (
            <EntryView
              entry={entry}
              onEdit={(text) => props.onEdit(entry.id, text)}
              onDelete={() => setPendingDelete(entry.id)}
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

      <ConfirmDialog
        open={pendingDelete() !== null}
        title="Delete entry"
        message="Delete this entry from the timeline? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          const id = pendingDelete();
          setPendingDelete(null);
          if (id) props.onDelete(id);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}
