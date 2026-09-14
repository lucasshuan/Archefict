import Ellipsis from "lucide-solid/icons/ellipsis";
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  Show,
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";

/** The shape every icon in the app has: lucide-solid's components, and nothing else. */
export type MenuIcon = (props: {
  size?: number;
  class?: string;
  "aria-hidden"?: "true";
}) => JSX.Element;

export type MenuItem =
  | { separator: true }
  | {
      label: string;
      onSelect: () => void;
      /**
       * The mark beside the label. Optional in the type and present in practice: the slot is
       * drawn whether or not an item fills it, so one item without a mark does not push its
       * neighbours' words out of line.
       */
      icon?: MenuIcon | undefined;
      disabled?: boolean;
      danger?: boolean;
    };

/** Where an open list hangs: pinned to the trigger, in viewport coordinates. */
type Place = { right: number; top?: number; bottom?: number };

/** Below this much room under the trigger, the list opens upward instead. */
const ROOM = 200;

/**
 * The `⋯` at the end of a panel bar or a list row, and the list it opens. One trigger, one
 * list; a choice, Escape or a click anywhere else closes it. Arrow keys walk the items, and
 * focus returns to the trigger on close so the keyboard never lands nowhere.
 *
 * The list is a portal in viewport coordinates rather than a box inside the row. A row lives in
 * a panel that scrolls and clips, and a menu that is clipped by the list it belongs to is no
 * menu at all. The cost is that the position goes stale the moment anything scrolls, so a
 * scroll closes it — the pointer is somewhere else by then anyway.
 */
export function Menu(props: {
  label: string;
  items: readonly MenuItem[];
  /** `bar` lifts on hover, the way a panel bar does; `row` darkens, the way a row's own do. */
  variant?: "bar" | "row";
}) {
  const id = createUniqueId();
  let trigger: HTMLButtonElement | undefined;
  let list: HTMLDivElement | undefined;
  const [at, setAt] = createSignal<Place | null>(null);
  const open = () => at() !== null;

  function place(): void {
    const rect = trigger?.getBoundingClientRect();
    if (rect === undefined) return;
    const right = Math.max(8, window.innerWidth - rect.right);
    // Upward when the room below runs out, so a row near the foot of a panel still opens.
    setAt(
      window.innerHeight - rect.bottom < ROOM && rect.top > ROOM
        ? { right, bottom: window.innerHeight - rect.top + 4 }
        : { right, top: rect.bottom + 4 },
    );
  }

  function close(refocus: boolean): void {
    setAt(null);
    if (refocus) trigger?.focus();
  }

  function enabledItems(): HTMLElement[] {
    return [...(list?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
  }

  createEffect(() => {
    if (!open()) return;
    queueMicrotask(() => enabledItems()[0]?.focus());
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (list?.contains(target) || trigger?.contains(target))) return;
      close(false);
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && list?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    // Captured: the panel a row sits in scrolls, and that scroll never reaches the document.
    document.addEventListener("scroll", onScroll, true);
    const handleResize = () => close(false);
    window.addEventListener("resize", handleResize);
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", handleResize);
    });
  });

  function onKeyDown(event: KeyboardEvent): void {
    const items = enabledItems();
    const focused = document.activeElement;
    const index = focused instanceof HTMLElement ? items.indexOf(focused) : -1;
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close(true);
        return;
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        return;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        return;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        return;
      case "End":
        event.preventDefault();
        items.at(-1)?.focus();
        return;
      case "Tab":
        close(false);
        return;
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={props.label}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-controls={id}
        class="rounded-app p-0.5 text-fg-muted"
        classList={{
          "hover:bg-surface-sunken hover:text-fg": props.variant === "row",
          "hover:bg-surface-raised hover:text-fg": props.variant !== "row",
        }}
        onClick={() => (open() ? close(true) : place())}
      >
        <Ellipsis size={14} aria-hidden="true" />
      </button>
      <Show when={at()}>
        {(spot) => (
          <Portal>
            <div
              ref={list}
              id={id}
              role="menu"
              aria-label={props.label}
              class="fixed z-30 max-h-[60vh] min-w-44 overflow-y-auto rounded-app border border-border bg-surface-raised py-1 shadow-2xl"
              style={{
                right: `${spot().right}px`,
                ...(spot().top === undefined
                  ? { bottom: `${spot().bottom}px` }
                  : { top: `${spot().top}px` }),
              }}
              onKeyDown={onKeyDown}
            >
              <For each={props.items}>
                {(item) => (
                  <Show
                    when={"separator" in item ? null : item}
                    fallback={<hr class="my-1 h-px border-0 bg-border" />}
                  >
                    {(action) => (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={action().disabled}
                        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg hover:bg-surface disabled:pointer-events-none disabled:opacity-40"
                        classList={{ "text-danger": action().danger }}
                        onClick={() => {
                          close(true);
                          action().onSelect();
                        }}
                      >
                        <span
                          class="inline-grid w-3.5 shrink-0 place-items-center"
                          classList={{ "text-fg-subtle": action().danger !== true }}
                        >
                          <Show when={action().icon}>
                            {(icon) => <Dynamic component={icon()} size={14} aria-hidden="true" />}
                          </Show>
                        </span>
                        <span class="truncate">{action().label}</span>
                      </button>
                    )}
                  </Show>
                )}
              </For>
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
}
