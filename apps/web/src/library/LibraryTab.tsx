import type { CampaignHandles } from "@archefict/crdt";
import Diamond from "lucide-solid/icons/diamond";
import FilePlus from "lucide-solid/icons/file-plus";
import FileText from "lucide-solid/icons/file-text";
import FolderPlus from "lucide-solid/icons/folder-plus";
import Image from "lucide-solid/icons/image";
import Search from "lucide-solid/icons/search";
import X from "lucide-solid/icons/x";
import { createResource, createSignal, type JSX, Match, Show, Switch } from "solid-js";
import type { LibraryTabId, SheetsStore } from "../campaign/sheets.ts";
import { ArchiveShelf } from "../components/ArchiveShelf.tsx";
import { IconTabs } from "../components/IconTabs.tsx";
import { Panel } from "../components/Panel.tsx";
import { PanelGroup } from "../components/panel-group.tsx";
import { LibraryTree } from "./LibraryTree.tsx";
import { SheetEditor } from "./SheetEditor.tsx";
import { SheetList } from "./SheetList.tsx";
import { searchSheets } from "./search.ts";
import { createSheetViewStore } from "./view-store.ts";

const TABS = [
  { id: "sheets" as const, label: "Sheets", icon: FileText },
  { id: "models" as const, label: "Models", icon: Diamond },
  { id: "assets" as const, label: "Assets", icon: Image },
];

/**
 * The Library tab: the open sheet and the library panel. Two panels, peers, arranged as in
 * docs/workspace.md — the sheet against the reading edge, the library far right. The panel
 * writes the active id into the store; the sheet panel opens that sheet's document and reads
 * it. Keyed on the document handle, so switching sheets gives the editor a fresh mount.
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

      <LibraryPanel sheets={props.sheets} />
    </PanelGroup>
  );
}

/**
 * The library: a search box, three lists behind icons, and the archive shelf at the foot.
 *
 * The section header is gone (Sep 14, 2026). It held the word SHEETS and three `+` buttons, and
 * all three had to change meaning as soon as models and assets became lists of their own. A
 * search box says what is being searched in its own placeholder, the tabs say which list is
 * open, and the one create action belongs to whichever list that is — so nothing in the header
 * means two things at once. The panel `⋯` still lists every one of them, which is where a
 * person who has never hovered finds out they exist.
 */
const LIST_PANEL = "library-list";

function LibraryPanel(props: { sheets: SheetsStore }) {
  const [query, setQuery] = createSignal("");
  const tab = () => props.sheets.tab();
  const searching = () => query().trim() !== "";
  // A search answers within the list that is open: the tabs are kinds of thing, and a search
  // that crossed them would make the tab underneath it a lie.
  const pool = () => (tab() === "models" ? props.sheets.models() : props.sheets.documents());
  const results = () => searchSheets(query(), pool(), props.sheets.folders());

  const create = () => {
    if (tab() === "models") void props.sheets.createModel();
    else void props.sheets.createSheet(null);
  };

  function show(next: LibraryTabId): void {
    props.sheets.showTab(next);
    // A query is about one list. Carrying it into the next one hides that list for no reason.
    setQuery("");
  }

  return (
    <Panel
      id="library"
      title="Library"
      width={288}
      menu={[
        {
          label: "New sheet",
          icon: FilePlus,
          onSelect: () => void props.sheets.createSheet(null),
        },
        {
          label: "New folder",
          icon: FolderPlus,
          onSelect: () => void props.sheets.createFolder(null),
        },
        { label: "New model", icon: Diamond, onSelect: () => void props.sheets.createModel() },
        { separator: true },
        {
          label: "Sheets",
          icon: FileText,
          onSelect: () => show("sheets"),
          disabled: tab() === "sheets",
        },
        {
          label: "Models",
          icon: Diamond,
          onSelect: () => show("models"),
          disabled: tab() === "models",
        },
        {
          label: "Assets",
          icon: Image,
          onSelect: () => show("assets"),
          disabled: tab() === "assets",
        },
      ]}
    >
      <div class="flex shrink-0 flex-col gap-1.5 px-2 pt-2">
        <SearchField
          value={query()}
          placeholder={`Search ${tab()}`}
          onInput={setQuery}
          disabled={tab() === "assets"}
        />
        <div class="flex items-center justify-between">
          <IconTabs
            label="Library lists"
            tabs={TABS}
            active={tab()}
            panelId={LIST_PANEL}
            onSelect={show}
          />
          <Show when={tab() !== "assets"}>
            <div class="flex items-center gap-0.5">
              <Show when={tab() === "sheets"}>
                <HeaderAction
                  label="New folder"
                  onClick={() => void props.sheets.createFolder(null)}
                >
                  <FolderPlus size={16} aria-hidden="true" />
                </HeaderAction>
              </Show>
              <HeaderAction label={tab() === "models" ? "New model" : "New sheet"} onClick={create}>
                <FilePlus size={16} aria-hidden="true" />
              </HeaderAction>
            </div>
          </Show>
        </div>
      </div>

      <div
        id={LIST_PANEL}
        role="tabpanel"
        aria-labelledby={`${LIST_PANEL}-tab-${tab()}`}
        class="flex min-h-0 flex-1 flex-col"
      >
        <Switch>
          <Match when={searching()}>
            <SheetList
              label={`Search results in ${tab()}`}
              items={results()}
              empty={`Nothing in ${tab()} matches "${query().trim()}".`}
              activeId={props.sheets.active()?.id ?? null}
              onSelect={(id) => props.sheets.select(id)}
              onRename={(id, title) => void props.sheets.renameSheet(id, title)}
              onDuplicate={(id) => void props.sheets.duplicateSheet(id)}
              onArchive={(id) => void props.sheets.archiveSheet(id)}
            />
          </Match>
          <Match when={tab() === "sheets"}>
            <LibraryTree
              folders={props.sheets.folders()}
              sheets={props.sheets.documents()}
              hidden={[...props.sheets.models(), ...props.sheets.archived()]}
              activeId={props.sheets.active()?.id ?? null}
              expanded={props.sheets.expanded()}
              onSelect={(id) => props.sheets.select(id)}
              onToggle={(id) => props.sheets.toggleFolder(id)}
              onCreateSheet={(folderId) => void props.sheets.createSheet(folderId)}
              onCreateFolder={(parentId) => void props.sheets.createFolder(parentId)}
              onRenameSheet={(id, title) => void props.sheets.renameSheet(id, title)}
              onRenameFolder={(id, title) => void props.sheets.renameFolder(id, title)}
              onRemoveFolder={(id) => void props.sheets.removeFolder(id)}
              onDuplicate={(id) => void props.sheets.duplicateSheet(id)}
              onArchive={(id) => void props.sheets.archiveSheet(id)}
              onMoveSheet={(id, folderId, beside) =>
                void props.sheets.moveSheet(id, folderId, beside)
              }
              models={props.sheets.models()}
            />
          </Match>
          <Match when={tab() === "models"}>
            <SheetList
              label="Models"
              items={props.sheets.models().map((sheet) => ({ sheet }))}
              empty="No models yet. A model is a sheet other sheets take their shape from."
              activeId={props.sheets.active()?.id ?? null}
              onSelect={(id) => props.sheets.select(id)}
              onRename={(id, title) => void props.sheets.renameSheet(id, title)}
              onDuplicate={(id) => void props.sheets.duplicateSheet(id)}
              onArchive={(id) => void props.sheets.archiveSheet(id)}
            />
          </Match>
          <Match when={tab() === "assets"}>
            <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Image size={20} class="text-fg-subtle" aria-hidden="true" />
              <p class="text-sm text-fg-subtle">
                Nothing here yet. Images and files will live in the library beside the sheets that
                use them.
              </p>
            </div>
          </Match>
        </Switch>
      </div>

      <ArchiveShelf
        items={props.sheets.archived()}
        noun="sheet"
        icon={FileText}
        onRestore={(id) => void props.sheets.restoreSheet(id)}
        onDelete={(ids) => void props.sheets.deleteSheets(ids)}
      />
    </Panel>
  );
}

/** The search box. A well in the panel, the one bordered thing a panel holds (control.ts). */
function SearchField(props: {
  value: string;
  placeholder: string;
  disabled: boolean;
  onInput: (value: string) => void;
}) {
  return (
    <div class="relative flex items-center">
      <Search
        size={14}
        class="pointer-events-none absolute left-2 text-fg-subtle"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={props.placeholder}
        placeholder={props.placeholder}
        value={props.value}
        disabled={props.disabled}
        spellcheck={false}
        class="min-w-0 flex-1 rounded-app border border-border bg-surface-sunken py-1 pr-7 pl-7 text-sm disabled:opacity-40"
        onInput={(event) => props.onInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || props.value === "") return;
          // Escape clears rather than closes: there is nothing here to close.
          event.preventDefault();
          event.stopPropagation();
          props.onInput("");
        }}
      />
      <Show when={props.value !== ""}>
        <button
          type="button"
          class="absolute right-1 rounded-app p-1 text-fg-subtle hover:bg-surface-sunken hover:text-fg"
          aria-label="Clear search"
          onClick={() => props.onInput("")}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </Show>
    </div>
  );
}

/** An icon button beside the tabs: what the open list can make. */
function HeaderAction(props: { label: string; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      class="rounded-app p-1.5 text-fg-muted hover:bg-surface-raised hover:text-fg"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </button>
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
