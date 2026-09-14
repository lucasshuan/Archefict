import type { CampaignHandles } from "@archefict/crdt";
import Diamond from "lucide-solid/icons/diamond";
import FilePlus from "lucide-solid/icons/file-plus";
import FileText from "lucide-solid/icons/file-text";
import FolderPlus from "lucide-solid/icons/folder-plus";
import { createResource, Show } from "solid-js";
import type { SheetsStore } from "../campaign/sheets.ts";
import { ArchivedGroup } from "../components/list-row.tsx";
import { Panel } from "../components/Panel.tsx";
import { PanelGroup } from "../components/panel-group.tsx";
import { PanelSection, SectionAction } from "../components/panel-section.tsx";
import { LibraryTree } from "./LibraryTree.tsx";
import { SheetEditor } from "./SheetEditor.tsx";
import { createSheetViewStore } from "./view-store.ts";

/**
 * The Library tab: the open sheet and the tree. Two panels, peers, arranged as in
 * docs/workspace.md — the sheet against the reading edge, the tree far right. The tree writes
 * the active id into the store; the sheet panel opens that sheet's document and reads it.
 * Keyed on the document handle, so switching sheets gives the editor a fresh mount.
 *
 * Fields have no panel of their own any more (docs/sheets.md): they are typed into the body
 * as chips, and the index of them is a view of the sheet, above its body, on request. The
 * view store lives here rather than in the editor so the choice survives switching sheets.
 */
export function LibraryTab(props: { handles: CampaignHandles; sheets: SheetsStore }) {
  const view = createSheetViewStore();
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
    <PanelGroup id="library" defaultOrder={["sheet", "library"]}>
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
              <SheetEditor
                sheet={sheet}
                summary={summary()}
                handles={props.handles}
                sheets={props.sheets}
                view={view}
                onRename={(title) => void props.sheets.renameSheet(summary().id, title)}
              />
            )}
          </Show>
        )}
      </Show>

      <Panel
        id="library"
        title="Library"
        width={288}
        menu={[
          { label: "New sheet", onSelect: () => void props.sheets.createSheet(null) },
          { label: "New folder", onSelect: () => void props.sheets.createFolder(null) },
          { label: "New model", onSelect: () => void props.sheets.createModel(null) },
        ]}
      >
        <PanelSection
          label="Sheets"
          actions={
            <>
              <SectionAction label="New sheet" onClick={() => void props.sheets.createSheet(null)}>
                <FilePlus size={16} aria-hidden="true" />
              </SectionAction>
              <SectionAction
                label="New folder"
                onClick={() => void props.sheets.createFolder(null)}
              >
                <FolderPlus size={16} aria-hidden="true" />
              </SectionAction>
              <SectionAction label="New model" onClick={() => void props.sheets.createModel(null)}>
                <Diamond size={16} aria-hidden="true" />
              </SectionAction>
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
            models={props.sheets.models()}
            onSetFolderModels={(id, models) => void props.sheets.setFolderModels(id, models)}
          />
        </PanelSection>
        <ArchivedGroup
          items={props.sheets.archived()}
          noun="sheet"
          icon={FileText}
          onRestore={(id) => void props.sheets.restoreSheet(id)}
        />
      </Panel>
    </PanelGroup>
  );
}

function EmptyLibrary(props: { hasSheets: boolean; onCreate: () => void }) {
  return (
    <Panel id="sheet" title="Sheet" width={null}>
      <div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p class="font-narrative text-fg-muted">
          {props.hasSheets
            ? "Pick a sheet from the library."
            : "The library is empty. Start with a character, a place, a faction."}
        </p>
        <button
          type="button"
          class="rounded-app bg-accent-muted px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 motion-reduce:transition-none"
          onClick={props.onCreate}
        >
          New sheet
        </button>
      </div>
    </Panel>
  );
}
