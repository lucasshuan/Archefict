import { type JSX, Show } from "solid-js";
import { Menu, type MenuItem } from "./Menu.tsx";
import { usePanelGroup } from "./panel-group.tsx";

/** What a panel with a width of its own asks for before anyone drags its gutter. */
const DEFAULT_WIDTH = 256;

/**
 * A region of a tab. Every region is one: the bar makes a panel a thing that can be picked up,
 * hidden and given options, which is what Slice 5's layout editor will do to it
 * (docs/workspace.md).
 *
 * The bar carries no name. A panel and its one section used to say the same word twice —
 * *Conversations* over *OPEN*, *Library* over *SHEETS* — so the name went where the content is
 * and the bar kept the three things that are about the panel rather than about what is in it:
 * the grip, a status, and `⋯`. The `title` is still the panel's accessible name and still
 * labels its menu; it is simply not drawn. A panel that wants a visible name gives its section
 * one (`PanelSection`).
 *
 * Every panel is the same card — rounded, `--bg`, no border — and the gutter of ground around it
 * is what tells one from the next, so a panel reads the same wherever Slice 5 drops it. The
 * caller's `class` sizes it, never tones it.
 *
 * Inside a `PanelGroup` the bar is also the drag handle and the group owns the width, so the
 * caller gives an `id` and a `width` instead of a sizing class. `width: null` marks the panel
 * that takes whatever the others leave.
 */
export function Panel(props: {
  /** Stable across renders: the group remembers a panel's place and width under this id. */
  id: string;
  /** The panel's accessible name and the label of its menu. Never drawn — see above. */
  title: string;
  /** Width in pixels, or null for the panel that takes the leftover. */
  width?: number | null;
  status?: JSX.Element;
  menu?: readonly MenuItem[];
  class?: string;
  children: JSX.Element;
}) {
  const group = usePanelGroup();
  group?.register(props.id, props.width === null ? null : (props.width ?? DEFAULT_WIDTH));

  // Layout options come after a separator, which has nothing to separate when the panel
  // brought no menu of its own.
  const menu = (): readonly MenuItem[] => {
    const own = props.menu ?? [];
    const items = [...own, ...(group?.layoutItems(props.id) ?? [])];
    const first = items[0];
    return own.length === 0 && first !== undefined && "separator" in first ? items.slice(1) : items;
  };

  return (
    <section
      data-panel-id={props.id}
      class={`flex min-h-0 min-w-0 flex-col rounded-app bg-bg ${props.class ?? ""}`}
      classList={{ "opacity-70": group?.dragging() === props.id }}
      style={group?.style(props.id)}
      aria-label={props.title}
    >
      {/* The bar is the handle: a press anywhere on it that is not one of its buttons picks
          the panel up. A hairline under it, not a tint on hover: the only tone a bar could take
          is the ground's, which reads as a hole punched in the card rather than a highlight. */}
      <div
        class="flex h-6 shrink-0 touch-none select-none items-center justify-end gap-1 border-b border-border/50 pr-1.5 pl-3"
        classList={{ "cursor-grab active:cursor-grabbing": group !== undefined }}
        onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest("button")) group?.startDrag(props.id, event);
        }}
      >
        {props.status}
        <Show when={menu().length > 0 ? menu() : null}>
          {(items) => <Menu label={`${props.title} options`} items={items()} />}
        </Show>
      </div>
      {/* The body clips to the card's bottom corners, never the card itself: the bar's
          `⋯` menu hangs below the bar and an overflow-hidden card would cut it off. */}
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-app">{props.children}</div>
    </section>
  );
}
