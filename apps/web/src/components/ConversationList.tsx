import type { Conversation } from "@archefict/schema";
import Archive from "lucide-solid/icons/archive";
import Copy from "lucide-solid/icons/copy";
import MessageSquareText from "lucide-solid/icons/message-square-text";
import Pencil from "lucide-solid/icons/pencil";
import SquareArrowOutUpRight from "lucide-solid/icons/square-arrow-out-up-right";
import { createSignal, For, Show } from "solid-js";
import { RenameField, ROW_RULE, ROW_RULE_ACTIVE, RowMenu } from "./list-row.tsx";
import type { MenuItem } from "./Menu.tsx";

/**
 * The Story tab's list of conversations. Selecting is the row; everything else is behind the
 * row's `⋯`, the way every list in a panel behaves (list-row.tsx). What has been archived is
 * not here: it is on the shelf at the foot of the panel that holds it.
 */
export function ConversationList(props: {
  open: readonly Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [renaming, setRenaming] = createSignal<string | null>(null);

  function items(conversation: Conversation, active: boolean): readonly MenuItem[] {
    return [
      // The one you are already reading has nowhere to be opened to.
      ...(active
        ? []
        : [
            {
              label: "Open",
              icon: SquareArrowOutUpRight,
              onSelect: () => props.onSelect(conversation.id),
            } as MenuItem,
          ]),
      { label: "Rename", icon: Pencil, onSelect: () => setRenaming(conversation.id) },
      { label: "Duplicate", icon: Copy, onSelect: () => props.onDuplicate(conversation.id) },
      { separator: true },
      { label: "Archive", icon: Archive, onSelect: () => props.onArchive(conversation.id) },
    ];
  }

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
                class={`group flex items-center rounded-lg transition-colors hover:bg-surface-raised/60 motion-reduce:transition-none ${ROW_RULE}`}
                classList={{
                  [`bg-surface-raised hover:bg-surface-raised ${ROW_RULE_ACTIVE}`]: active(),
                }}
              >
                <Show
                  when={renaming() === conversation.id}
                  fallback={
                    <>
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-sm hover:text-fg"
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
                      <RowMenu
                        label={`${conversation.title} options`}
                        active={active()}
                        items={items(conversation, active())}
                      />
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
