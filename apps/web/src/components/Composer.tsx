import Redo2 from "lucide-solid/icons/redo-2";
import SendHorizontal from "lucide-solid/icons/send-horizontal";
import Square from "lucide-solid/icons/square";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import Undo2 from "lucide-solid/icons/undo-2";
import { createEffect, createSignal, on, onMount, Show } from "solid-js";
import { readDraft, writeDraft } from "../drafts.ts";
import { fitHeight } from "./auto-grow.ts";

/** Past this height the textarea scrolls instead of growing. About eight lines. */
const MAX_HEIGHT_PX = 220;

export function Composer(props: {
  /** Identifies the campaign whose unsent draft this composer keeps across reloads. */
  draftKey: string;
  busy: boolean;
  hasKey: boolean;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [text, setText] = createSignal(readDraft(props.draftKey));
  let textarea: HTMLTextAreaElement | undefined;

  // Persist every keystroke; a reload (ours or Vite's) must not eat a half-written turn.
  createEffect(on(text, (value) => writeDraft(props.draftKey, value), { defer: true }));

  const fit = () => textarea && fitHeight(textarea, MAX_HEIGHT_PX);
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

        <div class="flex items-end gap-1">
          <div class="flex min-w-0 flex-1 items-end gap-2 rounded-3xl bg-surface py-2 pr-2 pl-5 shadow-xl transition-shadow focus-within:ring-2 focus-within:ring-accent/40">
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
                class="shrink-0 rounded-full bg-surface-raised p-2 text-fg-muted hover:text-fg"
                onClick={() => props.onStop()}
              >
                <Square size={14} aria-hidden="true" />
              </button>
            </Show>
          </div>

          {/* Beside the pill, not inside it: the pill is for composing, these act on the
              timeline. pb-2 lines them up with the send button, which sits inside the pill's
              own padding. Undo replaces the delete confirmation. */}
          <div class="flex shrink-0 items-center gap-0.5 pb-2">
            <button
              type="button"
              disabled={!props.canUndo || props.busy}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              class="rounded-full p-2 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg disabled:pointer-events-none disabled:opacity-30"
              onClick={() => props.onUndo()}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!props.canRedo || props.busy}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              class="rounded-full p-2 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg disabled:pointer-events-none disabled:opacity-30"
              onClick={() => props.onRedo()}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
