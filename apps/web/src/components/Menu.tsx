import Ellipsis from "lucide-solid/icons/ellipsis";
import { createEffect, createSignal, createUniqueId, For, onCleanup, Show } from "solid-js";

export type MenuItem =
  | { separator: true }
  | { label: string; onSelect: () => void; disabled?: boolean; danger?: boolean };

/**
 * The `⋯` at the end of a panel bar, and the list it opens. One trigger, one list; a choice,
 * Escape or a click anywhere else closes it. Arrow keys walk the items, and focus returns to
 * the trigger on close so the keyboard never lands nowhere.
 */
export function Menu(props: { label: string; items: readonly MenuItem[] }) {
  const id = createUniqueId();
  let trigger: HTMLButtonElement | undefined;
  let list: HTMLDivElement | undefined;
  const [open, setOpen] = createSignal(false);

  function close(refocus: boolean): void {
    setOpen(false);
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
    document.addEventListener("pointerdown", onPointerDown);
    onCleanup(() => document.removeEventListener("pointerdown", onPointerDown));
  });

  function onKeyDown(event: KeyboardEvent): void {
    const items = enabledItems();
    const focused = document.activeElement;
    const at = focused instanceof HTMLElement ? items.indexOf(focused) : -1;
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close(true);
        return;
      case "ArrowDown":
        event.preventDefault();
        items[(at + 1) % items.length]?.focus();
        return;
      case "ArrowUp":
        event.preventDefault();
        items[(at - 1 + items.length) % items.length]?.focus();
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
    <div class="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={props.label}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-controls={id}
        class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
        onClick={() => (open() ? close(true) : setOpen(true))}
      >
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      <Show when={open()}>
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={props.label}
          class="absolute top-full right-0 z-30 mt-1 min-w-44 rounded-app border border-border bg-surface-raised py-1 shadow-2xl"
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
                    class="flex w-full items-center px-3 py-1.5 text-left text-sm text-fg hover:bg-surface disabled:pointer-events-none disabled:opacity-40"
                    classList={{ "text-danger": action().danger }}
                    onClick={() => {
                      close(true);
                      action().onSelect();
                    }}
                  >
                    {action().label}
                  </button>
                )}
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
