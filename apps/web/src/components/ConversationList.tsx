import type { Conversation } from "@archefict/schema";
import Archive from "lucide-solid/icons/archive";
import ArchiveRestore from "lucide-solid/icons/archive-restore";
import ChevronRight from "lucide-solid/icons/chevron-right";
import Pencil from "lucide-solid/icons/pencil";
import { createSignal, For, Show } from "solid-js";
import { RenameField, RowAction } from "./list-row.tsx";

/**
 * The Story tab's list of conversations. Selecting is the row; renaming and archiving are
 * the two actions a row reveals on hover, the way the sidebar reveals delete. Archived ones
 * fold away under a toggle rather than vanish: archive is the undo of itself, so it never
 * asks for confirmation.
 */
export function ConversationList(props: {
  open: readonly Conversation[];
  archived: readonly Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [renaming, setRenaming] = createSignal<string | null>(null);
  const [showArchived, setShowArchived] = createSignal(false);

  return (
    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2" aria-label="Conversations">
      <Show when={props.open.length === 0}>
        <p class="px-2 py-4 text-sm text-fg-subtle">No open conversations.</p>
      </Show>
      <ul class="space-y-0.5">
        <For each={props.open}>
          {(conversation) => {
            const active = () => conversation.id === props.activeId;
            return (
              <li
                class="group flex items-center rounded-xl"
                classList={{ "bg-surface-raised": active() }}
              >
                <Show
                  when={renaming() === conversation.id}
                  fallback={
                    <>
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center px-2 py-1.5 text-left text-sm hover:text-fg"
                        classList={{ "text-fg": active(), "text-fg-muted": !active() }}
                        aria-current={active() ? "true" : undefined}
                        onClick={() => props.onSelect(conversation.id)}
                      >
                        <span class="truncate">{conversation.title}</span>
                      </button>
                      <RowAction
                        label={`Rename ${conversation.title}`}
                        title="Rename"
                        active={active()}
                        onClick={() => setRenaming(conversation.id)}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </RowAction>
                      <RowAction
                        label={`Archive ${conversation.title}`}
                        title="Archive"
                        active={active()}
                        onClick={() => props.onArchive(conversation.id)}
                      >
                        <Archive size={14} aria-hidden="true" />
                      </RowAction>
                    </>
                  }
                >
                  <RenameField
                    value={conversation.title}
                    label="Conversation name"
                    onCommit={(title) => {
                      setRenaming(null);
                      props.onRename(conversation.id, title);
                    }}
                    onCancel={() => setRenaming(null)}
                  />
                </Show>
              </li>
            );
          }}
        </For>
      </ul>

      <Show when={props.archived.length > 0}>
        <button
          type="button"
          class="mt-3 flex items-center gap-1 px-2 py-1 text-xs font-medium text-fg-subtle hover:text-fg-muted"
          aria-expanded={showArchived()}
          onClick={() => setShowArchived((shown) => !shown)}
        >
          <ChevronRight
            size={12}
            class="transition-transform"
            classList={{ "rotate-90": showArchived() }}
            aria-hidden="true"
          />
          Archived ({props.archived.length})
        </button>
        <Show when={showArchived()}>
          <ul class="space-y-0.5">
            <For each={props.archived}>
              {(conversation) => (
                <li class="group flex items-center rounded-xl">
                  <span class="min-w-0 flex-1 truncate px-2 py-1.5 text-sm text-fg-subtle">
                    {conversation.title}
                  </span>
                  <RowAction
                    label={`Restore ${conversation.title}`}
                    title="Restore"
                    active={false}
                    onClick={() => props.onRestore(conversation.id)}
                  >
                    <ArchiveRestore size={14} aria-hidden="true" />
                  </RowAction>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </nav>
  );
}
