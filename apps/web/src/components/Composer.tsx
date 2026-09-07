import { createSignal, Show } from "solid-js";

export function Composer(props: {
  busy: boolean;
  hasKey: boolean;
  error: string | null;
  onSubmit: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = createSignal("");

  function send(): void {
    const value = text();
    if (value.trim() === "" || props.busy) return;
    props.onSubmit(value);
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
            <p class="text-sm text-danger" role="alert">
              {message()}
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
        <div class="flex items-center justify-between text-xs text-fg-muted">
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
                class="rounded-app bg-accent px-3 py-1 font-medium text-accent-fg hover:opacity-90"
              >
                Send
              </button>
            }
          >
            <button
              type="button"
              class="rounded-app border border-border px-3 py-1 hover:bg-surface-raised"
              onClick={() => props.onStop()}
            >
              Stop
            </button>
          </Show>
        </div>
      </div>
    </form>
  );
}
