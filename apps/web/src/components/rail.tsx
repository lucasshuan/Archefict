import { createEffect, createSignal, type JSX, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";

/**
 * What the two rails share: the tooltip every control in a rail names itself with, and the
 * button a hidden rail leaves behind.
 */

/** Which edge of the page a rail stands on. */
export type RailSide = "left" | "right";

type Tip = { text: string; x: number; y: number };

/**
 * A rail's tooltip: the name of the thing under the pointer or focus, beside it, on the side
 * away from the page's edge — a rail of pictures and icons has nowhere inside it to put a
 * name. Fixed, through a portal, because a rail clips its overflow to animate its width.
 * Never the browser's `title` bubble, which arrives late and in the browser's own dress.
 *
 * One per rail. `on(text)` is spread onto a control to name it; `show`/`hide` are for the
 * case where the thing that is hovered and the thing the tooltip sits beside differ.
 */
export function createRailTooltip(rail: RailSide) {
  const [tip, setTip] = createSignal<Tip | null>(null);

  const show = (anchor: HTMLElement, text: string): void => {
    const rect = anchor.getBoundingClientRect();
    setTip({
      text,
      x: rail === "left" ? rect.right + 8 : rect.left - 8,
      y: rect.top + rect.height / 2,
    });
  };
  const hide = (): void => {
    setTip(null);
  };

  const on = (text: () => string) => ({
    onMouseEnter: (event: MouseEvent) => show(event.currentTarget as HTMLElement, text()),
    onMouseLeave: hide,
    onFocusIn: (event: FocusEvent) => show(event.currentTarget as HTMLElement, text()),
    onFocusOut: hide,
  });

  const view = (): JSX.Element => (
    <Portal>
      <Show when={tip()}>
        {(current) => (
          <div
            role="tooltip"
            class="pointer-events-none fixed z-30 max-w-64 -translate-y-1/2 wrap-break-word rounded-lg bg-surface-raised px-2.5 py-1.5 text-xs text-fg shadow-lg"
            classList={{ "-translate-x-full": rail === "right" }}
            style={{ left: `${current().x}px`, top: `${current().y}px` }}
          >
            {current().text}
          </div>
        )}
      </Show>
    </Portal>
  );

  return { show, hide, on, view };
}

export type RailTooltip = ReturnType<typeof createRailTooltip>;

/**
 * How close to the page's edge the pointer has to come, in px, for a hidden rail's show
 * button to reveal itself.
 */
const EDGE = 40;

/**
 * The way back to a hidden rail: a tab stuck to that side's edge at the top corner, part of
 * its length outside the screen, the icon on the part inside. At rest it is a translucent
 * bare icon — no ground, no border — and when the pointer comes near that edge it takes a
 * scrim and a border and reads as the tab it is. Keyboard focus reveals it the same way.
 * Fixed, because the rail it stands in for has gone to zero width and has no corner of its
 * own to hold it.
 *
 * Nearness is read from the pointer's position, not from a hover zone: a zone would sit over
 * the workspace's edge and take its clicks.
 */
export function RailShowButton(props: {
  rail: RailSide;
  label: string;
  /** The id of the rail this reveals, for `aria-controls`. */
  controls?: string | undefined;
  tooltip: RailTooltip;
  onClick: () => void;
  children: JSX.Element;
}) {
  const [near, setNear] = createSignal(false);

  createEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const distance = props.rail === "left" ? event.clientX : window.innerWidth - event.clientX;
      setNear(distance <= EDGE);
    };
    const onLeave = (): void => {
      setNear(false);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    onCleanup(() => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    });
  });

  return (
    <button
      type="button"
      // 12px of the tab is outside the screen; the padding on that side is what puts the
      // icon on the part inside. Rounded and bordered only on the sides that are on screen.
      class="fixed top-2 z-20 border py-1.5 transition-[opacity,background-color,border-color,color] duration-300 ease-out focus-visible:border-border/50 focus-visible:bg-surface/80 focus-visible:text-fg focus-visible:opacity-100 motion-reduce:transition-none"
      classList={{
        "-left-3 rounded-r-app border-l-0 pr-1.5 pl-4": props.rail === "left",
        "-right-3 rounded-l-app border-r-0 pl-1.5 pr-4": props.rail === "right",
        "border-transparent bg-transparent text-fg-muted opacity-40": !near(),
        "border-border/50 bg-surface/80 text-fg opacity-100 shadow-sm backdrop-blur-sm": near(),
      }}
      aria-label={props.label}
      aria-controls={props.controls}
      aria-expanded={false}
      {...props.tooltip.on(() => props.label)}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}
