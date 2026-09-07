import SendHorizontal from "lucide-solid/icons/send-horizontal";
import Square from "lucide-solid/icons/square";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { createEffect, createSignal, on, Show } from "solid-js";
import { readDraft, writeDraft } from "../drafts.ts";

export function Composer(props: {
  /** Identifies the campaign whose unsent draft this composer keeps across reloads. */
  draftKey: string;
  busy: boolean;
  hasKey: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = createSignal(readDraft(props.draftKey));
  // Persist every keystroke; a reload (ours or Vite's) must not eat a half-written turn.
  createEffect(on(text, (value) => writeDraft(props.draftKey, value), { defer: true }));

  const empty = () => text().trim() === "";

  function send(): void {
    if (empty() || props.busy) return;
    props.onSubmit(text());
    setText("");
  }

  return (
    <form
      class="border-t border-border bg-surface px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div class="mx-auto flex max-w-3xl flex-col gap-2">
        <Show when={props.error}>
          {(message) => (
            <p class="flex items-start gap-2 text-sm text-danger" role="alert">
              <TriangleAlert size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{message()}</span>
            </p>
          )}
        </Show>
        <textarea
          aria-label="What do you do?"
          placeholder="What do you do?"
          rows={3}
          value={text()}
          disabled={props.busy}
          onInput={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          class="w-full resize-none rounded-app border border-border bg-bg px-3 py-2 outline-none focus:border-accent disabled:opacity-60"
        />
        <div class="flex items-center justify-between gap-3 text-xs text-fg-muted">
          <span>
            {props.hasKey
              ? "Enter to send, Shift+Enter for a new line."
              : "No API key set. Entries are saved, but no one answers. Add a key in Settings."}
          </span>
          <Show
            when={props.busy}
            fallback={
              <button
                type="submit"
                disabled={empty()}
                class="inline-flex shrink-0 items-center gap-1.5 rounded-app bg-accent px-3 py-1 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-40"
              >
                Send
                <SendHorizontal size={14} aria-hidden="true" />
              </button>
            }
          >
            <button
              type="button"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-app border border-border px-3 py-1 text-sm hover:bg-surface-raised"
              onClick={() => props.onStop()}
            >
              <Square size={12} aria-hidden="true" />
              Stop
            </button>
          </Show>
        </div>
      </div>
    </form>
  );
}
