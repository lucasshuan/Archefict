import type { CampaignHandles } from "@archefict/crdt";
import FilePlus from "lucide-solid/icons/file-plus";
import FolderPlus from "lucide-solid/icons/folder-plus";
import { createResource, Show } from "solid-js";
import type { SheetsStore } from "../campaign/sheets.ts";
import { Panel, PanelAction } from "../components/Panel.tsx";
import { FieldsPanel } from "./FieldsPanel.tsx";
import { LibraryTree } from "./LibraryTree.tsx";
import { SheetEditor } from "./SheetEditor.tsx";

/**
 * The Library tab: the tree, the open sheet, its fields. Three panels, peers, arranged as in
 * docs/workspace.md. The tree writes the active id into the store; the sheet and fields panels
 * open that sheet's document and read it. Keyed on the document handle, so switching sheets
 * gives the editor and the fields a fresh mount.
 */
export function LibraryTab(props: { handles: CampaignHandles; sheets: SheetsStore }) {
  const [opened] = createResource(
    () => props.sheets.active()?.id ?? null,
    (id) => props.handles.openSheet(id),
  );
  // The id check keeps a stale document from showing for the instant the next one takes to load.
  const current = () => {
    const sheet = opened();
    return sheet && sheet.id === props.sheets.active()?.id ? sheet : null;
  };

  return (
    <div class="flex min-h-0 flex-1">
      <Panel
        title="Library"
        class="w-64 shrink-0 bg-surface"
        actions={
          <>
            <PanelAction label="New sheet" onClick={() => void props.sheets.createSheet(null)}>
              <FilePlus size={16} aria-hidden="true" />
            </PanelAction>
            <PanelAction label="New folder" onClick={() => void props.sheets.createFolder(null)}>
              <FolderPlus size={16} aria-hidden="true" />
            </PanelAction>
          </>
        }
      >
        <LibraryTree
          folders={props.sheets.folders()}
          sheets={props.sheets.sheets()}
          archived={props.sheets.archived()}
          activeId={props.sheets.active()?.id ?? null}
          expanded={props.sheets.expanded()}
          onSelect={(id) => props.sheets.select(id)}
          onToggle={(id) => props.sheets.toggleFolder(id)}
          onCreateSheet={(folderId) => void props.sheets.createSheet(folderId)}
          onCreateFolder={(parentId) => void props.sheets.createFolder(parentId)}
          onRenameSheet={(id, title) => void props.sheets.renameSheet(id, title)}
          onRenameFolder={(id, title) => void props.sheets.renameFolder(id, title)}
          onRemoveFolder={(id) => void props.sheets.removeFolder(id)}
          onArchive={(id) => void props.sheets.archiveSheet(id)}
          onRestore={(id) => void props.sheets.restoreSheet(id)}
        />
      </Panel>

      <Show
        when={props.sheets.active()}
        fallback={
          <EmptyLibrary
            hasSheets={props.sheets.sheets().length > 0}
            onCreate={() => void props.sheets.createSheet(null)}
          />
        }
      >
        {(summary) => (
          <Show when={current()} keyed>
            {(sheet) => (
              <>
                <SheetEditor
                  sheet={sheet}
                  title={summary().title}
                  onRename={(title) => void props.sheets.renameSheet(summary().id, title)}
                />
                <FieldsPanel sheet={sheet} />
              </>
            )}
          </Show>
        )}
      </Show>
    </div>
  );
}

function EmptyLibrary(props: { hasSheets: boolean; onCreate: () => void }) {
  return (
    <Panel title="Sheet" class="flex-1 bg-bg">
      <div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p class="font-narrative text-fg-muted">
          {props.hasSheets
            ? "Pick a sheet from the library."
            : "The library is empty. Start with a character, a place, a faction."}
        </p>
        <button
          type="button"
          class="rounded-app bg-accent px-3 py-1 font-medium text-accent-fg hover:opacity-90"
          onClick={props.onCreate}
        >
          New sheet
        </button>
      </div>
    </Panel>
  );
}
