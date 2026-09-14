import {
  createContext,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js";
import type { MenuItem } from "./Menu.tsx";

/**
 * A row of panels a person can rearrange: drag a panel by its bar to change the order, drag
 * the gutter between two to change the widths. This is the first piece of Slice 5's layout
 * editor (docs/workspace.md), kept to one axis — panels do not yet move between tabs, split,
 * or stack.
 *
 * The arrangement is this device's business, like drafts and the sidebar, so it lives in
 * localStorage by group and never touches the campaign document.
 *
 * Position comes from the CSS `order` of each panel, never from the order of the DOM: a
 * dragged panel keeps its element, so a streaming reply, a scroll position and a ProseMirror
 * view all survive being moved. Panels take the even orders and the gutters the odd ones.
 */

const PREFIX = "archefict:layout:";
const MIN_WIDTH = 160;
const MAX_WIDTH = 720;
/** How far a pointer travels before a press on a bar counts as a drag and not a click. */
const DRAG_THRESHOLD = 4;
const KEY_STEP = 16;

type Layout = { order: readonly string[]; sizes: Readonly<Record<string, number>> };

type PanelGroupApi = {
  /** Called by each panel as it mounts; `null` width means the panel takes the leftover. */
  register: (id: string, width: number | null) => void;
  style: (id: string) => JSX.CSSProperties;
  startDrag: (id: string, event: PointerEvent) => void;
  dragging: () => string | null;
  /** *Move left* / *Move right* for the panel's own `⋯`, so the keyboard can rearrange too. */
  layoutItems: (id: string) => readonly MenuItem[];
};

const PanelGroupContext = createContext<PanelGroupApi>();

/** The group a panel sits in, or undefined for a panel rendered outside one. */
export function usePanelGroup(): PanelGroupApi | undefined {
  return useContext(PanelGroupContext);
}

/** Two id lists hold the same ids in the same places. */
function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function PanelGroup(props: {
  id: string;
  /**
   * The ids in the arrangement a person gets before they move anything. Needed because a panel
   * can mount late — the narrative waits on its document — and the order a group is given must
   * not depend on which panel won that race.
   */
  defaultOrder: readonly string[];
  children: JSX.Element;
}) {
  let container: HTMLDivElement | undefined;
  const [layout, setLayout] = createSignal<Layout>(read(props.id));
  const [present, setPresent] = createSignal<readonly string[]>([]);
  const [flexible, setFlexible] = createSignal<ReadonlySet<string>>(new Set());
  const [dragging, setDragging] = createSignal<string | null>(null);

  /**
   * The order, minus the panels hidden right now. A hidden panel keeps its slot for later.
   *
   * Both memos compare by value: a width change must not hand `For` a new gutter array, because
   * re-creating a gutter mid-drag takes the pointer capture with it and the drag dies after one
   * move.
   */
  const visible = createMemo(() => layout().order.filter((id) => present().includes(id)), [], {
    equals: sameOrder,
  });
  const gutters = createMemo(
    () => {
      const ids = visible();
      return ids.slice(0, -1).map((id, index) => [id, ids[index + 1] as string] as const);
    },
    [],
    {
      equals: (a, b) =>
        sameOrder(
          a.map(([id]) => id),
          b.map(([id]) => id),
        ),
    },
  );

  /** Where an id the layout has never seen belongs, by the group's default arrangement. */
  function place(order: readonly string[], id: string): string[] {
    const rank = (other: string) => {
      const index = props.defaultOrder.indexOf(other);
      return index < 0 ? props.defaultOrder.length : index;
    };
    const next = [...order];
    const at = next.findIndex((other) => rank(other) > rank(id));
    next.splice(at < 0 ? next.length : at, 0, id);
    return next;
  }

  function commit(next: Layout): Layout {
    write(props.id, next);
    return next;
  }

  function register(id: string, width: number | null): void {
    setPresent((ids) => (ids.includes(id) ? ids : [...ids, id]));
    if (width === null) setFlexible((set) => (set.has(id) ? set : new Set(set).add(id)));
    setLayout((current) => {
      const known = current.order.includes(id);
      const sized = width === null || current.sizes[id] !== undefined;
      if (known && sized) return current;
      return commit({
        order: known ? current.order : place(current.order, id),
        sizes: sized ? current.sizes : { ...current.sizes, [id]: width },
      });
    });
    onCleanup(() => setPresent((ids) => ids.filter((other) => other !== id)));
  }

  /** Moves a panel `offset` places along the visible row, taking its slot in the full order. */
  function move(id: string, offset: number): void {
    const ids = visible();
    const from = ids.indexOf(id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const neighbour = ids[to] as string;
    setLayout((current) => {
      const order = current.order.filter((other) => other !== id);
      order.splice(order.indexOf(neighbour) + (offset > 0 ? 1 : 0), 0, id);
      return commit({ ...current, order });
    });
  }

  function resize(id: string, width: number, persist: boolean): void {
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
    setLayout((current) => {
      if (current.sizes[id] === clamped) return current;
      const next = { ...current, sizes: { ...current.sizes, [id]: clamped } };
      return persist ? commit(next) : next;
    });
  }

  /**
   * The panel the pointer is over, but only once it has passed that panel's midpoint. Without
   * the midpoint a still hand near a boundary would swap the two panels back and forth.
   */
  function targetAt(x: number, id: string): string | null {
    const ids = visible();
    const self = ids.indexOf(id);
    for (const element of container?.querySelectorAll<HTMLElement>("[data-panel-id]") ?? []) {
      const other = element.dataset["panelId"];
      if (other === undefined || other === id) continue;
      const index = ids.indexOf(other);
      if (index < 0) continue;
      const rect = element.getBoundingClientRect();
      if (x < rect.left || x > rect.right) continue;
      const midpoint = rect.left + rect.width / 2;
      return (index > self ? x > midpoint : x < midpoint) ? other : null;
    }
    return null;
  }

  function startDrag(id: string, event: PointerEvent): void {
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    let started = false;
    handle.setPointerCapture(event.pointerId);

    const onMove = (moved: PointerEvent) => {
      if (!started) {
        if (Math.abs(moved.clientX - startX) < DRAG_THRESHOLD) return;
        started = true;
        setDragging(id);
      }
      const target = targetAt(moved.clientX, id);
      if (target === null) return;
      const ids = visible();
      move(id, ids.indexOf(target) - ids.indexOf(id));
    };
    const stop = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      setDragging(null);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  /**
   * A gutter moves the boundary between its two panels by resizing whichever of them has a
   * width of its own; the panel that takes the leftover absorbs the difference. Two flexible
   * neighbours have no boundary to move, so their gutter does nothing.
   */
  function sizedNeighbour(left: string, right: string): { id: string; sign: number } | null {
    if (!flexible().has(left)) return { id: left, sign: 1 };
    if (!flexible().has(right)) return { id: right, sign: -1 };
    return null;
  }

  function startResize(left: string, right: string, event: PointerEvent): void {
    if (event.button !== 0) return;
    const neighbour = sizedNeighbour(left, right);
    if (neighbour === null) return;
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = layout().sizes[neighbour.id] ?? MIN_WIDTH;
    handle.setPointerCapture(event.pointerId);

    const onMove = (moved: PointerEvent) => {
      resize(neighbour.id, startWidth + neighbour.sign * (moved.clientX - startX), false);
    };
    const stop = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      setLayout((current) => commit(current));
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function onGutterKeyDown(left: string, right: string, event: KeyboardEvent): void {
    const step = event.key === "ArrowLeft" ? -KEY_STEP : event.key === "ArrowRight" ? KEY_STEP : 0;
    if (step === 0) return;
    const neighbour = sizedNeighbour(left, right);
    if (neighbour === null) return;
    event.preventDefault();
    resize(neighbour.id, (layout().sizes[neighbour.id] ?? MIN_WIDTH) + neighbour.sign * step, true);
  }

  const api: PanelGroupApi = {
    register,
    dragging,
    startDrag,
    style: (id) => {
      const index = visible().indexOf(id);
      const width = layout().sizes[id];
      const stretch = flexible().has(id) || width === undefined;
      return {
        order: index < 0 ? 0 : index * 2,
        ...(stretch ? { flex: "1 1 0%", "min-width": "0" } : { flex: `0 0 ${width}px` }),
      };
    },
    layoutItems: (id) => {
      const ids = visible();
      if (ids.length < 2) return [];
      const index = ids.indexOf(id);
      return [
        { separator: true },
        { label: "Move left", onSelect: () => move(id, -1), disabled: index <= 0 },
        {
          label: "Move right",
          onSelect: () => move(id, 1),
          disabled: index < 0 || index >= ids.length - 1,
        },
      ];
    },
  };

  return (
    <PanelGroupContext.Provider value={api}>
      <div
        ref={container}
        class="flex min-h-0 flex-1"
        classList={{ "select-none": dragging() !== null }}
      >
        {props.children}
        <For each={gutters()}>
          {([left, right], index) => (
            // An hr is the separator: the padding keeps the hit area a comfortable 8px while
            // bg-clip-content paints only the 2px line down its middle.
            <hr
              aria-orientation="vertical"
              aria-label="Resize panels"
              tabIndex={0}
              class="h-auto w-2 shrink-0 cursor-col-resize touch-none border-0 bg-transparent bg-clip-content px-[3px] transition-colors hover:bg-border focus-visible:bg-accent motion-reduce:transition-none"
              style={{ order: index() * 2 + 1 }}
              onPointerDown={(event) => startResize(left, right, event)}
              onKeyDown={(event) => onGutterKeyDown(left, right, event)}
            />
          )}
        </For>
      </div>
    </PanelGroupContext.Provider>
  );
}

function read(id: string): Layout {
  const empty: Layout = { order: [], sizes: {} };
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (raw === null) return empty;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return empty;
    const { order, sizes } = value as Partial<Layout>;
    return {
      order: Array.isArray(order) ? order.filter((item) => typeof item === "string") : [],
      sizes: typeof sizes === "object" && sizes !== null ? sizes : {},
    };
  } catch {
    return empty;
  }
}

function write(id: string, layout: Layout): void {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(layout));
  } catch {
    // Storage blocked: the arrangement lives only while the page does.
  }
}
