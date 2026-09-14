import { type Beside, bySiblingOrder } from "@archefict/crdt";
import type { Folder, SheetSummary } from "@archefict/schema";
import ChevronRight from "lucide-solid/icons/chevron-right";
import Diamond from "lucide-solid/icons/diamond";
import FilePlus from "lucide-solid/icons/file-plus";
import FolderPlus from "lucide-solid/icons/folder-plus";
import Pencil from "lucide-solid/icons/pencil";
import Trash2 from "lucide-solid/icons/trash-2";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { RenameField, RowMenu } from "../components/list-row.tsx";
import type { MenuItem } from "../components/Menu.tsx";
import { SheetRow } from "./SheetRow.tsx";

/**
 * How far each level steps in, in pixels. Wide enough that the step is what the eye reads
 * first: at 12 a nested folder and its parent were near enough to level that the depth had to
 * be counted from the chevrons instead of seen.
 */
const INDENT = 16;
/** How far a pointer travels before a press on a sheet counts as a drag and not a click. */
const DRAG_THRESHOLD = 4;
/** Within this much of the panel's top or bottom, a drag scrolls the tree under itself. */
const EDGE = 28;
/** How fast it scrolls there, in pixels a frame, at the very edge. */
const EDGE_SPEED = 10;

/**
 * Where a dragged sheet would land: in `folderId`, beside a sheet already there or last. The
 * same shape the kernel's `moveSheet` takes, so what the indicator draws is what is written.
 */
type Drop = { folderId: string | null; beside: Beside | null };

/**
 * The library as a tree: folders that unfold, sheets inside them. Models are not here — they
 * are a flat list in a tab of their own (docs/workspace.md) — but a model still fills the
 * folder it sits in, which is what `hidden` is for. Selecting is the row; everything that can
 * be done to a row is behind its `⋯` (components/list-row.tsx).
 *
 * A sheet can be dragged: press it, travel 4px, and the tree shows where it would land — a rule
 * between two sheets, or the folder row lit, which puts it last inside that folder. The ground
 * below the tree is the root, last, which is how a sheet comes back out of a folder. Nothing
 * about the press is a handle of its own: the row is one, because a sheet is what moves and the
 * row is the sheet. Near either end of the panel a drag scrolls the tree under itself.
 *
 * The keyboard moves a sheet too, from the row itself: `Alt` with an arrow. Up and down reorder
 * it among its siblings, left takes it out to the folder around its folder, right puts it in the
 * folder drawn directly above it. Focus follows the sheet, so a move can be repeated.
 */
export function LibraryTree(props: {
  folders: readonly Folder[];
  /** The sheets the tree draws: everything open that is not a model. */
  sheets: readonly SheetSummary[];
  /** Sheets that fill a folder without being drawn here: the models, and what is archived. */
  hidden: readonly SheetSummary[];
  activeId: string | null;
  expanded: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggle: (folderId: string) => void;
  onCreateSheet: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameSheet: (id: string, title: string) => void;
  onRenameFolder: (id: string, title: string) => void;
  onRemoveFolder: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  /** Moves a sheet into a folder (null for the root), beside a sheet already there or last. */
  onMoveSheet: (id: string, folderId: string | null, beside: Beside | null) => void;
  /**
   * Every model in the campaign. Only to name the ones a folder already hands to sheets made
   * inside it — the list is read here, never written: see the badge below.
   */
  models: readonly SheetSummary[];
}) {
  const [renaming, setRenaming] = createSignal<string | null>(null);
  const [dragging, setDragging] = createSignal<string | null>(null);
  // Compared by value: a pointer move that lands on the same place must not hand every row
  // in the tree a new answer sixty times a second.
  const [drop, setDrop] = createSignal<Drop | null>(null, {
    equals: (a, b) =>
      a?.folderId === b?.folderId &&
      a?.beside?.id === b?.beside?.id &&
      a?.beside?.side === b?.beside?.side,
  });

  const childFolders = (parent: string | null) =>
    props.folders.filter((folder) => folder.parentId === parent).sort(bySiblingOrder);
  const childSheets = (folderId: string | null) =>
    props.sheets.filter((sheet) => sheet.folderId === folderId).sort(bySiblingOrder);
  const occupied = (folderId: string) =>
    props.folders.some((folder) => folder.parentId === folderId) ||
    props.sheets.some((sheet) => sheet.folderId === folderId) ||
    props.hidden.some((sheet) => sheet.folderId === folderId);

  // Which of the three marks a row wears right now. A folder and the root take the whole row;
  // a sheet takes a rule on the side the dragged one would go.
  const intoFolder = (id: string) => {
    const at = drop();
    return at !== null && at.beside === null && at.folderId === id;
  };
  const atRoot = () => {
    const at = drop();
    return at !== null && at.beside === null && at.folderId === null;
  };
  const besideSheet = (id: string) => {
    const at = drop()?.beside;
    return at !== undefined && at !== null && at.id === id ? at.side : null;
  };

  let nav: HTMLElement | undefined;
  // The drag's own state. None of it is reactive: only `dragging` and `drop` are drawn, and a
  // signal per pointer move would rebuild the tree under the pointer.
  let suppressed = false;
  let pointerY = 0;
  let edge = 0;
  let frame = 0;

  /**
   * The row under the pointer, read from the rows themselves rather than from the tree, so a
   * folder inside a folder needs no arithmetic here. Document order is the order they are drawn
   * in, and the ground below them is the last of them: the root, last.
   */
  function dropAt(y: number, dragged: string): Drop | null {
    const panel = nav;
    if (panel === undefined) return null;
    const bounds = panel.getBoundingClientRect();
    if (y < bounds.top || y > bounds.bottom) return null;
    for (const row of panel.querySelectorAll<HTMLElement>("[data-drop]")) {
      const rect = row.getBoundingClientRect();
      // The first row the pointer has not passed. Testing the bottom alone gives the 2px
      // between two rows to the lower of them, so the mark never blinks out mid-drag.
      if (y >= rect.bottom) continue;
      const kind = row.dataset["drop"];
      const id = row.dataset["dropId"];
      if (kind === "folder" && id !== undefined) return { folderId: id, beside: null };
      if (kind === "sheet" && id !== undefined) {
        if (id === dragged) return null;
        const side = y < rect.top + rect.height / 2 ? "before" : "after";
        return {
          folderId: props.sheets.find((sheet) => sheet.id === id)?.folderId ?? null,
          beside: { id, side },
        };
      }
      return { folderId: null, beside: null };
    }
    return null;
  }

  function scrollStep(): void {
    const dragged = dragging();
    if (nav === undefined || edge === 0 || dragged === null) {
      frame = 0;
      return;
    }
    nav.scrollTop += edge * EDGE_SPEED;
    // The rows moved under a still pointer, so where it points has changed.
    setDrop(dropAt(pointerY, dragged));
    frame = requestAnimationFrame(scrollStep);
  }

  /** How hard the tree scrolls under the pointer: nothing until the last 28px, then to full. */
  function nudge(y: number): void {
    const rect = nav?.getBoundingClientRect();
    if (rect === undefined) return;
    const above = rect.top + EDGE - y;
    const below = y - (rect.bottom - EDGE);
    edge = above > 0 ? -Math.min(above, EDGE) / EDGE : below > 0 ? Math.min(below, EDGE) / EDGE : 0;
    if (edge !== 0 && frame === 0) frame = requestAnimationFrame(scrollStep);
  }

  function endDrag(): void {
    edge = 0;
    setDragging(null);
    setDrop(null);
  }

  onCleanup(() => {
    if (frame !== 0) cancelAnimationFrame(frame);
  });

  function startDrag(id: string, event: PointerEvent): void {
    // A press is a click again until it travels. The release clears this too, on a timer; doing
    // it here as well is what covers a drag that ended somewhere other than this row, where no
    // click ever came to spend the flag.
    suppressed = false;
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    handle.setPointerCapture(event.pointerId);

    const onMove = (moved: PointerEvent) => {
      pointerY = moved.clientY;
      if (dragging() === null) {
        if (Math.hypot(moved.clientX - startX, moved.clientY - startY) < DRAG_THRESHOLD) return;
        setDragging(id);
      }
      nudge(moved.clientY);
      setDrop(dropAt(moved.clientY, id));
    };
    const stop = (ended: PointerEvent) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      // A cancelled pointer — the browser taking over to scroll, a window losing focus — drops
      // nothing. Only a release does.
      const landing = ended.type === "pointerup" ? drop() : null;
      const dragged = dragging();
      endDrag();
      if (dragged === null) return;
      // The click this release is about to raise belongs to the drag, not to the row. It comes
      // in the same task as the release, so a timer of zero is after it and nothing else.
      suppressed = true;
      setTimeout(() => {
        suppressed = false;
      }, 0);
      if (landing !== null) props.onMoveSheet(dragged, landing.folderId, landing.beside);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  // The row to put focus back on once the tree is rebuilt around a keyboard move. Not a signal:
  // nothing draws it, and the ref that reads it runs exactly when the row comes back.
  let refocus: string | null = null;

  const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  function moveByKey(sheet: SheetSummary, event: KeyboardEvent): void {
    if (!event.altKey || !ARROWS.includes(event.key)) return;
    // Taken whether or not there is anywhere to go: Alt with an arrow is the browser's back and
    // forward, and a sheet already at the top of its folder must not navigate away instead.
    event.preventDefault();
    const siblings = childSheets(sheet.folderId);
    const at = siblings.findIndex((other) => other.id === sheet.id);
    const move = (folderId: string | null, beside: Beside | null) => {
      refocus = sheet.id;
      props.onMoveSheet(sheet.id, folderId, beside);
      // The tree is rebuilt inside that call and the row takes the focus back as it returns.
      // A move that changed nothing rebuilds nothing, and this is what clears the mark then.
      queueMicrotask(() => {
        refocus = null;
      });
    };
    if (event.key === "ArrowUp") {
      const above = at < 0 ? undefined : siblings[at - 1];
      if (above) move(sheet.folderId, { id: above.id, side: "before" });
    } else if (event.key === "ArrowDown") {
      const below = at < 0 ? undefined : siblings[at + 1];
      if (below) move(sheet.folderId, { id: below.id, side: "after" });
    } else if (event.key === "ArrowLeft") {
      if (sheet.folderId === null) return;
      const parent = props.folders.find((folder) => folder.id === sheet.folderId);
      move(parent?.parentId ?? null, null);
    } else {
      // A branch draws its folders above its sheets, so the last of them is the folder directly
      // above this sheet — the one "in" means from here.
      const folders = childFolders(sheet.folderId);
      const into = folders[folders.length - 1];
      if (into) move(into.id, null);
    }
  }

  function folderItems(folder: Folder): readonly MenuItem[] {
    const full = occupied(folder.id);
    return [
      { label: "New sheet", icon: FilePlus, onSelect: () => props.onCreateSheet(folder.id) },
      { label: "New folder", icon: FolderPlus, onSelect: () => props.onCreateFolder(folder.id) },
      { label: "Rename", icon: Pencil, onSelect: () => setRenaming(folder.id) },
      { separator: true },
      {
        // Disabled items say nothing about why, and "empty it first" is the whole rule.
        label: full ? "Remove folder — empty it first" : "Remove folder",
        icon: Trash2,
        onSelect: () => props.onRemoveFolder(folder.id),
        disabled: full,
        danger: true,
      },
    ];
  }

  function Branch(branch: { parent: string | null; depth: number }) {
    return (
      <ul class="space-y-0.5">
        <For each={childFolders(branch.parent)}>
          {(folder) => {
            const open = () => props.expanded.has(folder.id);
            return (
              <>
                <li
                  data-drop="folder"
                  data-drop-id={folder.id}
                  // A folder takes no ground on hover, only its own text and arrow. A sheet is
                  // a thing you land on and the lit row says so; a folder is a lid, and a row
                  // that lights the same way says the two are the same kind of click. The one
                  // ground a folder does take is a drag's drop target, which is a state rather
                  // than a pointer passing over.
                  class="group flex items-center rounded-lg transition-colors motion-reduce:transition-none"
                  classList={{ "bg-accent-muted": intoFolder(folder.id) }}
                  // Margin, not padding — see SheetRow: the box steps in with the label, so
                  // the drop highlight a drag lights up is the folder's row and not the
                  // panel's full width.
                  style={{ "margin-left": `${branch.depth * INDENT}px` }}
                >
                  <Show
                    when={renaming() === folder.id}
                    fallback={
                      <>
                        <button
                          type="button"
                          class="group/folder flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-sm text-fg-muted hover:text-fg"
                          aria-expanded={open()}
                          onClick={() => props.onToggle(folder.id)}
                        >
                          {/* The same 14px slot a sheet's icon fills, so a chevron and a file
                              mark sit in one column and depth is the only thing that moves a
                              row sideways. The arrow lights up with the label but stays a step
                              below it: two tones, one gesture. */}
                          <span class="inline-grid w-3.5 shrink-0 place-items-center">
                            <ChevronRight
                              size={12}
                              class="text-fg-subtle transition group-hover/folder:text-fg-muted motion-reduce:transition-none"
                              classList={{ "rotate-90": open() }}
                              aria-hidden="true"
                            />
                          </span>
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
                        <RowMenu
                          label={`${folder.title} options`}
                          active={false}
                          items={folderItems(folder)}
                        />
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
          {(sheet) => (
            <SheetRow
              sheet={sheet}
              active={sheet.id === props.activeId}
              renaming={renaming() === sheet.id}
              faded={dragging() === sheet.id}
              insert={besideSheet(sheet.id)}
              indent={branch.depth * INDENT}
              onButton={(element) => {
                if (refocus !== sheet.id) return;
                refocus = null;
                queueMicrotask(() => element.focus());
              }}
              onPointerDown={(event) => startDrag(sheet.id, event)}
              onKeyDown={(event) => moveByKey(sheet, event)}
              onSelect={() => {
                if (suppressed) return;
                props.onSelect(sheet.id);
              }}
              onStartRename={() => setRenaming(sheet.id)}
              onRename={(title) => {
                setRenaming(null);
                props.onRenameSheet(sheet.id, title);
              }}
              onCancelRename={() => setRenaming(null)}
              onDuplicate={() => props.onDuplicate(sheet.id)}
              onArchive={() => props.onArchive(sheet.id)}
            />
          )}
        </For>
      </ul>
    );
  }

  return (
    <nav
      ref={nav}
      class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2"
      classList={{ "cursor-grabbing select-none": dragging() !== null }}
      aria-label="Library"
    >
      <Show when={props.folders.length === 0 && props.sheets.length === 0}>
        <p class="px-2 py-4 text-sm text-fg-subtle">Nothing here yet.</p>
      </Show>
      <Branch parent={null} depth={0} />
      {/* The ground under the tree. It is the root, last: what a sheet is dropped on to leave
          the folder it is in. It takes the leftover height so there is always some of it. */}
      <div data-drop="root" class="relative min-h-6 flex-1" aria-hidden="true">
        <Show when={atRoot()}>
          <span class="pointer-events-none absolute inset-x-1 top-0.5 h-0.5 rounded-full bg-accent" />
        </Show>
      </div>
    </nav>
  );
}

/**
 * What a folder already hands to sheets made inside it. Nothing in this app sets that list any
 * more (Sep 14, 2026) — the badge reports a campaign that had it set before, and `createSheet`
 * still honours it, so the mark tells the truth rather than hiding a rule that is still running.
 */
function handedTitles(folder: Folder, models: readonly SheetSummary[]): string {
  return (folder.models ?? [])
    .map((id) => models.find((model) => model.id === id)?.title ?? "a missing model")
    .join(", ");
}
