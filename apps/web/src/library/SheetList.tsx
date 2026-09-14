import type { SheetSummary } from "@archefict/schema";
import { createSignal, For, Show } from "solid-js";
import { SheetRow } from "./SheetRow.tsx";

/**
 * A flat list of sheets: the models tab, and what a search answers with. No folders and no
 * dragging — a model's place is the models tab, and a search result's place is the query.
 * Reordering belongs where order is visible, which is the tree.
 */
export function SheetList(props: {
  items: readonly { sheet: SheetSummary; where?: string | undefined }[];
  label: string;
  /** What to say when there is nothing to list. */
  empty: string;
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [renaming, setRenaming] = createSignal<string | null>(null);

  return (
    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2" aria-label={props.label}>
      <Show when={props.items.length === 0}>
        <p class="px-2 py-4 text-sm text-fg-subtle">{props.empty}</p>
      </Show>
      <ul class="space-y-0.5">
        <For each={props.items}>
          {(item) => (
            <SheetRow
              sheet={item.sheet}
              where={item.where}
              active={item.sheet.id === props.activeId}
              renaming={renaming() === item.sheet.id}
              onSelect={() => props.onSelect(item.sheet.id)}
              onStartRename={() => setRenaming(item.sheet.id)}
              onRename={(title) => {
                setRenaming(null);
                props.onRename(item.sheet.id, title);
              }}
              onCancelRename={() => setRenaming(null)}
              onDuplicate={() => props.onDuplicate(item.sheet.id)}
              onArchive={() => props.onArchive(item.sheet.id)}
            />
          )}
        </For>
      </ul>
    </nav>
  );
}
