import type { JSX } from "solid-js";

/**
 * A named group inside a panel, and the home of that group's actions.
 *
 * The bar above says which panel this is and what may be done to the panel itself — hide it,
 * move it. What can be *made* belongs to the thing being listed, not to the frame around it,
 * so *new sheet* and *new folder* sit on the section that holds the sheets. A panel can then
 * grow a second group later without its bar growing a second set of buttons.
 *
 * Actions stay hidden until the section is hovered or one of them is focused, the way a row
 * reveals rename and archive. Every one of them is also in the panel's `⋯`, which is where a
 * person who has never hovered finds out they exist.
 */
export function PanelSection(props: {
  label: string;
  actions?: JSX.Element;
  /** Keeps the section from taking the whole panel when another group sits under it. */
  class?: string;
  children: JSX.Element;
}) {
  return (
    <section
      class={`group/section flex min-h-0 flex-col pt-2 ${props.class ?? "flex-1"}`}
      aria-label={props.label}
    >
      <div class="flex h-6 shrink-0 items-center gap-0.5 pr-2 pl-4">
        <h2 class="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
          {props.label}
        </h2>
        {props.actions}
      </div>
      <div class="flex min-h-0 flex-1 flex-col">{props.children}</div>
    </section>
  );
}

/** An icon button for a section header: hidden until the section is hovered or it is focused. */
export function SectionAction(props: {
  label: string;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      class="rounded-app p-1 text-fg-muted opacity-0 transition-opacity hover:bg-surface-raised hover:text-fg focus-visible:opacity-100 group-hover/section:opacity-100 motion-reduce:transition-none"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
