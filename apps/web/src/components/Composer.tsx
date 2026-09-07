import SendHorizontal from "lucide-solid/icons/send-horizontal";
import Square from "lucide-solid/icons/square";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { createEffect, createSignal, on, onMount, Show } from "solid-js";
import { readDraft, writeDraft } from "../drafts.ts";

/** Past this height the textarea scrolls instead of growing. About eight lines. */
const MAX_HEIGHT_PX = 220;

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
  let textarea: HTMLTextAreaElement | undefined;

  // Persist every keystroke; a reload (ours or Vite's) must not eat a half-written turn.
  createEffect(on(text, (value) => writeDraft(props.draftKey, value), { defer: true }));

  /** Grow with the content, then stop and scroll. Runs on mount too, for a restored draft. */
  function fit(): void {
    const el = textarea;
    if (!el) return;
    el.style.height = "auto";
    const overflowing = el.scrollHeight > MAX_HEIGHT_PX;
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = overflowing ? "auto" : "hidden";
  }
  onMount(fit);
  createEffect(on(text, fit, { defer: true }));

  const empty = () => text().trim() === "";

  function send(): void {
    if (empty() || props.busy) return;
    props.onSubmit(text());
    setText("");
  }

  return (
    <form
      class="px-4 pb-4 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div class="mx-auto flex max-w-3xl flex-col gap-1.5">
        <Show when={props.error}>
          {(message) => (
            <p class="flex items-start gap-2 px-1 text-sm text-danger" role="alert">
              <TriangleAlert size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{message()}</span>
            </p>
          )}
        </Show>

        <div class="flex items-end gap-2 rounded-2xl border border-border bg-surface py-2 pr-2 pl-4 shadow-lg transition-colors focus-within:border-accent">
          <textarea
            ref={textarea}
            aria-label="What do you do?"
            placeholder="What do you do?"
            rows={1}
            value={text()}
            disabled={props.busy}
            onInput={(event) => setText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            class="min-h-6 flex-1 resize-none bg-transparent py-1 leading-6 outline-none placeholder:text-fg-muted disabled:opacity-60"
          />
          <Show
            when={props.busy}
            fallback={
              <button
                type="submit"
                disabled={empty()}
                aria-label="Send"
                title="Send (Enter)"
                class="shrink-0 rounded-full bg-accent p-2 text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <SendHorizontal size={16} aria-hidden="true" />
              </button>
            }
          >
            <button
              type="button"
              aria-label="Stop"
              title="Stop"
              class="shrink-0 rounded-full border border-border p-2 text-fg-muted hover:bg-surface-raised hover:text-fg"
              onClick={() => props.onStop()}
            >
              <Square size={14} aria-hidden="true" />
            </button>
          </Show>
        </div>

        <p class="px-2 text-xs text-fg-muted">
          {props.hasKey
            ? "Enter to send, Shift+Enter for a new line."
            : "No API key set. Entries are saved, but no one answers. Add a key in Settings."}
        </p>
      </div>
    </form>
  );
}
