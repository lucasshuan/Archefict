import { For, type JSX } from "solid-js";

export type Tab<Id extends string> = {
  id: Id;
  label: string;
  icon: (props: { size?: number; class?: string; "aria-hidden"?: "true" }) => JSX.Element;
};

/**
 * The campaign's tabs: icons only, at the right end of the top bar, where they keep one
 * position however long the editable title beside them grows. The selected one takes the
 * accent — the same meaning the sidebar gives its active item. Each tab labels the panel
 * with its id (`tabpanel-<id>`), which the caller renders.
 */
export function TabBar<Id extends string>(props: {
  tabs: readonly Tab<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
  class?: string;
}) {
  return (
    <div
      class={`flex items-center gap-0.5 ${props.class ?? ""}`}
      role="tablist"
      aria-label="Campaign tabs"
    >
      <For each={props.tabs}>
        {(tab) => {
          const selected = () => tab.id === props.active;
          return (
            <button
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected()}
              aria-controls={`tabpanel-${tab.id}`}
              aria-label={tab.label}
              title={tab.label}
              class="rounded-app p-1.5 transition-colors"
              classList={{
                "bg-surface-raised text-accent": selected(),
                "text-fg-muted hover:bg-surface-raised hover:text-fg": !selected(),
              }}
              onClick={() => props.onSelect(tab.id)}
            >
              <tab.icon size={18} aria-hidden="true" />
            </button>
          );
        }}
      </For>
    </div>
  );
}
