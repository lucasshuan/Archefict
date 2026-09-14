import type { SheetSummary } from "@archefict/schema";
import Archive from "lucide-solid/icons/archive";
import Copy from "lucide-solid/icons/copy";
import Diamond from "lucide-solid/icons/diamond";
import FileText from "lucide-solid/icons/file-text";
import Pencil from "lucide-solid/icons/pencil";
import SquareArrowOutUpRight from "lucide-solid/icons/square-arrow-out-up-right";
import { Show } from "solid-js";
import { RenameField, ROW_RULE, ROW_RULE_ACTIVE, RowMenu } from "../components/list-row.tsx";
import type { MenuItem } from "../components/Menu.tsx";

/**
 * One sheet, wherever it is listed: in the tree, in the flat list of models, in a search
 * result. The three differ only in what surrounds the row — indentation and a drag in the
 * tree, a folder path under the title in a search — so the row itself is one component and
 * its `⋯` says the same four things everywhere.
 */
export function SheetRow(props: {
  sheet: SheetSummary;
  active: boolean;
  renaming: boolean;
  /** Where it came from, drawn under the title. Only search has anywhere to say. */
  where?: string | undefined;
  /** Left inset in pixels, for the tree. */
  indent?: number | undefined;
  /** The rule a drag draws on this row, or null when it is not the drop target. */
  insert?: "before" | "after" | null | undefined;
  faded?: boolean | undefined;
  onPointerDown?: ((event: PointerEvent) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  onButton?: ((element: HTMLButtonElement) => void) | undefined;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const items = (): readonly MenuItem[] => [
    // The sheet already open has nowhere to be opened to.
    ...(props.active
      ? []
      : [{ label: "Open", icon: SquareArrowOutUpRight, onSelect: props.onSelect } as MenuItem]),
    { label: "Rename", icon: Pencil, onSelect: props.onStartRename },
    { label: "Duplicate", icon: Copy, onSelect: props.onDuplicate },
    { separator: true },
    { label: "Archive", icon: Archive, onSelect: props.onArchive },
  ];

  return (
    <li
      data-drop="sheet"
      data-drop-id={props.sheet.id}
      class={`group flex items-center rounded-lg transition-colors hover:bg-surface-raised/60 motion-reduce:transition-none ${ROW_RULE}`}
      classList={{
        [`bg-surface-raised hover:bg-surface-raised ${ROW_RULE_ACTIVE}`]: props.active,
        "opacity-40": props.faded === true,
      }}
      // Margin, not padding: the row's own box steps in, so the hover tone, the rounded
      // corners and the active row's accent rule all start where the row starts. Padding
      // moved the label and left the highlight spanning the panel, which read as a row at
      // the root wearing someone else's text.
      style={{ "margin-left": `${props.indent ?? 0}px` }}
    >
      <Show when={props.insert}>
        {(side) => (
          <span
            class="pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-accent"
            classList={{ "top-0": side() === "before", "bottom-0": side() === "after" }}
            aria-hidden="true"
          />
        )}
      </Show>
      <Show
        when={props.renaming}
        fallback={
          <>
            <button
              ref={(element) => props.onButton?.(element)}
              type="button"
              class="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-sm hover:text-fg"
              classList={{ "text-fg": props.active, "text-fg-muted": !props.active }}
              aria-current={props.active ? "true" : undefined}
              onPointerDown={(event) => props.onPointerDown?.(event)}
              onKeyDown={(event) => props.onKeyDown?.(event)}
              onClick={props.onSelect}
            >
              <Show
                when={props.sheet.kind === "model"}
                fallback={<FileText size={14} class="shrink-0 text-fg-subtle" aria-hidden="true" />}
              >
                <Diamond size={14} class="shrink-0 text-fg-subtle" aria-hidden="true" />
              </Show>
              <span class="flex min-w-0 flex-col">
                <span class="truncate">{props.sheet.title}</span>
                <Show when={props.where}>
                  {(path) => <span class="truncate text-xs text-fg-subtle">{path()}</span>}
                </Show>
              </span>
            </button>
            <RowMenu label={`${props.sheet.title} options`} active={props.active} items={items()} />
          </>
        }
      >
        <RenameField
          value={props.sheet.title}
          label="Sheet name"
          onCommit={props.onRename}
          onCancel={props.onCancelRename}
        />
      </Show>
    </li>
  );
}
