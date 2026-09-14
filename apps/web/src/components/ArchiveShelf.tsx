import ArchiveRestore from "lucide-solid/icons/archive-restore";
import Trash2 from "lucide-solid/icons/trash-2";
import { createSignal, For, type JSX, Show } from "solid-js";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { Dialog } from "./Dialog.tsx";
import type { Archived } from "./list-row.tsx";

/** What is being deleted for good: one named thing, or everything on the shelf. */
type Pending = { ids: readonly string[]; what: string };

/**
 * What has been archived, and the one place it can be restored or destroyed. The Story tab and
 * the Library share it: both archive, both need a way back, and neither wants that list in the
 * panel it left.
 *
 * A strip at the foot of the panel says how many there are and opens a dialog (Sep 14, 2026).
 * It used to fold open in place, which was fine while archive was only undo — but delete is not
 * undoable, and a permanent action does not belong in a fold that a stray click can open next
 * to the list it destroys. A dialog is a room you have to walk into. Archiving itself stays
 * unconfirmed, because it is its own undo; deleting always asks.
 */
export function ArchiveShelf(props: {
  items: readonly Archived[];
  /** What one of these is, in the singular: "conversation", "sheet". */
  noun: string;
  /** The same mark the open rows carry, so an archived row reads as the same kind of thing. */
  icon: (props: { size?: number; class?: string; "aria-hidden"?: "true" }) => JSX.Element;
  onRestore: (id: string) => void;
  /** Removes them and their documents for good. Nothing brings them back. */
  onDelete: (ids: readonly string[]) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [pending, setPending] = createSignal<Pending | null>(null);
  const plural = () => `${props.noun}s`;
  const title = () => `Archived ${plural()}`;

  function destroy(): void {
    const target = pending();
    setPending(null);
    if (target === null) return;
    // Asked before the list changes under it: an empty room closes itself.
    const emptied = target.ids.length >= props.items.length;
    props.onDelete(target.ids);
    if (emptied) setOpen(false);
  }

  return (
    <Show when={props.items.length > 0}>
      <div class="shrink-0 border-t border-border/50">
        <button
          type="button"
          class="flex h-7 w-full items-center px-4 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase hover:text-fg-muted"
          onClick={() => setOpen(true)}
        >
          Archived ({props.items.length})
        </button>
      </div>

      <Dialog open={open()} title={title()} onClose={() => setOpen(false)}>
        <p class="text-sm text-fg-muted">
          Restoring puts one back where it was. Deleting removes it and everything in it for good.
        </p>
        {/* Capped: an archive deep enough to fill the screen would push the buttons off it. */}
        <ul class="-mx-1 max-h-72 space-y-0.5 overflow-y-auto px-1">
          <For each={props.items}>
            {(item) => (
              <li class="group flex items-center rounded-lg transition-colors hover:bg-surface-raised/60 motion-reduce:transition-none">
                <span class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-sm text-fg-muted">
                  <props.icon size={14} class="shrink-0 text-fg-subtle" aria-hidden="true" />
                  <span class="truncate">{item.title}</span>
                </span>
                {/* Both hide together, the way a row's actions do everywhere else. One
                    wrapper rather than a rule on each, so tabbing from one to the other does
                    not fade the one being left. */}
                <div class="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none">
                  <button
                    type="button"
                    class="mr-1 inline-flex items-center gap-1.5 rounded-app px-2 py-1 text-xs text-fg-muted hover:bg-surface-sunken hover:text-fg"
                    aria-label={`Restore ${props.noun} ${item.title}`}
                    onClick={() => props.onRestore(item.id)}
                  >
                    <ArchiveRestore size={14} aria-hidden="true" />
                    Restore
                  </button>
                  <button
                    type="button"
                    class="mr-1 rounded-app p-1 text-fg-muted hover:bg-surface-sunken hover:text-danger"
                    aria-label={`Delete ${props.noun} ${item.title} for good`}
                    title="Delete for good"
                    onClick={() => setPending({ ids: [item.id], what: `"${item.title}"` })}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>
        <div class="flex items-center justify-between gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-app px-2 py-1 text-sm text-danger hover:bg-danger/15"
            onClick={() =>
              setPending({
                ids: props.items.map((item) => item.id),
                what: `all ${props.items.length} archived ${plural()}`,
              })
            }
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete all
          </button>
          <button
            type="button"
            class="rounded-app bg-surface-raised px-3 py-1 hover:opacity-80"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pending() !== null}
        title={`Delete ${plural()}`}
        message={`Delete ${pending()?.what ?? ""} for good? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={destroy}
        onClose={() => setPending(null)}
      />
    </Show>
  );
}
