import type { NarrativeEntry } from "@archefict/schema";
import { createEffect, For, on, Show } from "solid-js";
import { EntryView } from "./EntryView.tsx";

export function NarrativeFeed(props: {
  entries: readonly NarrativeEntry[];
  streamingText: string | null;
}) {
  let bottom: HTMLDivElement | undefined;

  createEffect(
    on(
      () => [props.entries.length, props.streamingText] as const,
      () => bottom?.scrollIntoView({ block: "end" }),
    ),
  );

  return (
    <section class="flex-1 overflow-y-auto px-4 py-6" aria-label="Narrative" aria-live="polite">
      <div class="mx-auto flex max-w-3xl flex-col gap-4">
        <Show when={props.entries.length === 0 && props.streamingText === null}>
          <p class="py-16 text-center font-narrative text-fg-muted">
            The story has not started. Write what you do.
          </p>
        </Show>
        <For each={props.entries}>
          {(entry) => <EntryView kind={entry.kind} text={entry.text} />}
        </For>
        <Show when={props.streamingText !== null}>
          <EntryView kind="ai" text={props.streamingText ?? ""} streaming />
        </Show>
        <div ref={bottom} />
      </div>
    </section>
  );
}
