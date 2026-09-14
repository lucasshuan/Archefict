import { For, type JSX } from "solid-js";

export type IconTab<Id extends string> = {
  id: Id;
  /** The accessible name and the tooltip. Never drawn — see below. */
  label: string;
  icon: (props: { size?: number; class?: string; "aria-hidden"?: "true" }) => JSX.Element;
};

/**
 * A row of icons that switches what a panel is listing. Icons only: three words across a 288px
 * panel would leave the list no width, and these three name kinds of thing rather than actions,
 * which is what an icon is good at. The name lives in the tooltip, the accessible name, and the
 * search box above, whose placeholder says which kind is being searched.
 *
 * The selected one takes a tone and an accent icon — the same two signals a row uses, because a
 * single one is not enough in a dark theme.
 */
export function IconTabs<Id extends string>(props: {
  label: string;
  tabs: readonly IconTab<Id>[];
  active: Id;
  /** The id of the region these swap. Each tab takes `<panelId>-tab-<id>` for its own. */
  panelId: string;
  onSelect: (id: Id) => void;
}) {
  return (
    <div class="flex items-center gap-0.5" role="tablist" aria-label={props.label}>
      <For each={props.tabs}>
        {(tab) => {
          const selected = () => tab.id === props.active;
          return (
            <button
              type="button"
              role="tab"
              id={`${props.panelId}-tab-${tab.id}`}
              aria-controls={props.panelId}
              aria-selected={selected()}
              aria-label={tab.label}
              title={tab.label}
              class="rounded-app p-1.5 transition-colors motion-reduce:transition-none"
              classList={{
                "bg-surface-raised text-accent": selected(),
                "text-fg-subtle hover:bg-surface-raised/60 hover:text-fg-muted": !selected(),
              }}
              onClick={() => props.onSelect(tab.id)}
            >
              <tab.icon size={16} aria-hidden="true" />
            </button>
          );
        }}
      </For>
    </div>
  );
}
