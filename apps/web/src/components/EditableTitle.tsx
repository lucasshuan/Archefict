import Pencil from "lucide-solid/icons/pencil";
import { createSignal, Show } from "solid-js";

/**
 * A heading that turns into an input on click. Enter commits, Escape cancels, blur commits.
 * Blank or unchanged values are dropped without calling back.
 */
export function EditableTitle(props: { value: string; onCommit: (next: string) => void }) {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  function start(): void {
    setDraft(props.value);
    setEditing(true);
  }

  function commit(): void {
    if (!editing()) return;
    setEditing(false);
    const next = draft().trim();
    if (next !== "" && next !== props.value) props.onCommit(next);
  }

  function cancel(): void {
    setEditing(false);
  }

  return (
    <Show
      when={editing()}
      fallback={
        <button
          type="button"
          class="group flex min-w-0 items-center gap-2 rounded-app px-2 py-1 text-left hover:bg-surface-raised"
          title="Rename campaign"
          onClick={start}
        >
          <h1 class="truncate text-base font-semibold tracking-wide">{props.value}</h1>
          <Pencil
            size={14}
            class="shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        </button>
      }
    >
      <input
        ref={(el) => {
          queueMicrotask(() => {
            el.focus();
            el.select();
          });
        }}
        aria-label="Campaign name"
        value={draft()}
        spellcheck={false}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        onBlur={commit}
        class="min-w-0 max-w-md flex-1 rounded-app bg-surface-raised px-2 py-1 ring-2 ring-accent/50 text-base font-semibold tracking-wide outline-none"
      />
    </Show>
  );
}
