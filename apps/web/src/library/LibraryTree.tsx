import type { Folder, SheetSummary } from "@archefict/schema";
import Archive from "lucide-solid/icons/archive";
import ArchiveRestore from "lucide-solid/icons/archive-restore";
import ChevronRight from "lucide-solid/icons/chevron-right";
import FilePlus from "lucide-solid/icons/file-plus";
import FileText from "lucide-solid/icons/file-text";
import FolderIcon from "lucide-solid/icons/folder";
import FolderOpen from "lucide-solid/icons/folder-open";
import FolderPlus from "lucide-solid/icons/folder-plus";
import Pencil from "lucide-solid/icons/pencil";
import Trash2 from "lucide-solid/icons/trash-2";
import { createSignal, For, Show } from "solid-js";
import { RenameField, RowAction } from "../components/list-row.tsx";

/** How far each level steps in, in pixels. A sheet row adds the chevron's width on top. */
const INDENT = 12;
const CHEVRON = 18;

/**
 * The library as a tree: folders that unfold, sheets inside them, archived sheets folded away
 * at the bottom. Selecting is the row; a row's actions show on hover, the way every list in a
 * panel behaves (components/list-row.tsx). A folder can only be removed once it is empty, and
 * the action says so rather than hiding.
 */
export function LibraryTree(props: {
  folders: readonly Folder[];
  sheets: readonly SheetSummary[];
  archived: readonly SheetSummary[];
  activeId: string | null;
  expanded: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggle: (folderId: string) => void;
  onCreateSheet: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameSheet: (id: string, title: string) => void;
  onRenameFolder: (id: string, title: string) => void;
  onRemoveFolder: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [renaming, setRenaming] = createSignal<string | null>(null);
  const [showArchived, setShowArchived] = createSignal(false);

  const byOrder = <T extends { order: number; title: string }>(a: T, b: T) =>
    a.order - b.order || a.title.localeCompare(b.title);
  const childFolders = (parent: string | null) =>
    props.folders.filter((folder) => folder.parentId === parent).sort(byOrder);
  const childSheets = (folderId: string | null) =>
    props.sheets.filter((sheet) => sheet.folderId === folderId).sort(byOrder);
  const occupied = (folderId: string) =>
    props.folders.some((folder) => folder.parentId === folderId) ||
    props.sheets.some((sheet) => sheet.folderId === folderId) ||
    props.archived.some((sheet) => sheet.folderId === folderId);

  function Branch(branch: { parent: string | null; depth: number }) {
    return (
      <ul class="space-y-0.5">
        <For each={childFolders(branch.parent)}>
          {(folder) => {
            const open = () => props.expanded.has(folder.id);
            return (
              <>
                <li
                  class="group flex items-center rounded-xl"
                  style={{ "padding-left": `${branch.depth * INDENT}px` }}
                >
                  <Show
                    when={renaming() === folder.id}
                    fallback={
                      <>
                        <button
                          type="button"
                          class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm text-fg-muted hover:text-fg"
                          aria-expanded={open()}
                          onClick={() => props.onToggle(folder.id)}
                        >
                          <ChevronRight
                            size={12}
                            class="shrink-0 transition-transform"
                            classList={{ "rotate-90": open() }}
                            aria-hidden="true"
                          />
                          <Show
                            when={open()}
                            fallback={<FolderIcon size={14} class="shrink-0" aria-hidden="true" />}
                          >
                            <FolderOpen size={14} class="shrink-0" aria-hidden="true" />
                          </Show>
                          <span class="truncate">{folder.title}</span>
                        </button>
                        <RowAction
                          label={`New sheet in ${folder.title}`}
                          title="New sheet"
                          active={false}
                          onClick={() => props.onCreateSheet(folder.id)}
                        >
                          <FilePlus size={14} aria-hidden="true" />
                        </RowAction>
                        <RowAction
                          label={`New folder in ${folder.title}`}
                          title="New folder"
                          active={false}
                          onClick={() => props.onCreateFolder(folder.id)}
                        >
                          <FolderPlus size={14} aria-hidden="true" />
                        </RowAction>
                        <RowAction
                          label={`Rename ${folder.title}`}
                          title="Rename"
                          active={false}
                          onClick={() => setRenaming(folder.id)}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </RowAction>
                        <RowAction
                          label={`Remove ${folder.title}`}
                          title={occupied(folder.id) ? "Empty the folder first" : "Remove folder"}
                          active={false}
                          disabled={occupied(folder.id)}
                          onClick={() => props.onRemoveFolder(folder.id)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </RowAction>
                      </>
                    }
                  >
                    <RenameField
                      value={folder.title}
                      label="Folder name"
                      onCommit={(title) => {
                        setRenaming(null);
                        props.onRenameFolder(folder.id, title);
                      }}
                      onCancel={() => setRenaming(null)}
                    />
                  </Show>
                </li>
                <Show when={open()}>
                  <li>
                    <Branch parent={folder.id} depth={branch.depth + 1} />
                  </li>
                </Show>
              </>
            );
          }}
        </For>
        <For each={childSheets(branch.parent)}>
          {(sheet) => {
            const active = () => sheet.id === props.activeId;
            return (
              <li
                class="group flex items-center rounded-xl"
                classList={{ "bg-surface-raised": active() }}
                style={{ "padding-left": `${branch.depth * INDENT + CHEVRON}px` }}
              >
                <Show
                  when={renaming() === sheet.id}
                  fallback={
                    <>
                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm hover:text-fg"
                        classList={{ "text-fg": active(), "text-fg-muted": !active() }}
                        aria-current={active() ? "true" : undefined}
                        onClick={() => props.onSelect(sheet.id)}
                      >
                        <FileText size={14} class="shrink-0" aria-hidden="true" />
                        <span class="truncate">{sheet.title}</span>
                      </button>
                      <RowAction
                        label={`Rename ${sheet.title}`}
                        title="Rename"
                        active={active()}
                        onClick={() => setRenaming(sheet.id)}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </RowAction>
                      <RowAction
                        label={`Archive ${sheet.title}`}
                        title="Archive"
                        active={active()}
                        onClick={() => props.onArchive(sheet.id)}
                      >
                        <Archive size={14} aria-hidden="true" />
                      </RowAction>
                    </>
                  }
                >
                  <RenameField
                    value={sheet.title}
                    label="Sheet name"
                    onCommit={(title) => {
                      setRenaming(null);
                      props.onRenameSheet(sheet.id, title);
                    }}
                    onCancel={() => setRenaming(null)}
                  />
                </Show>
              </li>
            );
          }}
        </For>
      </ul>
    );
  }

  return (
    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2" aria-label="Library">
      <Show when={props.folders.length === 0 && props.sheets.length === 0}>
        <p class="px-2 py-4 text-sm text-fg-subtle">Nothing here yet.</p>
      </Show>
      <Branch parent={null} depth={0} />

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
              {(sheet) => (
                <li class="group flex items-center rounded-xl">
                  <span class="min-w-0 flex-1 truncate px-2 py-1.5 text-sm text-fg-subtle">
                    {sheet.title}
                  </span>
                  <RowAction
                    label={`Restore ${sheet.title}`}
                    title="Restore"
                    active={false}
                    onClick={() => props.onRestore(sheet.id)}
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
