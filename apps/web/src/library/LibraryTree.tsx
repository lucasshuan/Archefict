import type { Folder, SheetSummary } from "@archefict/schema";
import Archive from "lucide-solid/icons/archive";
import ChevronRight from "lucide-solid/icons/chevron-right";
import Diamond from "lucide-solid/icons/diamond";
import FilePlus from "lucide-solid/icons/file-plus";
import FileText from "lucide-solid/icons/file-text";
import FolderIcon from "lucide-solid/icons/folder";
import FolderOpen from "lucide-solid/icons/folder-open";
import FolderPlus from "lucide-solid/icons/folder-plus";
import Pencil from "lucide-solid/icons/pencil";
import Trash2 from "lucide-solid/icons/trash-2";
import { createSignal, For, Show } from "solid-js";
import { ACTIVE_ROW, RenameField, RowAction } from "../components/list-row.tsx";
import { Popover } from "./FieldValue.tsx";

/** How far each level steps in, in pixels. */
const INDENT = 12;
/**
 * A sheet has no chevron, so it steps in by one to put its icon under the folder icons beside
 * it — but only where there are folders beside it. A list of sheets alone would otherwise start
 * indented from nothing, further in than the conversations in the next tab over.
 */
const CHEVRON = 18;

/**
 * The library as a tree: folders that unfold, sheets inside them. What has been archived is
 * at the bottom. Selecting is the row; a row's actions show on hover, the way every list in a
 * panel behaves (components/list-row.tsx). A folder can only be removed once it is empty, and
 * the action says so rather than hiding.
 */
export function LibraryTree(props: {
  folders: readonly Folder[];
  sheets: readonly SheetSummary[];
  /** Only to tell an empty folder from one whose sheets are all archived. */
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
  /** Every model in the campaign, for a folder to hand to sheets made inside it. */
  models: readonly SheetSummary[];
  onSetFolderModels: (id: string, models: readonly string[]) => void;
}) {
  const [renaming, setRenaming] = createSignal<string | null>(null);
  // Which folder's model list is open, by id: rows are rebuilt on every index change (the
  // documents are new objects each time), so state that must outlive a change lives here.
  const [handing, setHanding] = createSignal<string | null>(null);

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
                  class="group flex items-center rounded-lg transition-colors hover:bg-surface motion-reduce:transition-none"
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
                            class="shrink-0 text-fg-subtle transition-transform motion-reduce:transition-none"
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
                          <Show when={(folder.models?.length ?? 0) > 0}>
                            <span
                              class="ml-1 inline-flex shrink-0 items-center text-fg-subtle"
                              title={`Hands ${handedTitles(folder, props.models)}`}
                            >
                              <Diamond size={10} aria-hidden="true" />
                            </span>
                          </Show>
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
                        <Show when={props.models.length > 0}>
                          <FolderModelsAction
                            folder={folder}
                            models={props.models}
                            open={handing() === folder.id}
                            onOpen={() => setHanding(folder.id)}
                            onClose={() => setHanding(null)}
                            onSet={(handed) => props.onSetFolderModels(folder.id, handed)}
                          />
                        </Show>
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
                class="group flex items-center rounded-lg transition-colors hover:bg-surface motion-reduce:transition-none"
                classList={{
                  [`bg-surface-raised hover:bg-surface-raised ${ACTIVE_ROW}`]: active(),
                }}
                style={{
                  "padding-left": `${
                    branch.depth * INDENT + (childFolders(branch.parent).length > 0 ? CHEVRON : 0)
                  }px`,
                }}
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
                        <Show
                          when={sheet.kind === "model"}
                          fallback={
                            <FileText
                              size={14}
                              class="shrink-0 text-fg-subtle"
                              aria-hidden="true"
                            />
                          }
                        >
                          <Diamond size={14} class="shrink-0 text-fg-subtle" aria-hidden="true" />
                        </Show>
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
    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2" aria-label="Library">
      <Show when={props.folders.length === 0 && props.sheets.length === 0}>
        <p class="px-2 py-4 text-sm text-fg-subtle">Nothing here yet.</p>
      </Show>
      <Branch parent={null} depth={0} />
    </nav>
  );
}

function handedTitles(folder: Folder, models: readonly SheetSummary[]): string {
  return (folder.models ?? [])
    .map((id) => models.find((model) => model.id === id)?.title ?? "a missing model")
    .join(", ");
}

/**
 * The models a folder hands to sheets made inside it: a row action that opens a list of every
 * model with a check beside the ones handed. Handed at creation, so this changes nothing
 * about the sheets already there — the list says so.
 */
function FolderModelsAction(props: {
  folder: Folder;
  models: readonly SheetSummary[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSet: (models: readonly string[]) => void;
}) {
  let anchor: HTMLSpanElement | undefined;
  const handed = () => props.folder.models ?? [];
  function toggle(id: string): void {
    const current = handed();
    props.onSet(current.includes(id) ? current.filter((m) => m !== id) : [...current, id]);
  }
  return (
    <span ref={anchor} class="contents">
      <RowAction
        label={`Models handed by ${props.folder.title}`}
        title="Models for new sheets here"
        active={false}
        onClick={props.onOpen}
      >
        <Diamond size={14} aria-hidden="true" />
      </RowAction>
      <Show when={props.open && anchor?.querySelector("button")}>
        {(at) => (
          <Popover
            anchor={at()}
            onClose={props.onClose}
            label={`Models handed by ${props.folder.title}`}
          >
            <div class="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
              New sheets in {props.folder.title} take
            </div>
            <Show
              when={props.models.length > 0}
              fallback={
                <p class="px-3 py-1.5 text-xs text-fg-subtle">
                  No models yet. Make one from the Sheets section.
                </p>
              }
            >
              <div role="listbox" aria-multiselectable="true" aria-label="Models handed">
                <For each={props.models}>
                  {(model) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={handed().includes(model.id)}
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg-muted hover:bg-surface hover:text-fg"
                      onClick={() => toggle(model.id)}
                    >
                      <span class="inline-grid w-3.5 place-items-center">
                        <Show when={handed().includes(model.id)}>✓</Show>
                      </span>
                      <Diamond size={12} aria-hidden="true" class="text-fg-subtle" />
                      <span class="truncate">{model.title}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <p class="px-3 pt-1.5 pb-1 text-xs text-fg-subtle">
              Sheets already here are not changed.
            </p>
          </Popover>
        )}
      </Show>
    </span>
  );
}
