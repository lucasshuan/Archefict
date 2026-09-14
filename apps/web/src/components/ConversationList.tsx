import type { Conversation } from "@archefict/schema";
import Archive from "lucide-solid/icons/archive";
import MessageSquareText from "lucide-solid/icons/message-square-text";
import Pencil from "lucide-solid/icons/pencil";
import { createSignal, For, Show } from "solid-js";
import { ACTIVE_ROW, RenameField, RowAction } from "./list-row.tsx";

/**
 * The Story tab's list of conversations. Selecting is the row; renaming and archiving are
 * the two actions a row reveals on hover, the way the sidebar reveals delete. What has been
 * archived is not here: it folds away under the list, in the panel that holds it.
 */
export function ConversationList(props: {
  open: readonly Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onArchive: (id: string) => void;
}) {
  const [renaming, setRenaming] = createSignal<string | null>(null);

  return (
    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2" aria-label="Conversations">
      <Show when={props.open.length === 0}>
        <p class="px-2 py-4 text-sm text-fg-subtle">No open conversations.</p>
      </Show>
      <ul class="space-y-0.5">
        <For each={props.open}>
          {(conversation) => {
            const active = () => conversation.id === props.activeId;
            return (
              <li
                class="group flex items-center rounded-lg transition-colors hover:bg-surface motion-reduce:transition-none"
                classList={{
                  [`bg-surface-raised hover:bg-surface-raised ${ACTIVE_ROW}`]: active(),
                }}
              >
                <Show
                  when={renaming() === conversation.id}
                  fallback={
                    <>
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm hover:text-fg"
                        classList={{ "text-fg": active(), "text-fg-muted": !active() }}
                        aria-current={active() ? "true" : undefined}
                        onClick={() => props.onSelect(conversation.id)}
                      >
                        <MessageSquareText
                          size={14}
                          class="shrink-0 text-fg-subtle"
                          aria-hidden="true"
                        />
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
    </nav>
  );
}
