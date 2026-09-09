import type { NarrativeEntry } from "@archefict/schema";
import Check from "lucide-solid/icons/check";
import Pencil from "lucide-solid/icons/pencil";
import Trash2 from "lucide-solid/icons/trash-2";
import X from "lucide-solid/icons/x";
import { createEffect, createSignal, on, onMount, Show } from "solid-js";
import { fitHeight } from "./auto-grow.ts";
import { NarrativeMarkdown } from "./NarrativeMarkdown.tsx";

const EDIT_MAX_HEIGHT_PX = 480;

/**
 * One timeline entry. Hover reveals edit and delete; every entry is editable, the AI's
 * included, because the timeline belongs to the player. Ctrl+Enter saves, Escape cancels.
 *
 * Layout: content plus a gutter on the right. The toolbar lives in the gutter and is
 * sticky, so on a long entry it follows the scroll instead of leaving with the top edge.
 */
export function EntryView(props: {
  entry: Pick<NarrativeEntry, "id" | "kind" | "text" | "editedAt">;
  /** Part of the same run as the entry above: tight spacing, no new-turn gap. */
  continued?: boolean;
  streaming?: boolean;
  onEdit?: (text: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  function start(): void {
    setDraft(props.entry.text);
    setEditing(true);
  }

  function save(): void {
    const next = draft().trim();
    setEditing(false);
    if (next !== "" && next !== props.entry.text) props.onEdit?.(next);
  }

  const editable = () => !props.streaming && props.onEdit !== undefined;
  const user = () => props.entry.kind === "user";

  return (
    <article
      class="group flex items-start"
      classList={{ "mt-5": !props.continued, "mt-0": props.continued }}
      data-kind={props.entry.kind}
      aria-busy={props.streaming ? "true" : undefined}
    >
      <div
        class="min-w-0"
        classList={{
          "ml-auto max-w-[85%]": user() && !editing(),
          "w-full": user() && editing(),
          "rounded-2xl bg-surface-raised px-4 py-3": user(),
          // Only square the corner when the toolbar is actually there to meet it. While
          // editing it is hidden, and the editor holds focus, so the corner would open
          // onto nothing.
          "transition-[border-radius] duration-200 ease-out group-hover:rounded-br-none group-focus-within:rounded-br-none motion-reduce:transition-none":
            user() && !editing(),
          "flex-1 rounded-xl px-3 py-1.5 transition-[background-color,border-radius] duration-200 ease-out group-hover:rounded-br-none group-hover:bg-surface group-focus-within:rounded-br-none group-focus-within:bg-surface motion-reduce:transition-none":
            !user() && !editing(),
          "flex-1 rounded-2xl bg-surface px-4 py-3": !user() && editing(),
          // Inset, so the highlight never paints outside the box and into the gutter the
          // toolbar layer owns.
          "inset-ring-2 inset-ring-accent/50": editing(),
          "font-narrative text-[1.05rem] leading-relaxed": props.entry.kind === "ai",
          "text-fg-muted text-sm italic": props.entry.kind === "system",
        }}
      >
        <Show
          when={editing()}
          fallback={
            <NarrativeMarkdown text={props.entry.text} streaming={props.streaming ?? false} />
          }
        >
          <EditBox
            value={draft()}
            onInput={setDraft}
            onSave={save}
            onCancel={() => setEditing(false)}
            canSave={draft().trim() !== ""}
          />
        </Show>
        <Show when={props.entry.editedAt !== undefined && !editing()}>
          <span class="mt-1 block font-body text-xs not-italic text-fg-muted">edited</span>
        </Show>
      </div>

      {/* Gutter: always present so text columns line up. The toolbar sits at the entry's
          bottom edge and sticks there while a long entry scrolls. The offset is negative to
          cancel most of the feed's bottom padding, which otherwise parks it well above the
          visible bottom edge. On hover it slides out from under the entry's edge while that
          corner squares off, so the two read as one shape arriving, not a card fading in.
          Pointer events are off while hidden: the hidden position overlaps the entry. */}
      <div class="flex w-14 shrink-0 flex-col justify-end self-stretch">
        <Show when={editable()}>
          <div
            class="pointer-events-none sticky -bottom-2 flex -translate-x-1.5 gap-0.5 rounded-lg rounded-l-none p-0.5 opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:translate-x-0 motion-reduce:transition-none"
            inert={editing()}
            classList={{
              "bg-surface-raised": user(),
              "bg-surface": !user(),
              // Hidden while editing, but still mounted: a sticky element is its own paint
              // layer, and unmounting it in the same frame the taller editor collapses
              // leaves its pixels behind as a stale streak down the gutter.
              "group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100":
                !editing(),
            }}
          >
            <button
              type="button"
              class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
              aria-label="Edit entry"
              title="Edit"
              onClick={start}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-danger"
              aria-label="Delete entry"
              title="Delete"
              onClick={() => props.onDelete?.()}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        </Show>
      </div>
    </article>
  );
}

function EditBox(props: {
  value: string;
  canSave: boolean;
  onInput: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  let textarea: HTMLTextAreaElement | undefined;
  const fit = () => textarea && fitHeight(textarea, EDIT_MAX_HEIGHT_PX);
  onMount(() => {
    fit();
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  createEffect(on(() => props.value, fit, { defer: true }));

  return (
    <div class="flex flex-col gap-2">
      <textarea
        ref={textarea}
        aria-label="Edit entry text"
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            props.onSave();
          } else if (event.key === "Escape") {
            event.preventDefault();
            props.onCancel();
          }
        }}
        class="w-full resize-none bg-transparent outline-none"
      />
      <div class="flex items-center justify-end gap-2 font-body text-xs not-italic">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-app bg-bg px-2 py-1 text-fg hover:opacity-80"
          onClick={() => props.onCancel()}
        >
          <X size={14} aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          disabled={!props.canSave}
          class="inline-flex items-center gap-1 rounded-app bg-accent px-2 py-1 font-medium text-accent-fg hover:opacity-90 disabled:opacity-40"
          onClick={() => props.onSave()}
        >
          <Check size={14} aria-hidden="true" />
          Save
        </button>
      </div>
    </div>
  );
}
