import ArchiveRestore from "lucide-solid/icons/archive-restore";
import ChevronRight from "lucide-solid/icons/chevron-right";
import { createSignal, For, type JSX, Show } from "solid-js";

/**
 * The pieces every list of named things in a panel shares — the conversations of the Story
 * tab, the folders and sheets of the Library. A row is a button; its actions hide until the
 * row is hovered or one of them is focused, except on the active row; renaming happens in
 * place; and what has been archived folds away under the list rather than leaving it.
 */

/**
 * The mark for "this is the one you are on", wherever a list has rows. The row lifts a tone
 * and takes a hairline of accent down its left edge: two signals rather than one, so the
 * active row survives a dim screen, and the smallest dose of accent that still reads.
 */
export const ACTIVE_ROW =
  "relative overflow-hidden before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-accent";

/** Hidden until the row is hovered or the action focused, except on the active row. */
export function RowAction(props: {
  label: string;
  title: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      class="mr-1 rounded-app p-1 text-fg-muted opacity-0 transition-opacity hover:bg-bg hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 group-hover:disabled:opacity-30"
      classList={{ "opacity-100": props.active }}
      aria-label={props.label}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** Enter commits, Escape cancels, blur commits. Blank titles are dropped by the store. */
export function RenameField(props: {
  value: string;
  label: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = createSignal(props.value);
  let settled = false;

  function commit(): void {
    if (settled) return;
    settled = true;
    props.onCommit(draft());
  }

  function cancel(): void {
    if (settled) return;
    settled = true;
    props.onCancel();
  }

  return (
    <input
      ref={(el) => {
        queueMicrotask(() => {
          el.focus();
          el.select();
        });
      }}
      aria-label={props.label}
      value={draft()}
      spellcheck={false}
      class="m-1 min-w-0 flex-1 rounded-app bg-surface-sunken px-2 py-1 text-sm"
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
    />
  );
}

/** The least a row needs to be listed under Archived. */
export type Archived = { id: string; title: string };

/**
 * What has been archived, folded away under the list it left. Archive is the undo of itself,
 * so it never asks for confirmation and never hides anything for good: the group says how many
 * there are even while closed, and restoring is one click inside it.
 */
export function ArchivedGroup(props: {
  items: readonly Archived[];
  /** What one of these is, for the restore button's label: "conversation", "sheet". */
  noun: string;
  /** The same mark the open rows carry, so an archived row lines up with the list above it. */
  icon: (props: { size?: number; class?: string; "aria-hidden"?: "true" }) => JSX.Element;
  onRestore: (id: string) => void;
}) {
  const [shown, setShown] = createSignal(false);

  return (
    <Show when={props.items.length > 0}>
      <div class="shrink-0 border-t border-border/50">
        <button
          type="button"
          class="flex h-6 w-full items-center gap-1 pr-2 pl-2 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase hover:text-fg-muted"
          aria-expanded={shown()}
          onClick={() => setShown((open) => !open)}
        >
          <ChevronRight
            size={12}
            class="shrink-0 transition-transform motion-reduce:transition-none"
            classList={{ "rotate-90": shown() }}
            aria-hidden="true"
          />
          Archived ({props.items.length})
        </button>
        <Show when={shown()}>
          {/* Capped: an archive deep enough to fill the panel would push the list it belongs
              under off the screen. */}
          <ul class="max-h-48 space-y-0.5 overflow-y-auto px-2 pb-2">
            <For each={props.items}>
              {(item) => (
                <li class="group flex items-center rounded-lg">
                  <span class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-sm text-fg-subtle">
                    <props.icon size={14} class="shrink-0" aria-hidden="true" />
                    <span class="truncate">{item.title}</span>
                  </span>
                  <RowAction
                    label={`Restore ${props.noun} ${item.title}`}
                    title="Restore"
                    active={false}
                    onClick={() => props.onRestore(item.id)}
                  >
                    <ArchiveRestore size={14} aria-hidden="true" />
                  </RowAction>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </Show>
  );
}
