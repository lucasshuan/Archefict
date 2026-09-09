import { type JSX, Show } from "solid-js";
import { Menu, type MenuItem } from "./Menu.tsx";

/**
 * A region of a tab. Every region is one: the bar makes a panel recognisable as a thing that
 * can be hidden, moved and given options, which is what Slice 5's layout editor will do to
 * it (docs/workspace.md). The bar is slim on purpose — a label, the panel's one or two
 * actions, a status, and `⋯`. Panels are told apart by surface tone, never by a border; the
 * caller picks the tone with `class`.
 */
export function Panel(props: {
  title: string;
  actions?: JSX.Element;
  status?: JSX.Element;
  menu?: readonly MenuItem[];
  class?: string;
  children: JSX.Element;
}) {
  return (
    <section class={`flex min-h-0 min-w-0 flex-col ${props.class ?? ""}`} aria-label={props.title}>
      <div class="flex h-8 shrink-0 items-center gap-1 pr-1 pl-3">
        <span class="min-w-0 flex-1 truncate text-xs font-medium text-fg-muted">{props.title}</span>
        {props.actions}
        {props.status}
        <Show when={props.menu && props.menu.length > 0 ? props.menu : null}>
          {(items) => <Menu label={`${props.title} options`} items={items()} />}
        </Show>
      </div>
      <div class="flex min-h-0 flex-1 flex-col">{props.children}</div>
    </section>
  );
}

/** A small icon button for a panel bar's actions slot. */
export function PanelAction(props: { label: string; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
