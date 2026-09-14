import PanelRightClose from "lucide-solid/icons/panel-right-close";
import PanelRightOpen from "lucide-solid/icons/panel-right-open";
import Settings from "lucide-solid/icons/settings";
import { For, type JSX, Show } from "solid-js";
import { CampaignCover } from "./CampaignCover.tsx";
import { ROW_RULE, ROW_RULE_ACTIVE } from "./list-row.tsx";
import { createRailTooltip, RailShowButton } from "./rail.tsx";

export type Tab<Id extends string> = {
  id: Id;
  label: string;
  icon: (props: { size?: number; class?: string; "aria-hidden"?: "true" }) => JSX.Element;
};

/**
 * A campaign's navigation is its right sidebar, a rail: the campaign's cover at the top,
 * edge to edge, and the working views under it as icons. There is no wider form with labels.
 * The cover is the way into Campaign Settings — the thing you press to change the campaign
 * is the picture of it, not a row filed among the working views — and the campaign's name
 * is in the cover's tooltip and in Campaign Settings, where it is changed. So the workspace
 * needs no title bar of its own and the panels start at the top of the page. Story and
 * Library are the working views. Each tab, the cover included, labels its panel with its id
 * (`tabpanel-<id>`).
 *
 * It hides to nothing. Hidden, the workspace has the whole width, and the one thing left of
 * the rail is a faint button at the page's corner to bring it back.
 */
export function CampaignSidebar<Id extends string>(props: {
  tabs: readonly Tab<Id>[];
  active: Id;
  expanded: boolean;
  /** The campaign's name: the cover's tooltip. */
  title: string;
  /** The campaign's chosen picture. Absent: the cover draws the placeholder. */
  cover?: string | undefined;
  /** Identifies the campaign, so its placeholder cover keeps the colour its card has. */
  seed: string;
  /** The tab the cover opens: the campaign's own settings. */
  settingsTab: Id;
  onSelect: (id: Id) => void;
  onToggle: () => void;
  class?: string;
}) {
  const settingsSelected = () => props.active === props.settingsTab;
  const tooltip = createRailTooltip("right");

  return (
    <>
      <aside
        id="campaign-navigation"
        class={`relative flex shrink-0 flex-col overflow-hidden bg-bg transition-[width] duration-200 ease-out motion-reduce:transition-none ${props.class ?? ""}`}
        classList={{ "w-14 border-l border-border/50": props.expanded, "w-0": !props.expanded }}
        aria-label="Campaign navigation"
      >
        {/* Everything inside is laid out for the rail's own width and anchored to its left
            edge, the toggle's slot included, so hiding slides the whole rail out to the right
            under the clip rather than reflowing it on the way.

            The toggle is pinned to the rail's top corner, over the cover: there is no header
            row, the cover fills the top, and the list below leaves the slot's height clear.
            The scrim under it is because it lies on a picture that can be any colour, and the
            icon has to be read on all of them. */}
        <div class="absolute top-0 left-0 z-10 flex h-12 w-14 items-center justify-center">
          <button
            type="button"
            class="shrink-0 rounded-app bg-bg/70 p-1.5 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg motion-reduce:transition-none"
            aria-label="Hide campaign navigation"
            aria-controls="campaign-navigation"
            aria-expanded={props.expanded}
            {...tooltip.on(() => "Hide campaign navigation")}
            onClick={props.onToggle}
          >
            <PanelRightClose size={18} aria-hidden="true" />
          </button>
        </div>
        <div
          class="flex min-h-0 w-14 flex-1 flex-col pt-12 pb-2"
          role="tablist"
          aria-label="Campaign tabs"
          aria-orientation="vertical"
        >
          {/* The cover is a tab like the others — same tablist, same arrow keys — it just
              wears a picture instead of an icon. It is the one thing here with no gutter: a
              picture framed inside the rail reads as a thumbnail, and one that fills it reads
              as the campaign's. Selected, it takes the same inner-edge accent rule a row does. */}
          <div role="presentation" class="mb-1 border-b border-border/50 pb-2">
            <button
              type="button"
              role="tab"
              id={`tab-${props.settingsTab}`}
              aria-selected={settingsSelected()}
              aria-controls={`tabpanel-${props.settingsTab}`}
              aria-label="Campaign settings"
              class={`group/cover block aspect-square w-full overflow-hidden bg-surface ${ROW_RULE}`}
              classList={{ [ROW_RULE_ACTIVE]: settingsSelected() }}
              {...tooltip.on(() => `${props.title} — campaign settings`)}
              onClick={() => props.onSelect(props.settingsTab)}
            >
              <CampaignCover src={props.cover} seed={props.seed} />
              {/* Only on hover: the cover's job is to show the campaign, and a gear parked on
                  top of it at all times would be the only thing anyone ever sees. */}
              <span
                class="absolute inset-0 flex items-center justify-center bg-bg/75 text-fg opacity-0 transition-opacity group-hover/cover:opacity-100 group-focus-visible/cover:opacity-100 motion-reduce:transition-none"
                aria-hidden="true"
              >
                <Settings
                  size={16}
                  class={`transition-colors duration-300 ease-in-out motion-reduce:transition-none ${settingsSelected() ? "text-accent" : ""}`}
                />
              </span>
            </button>
          </div>

          <div role="presentation" class="flex flex-col gap-1 px-2">
            <For each={props.tabs}>
              {(tab) => {
                const selected = () => tab.id === props.active;
                return (
                  <div role="presentation">
                    <button
                      type="button"
                      role="tab"
                      id={`tab-${tab.id}`}
                      aria-selected={selected()}
                      aria-controls={`tabpanel-${tab.id}`}
                      aria-label={tab.label}
                      class={`flex w-full items-center justify-center rounded-lg py-2.5 transition-colors duration-300 ease-in-out motion-reduce:transition-none ${ROW_RULE}`}
                      classList={{
                        [`bg-surface-raised text-fg ${ROW_RULE_ACTIVE}`]: selected(),
                        "text-fg-muted hover:bg-surface hover:text-fg": !selected(),
                      }}
                      {...tooltip.on(() => tab.label)}
                      onClick={() => props.onSelect(tab.id)}
                    >
                      <tab.icon
                        size={16}
                        class={`transition-colors duration-300 ease-in-out motion-reduce:transition-none ${selected() ? "text-accent" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </aside>

      <Show when={!props.expanded}>
        <RailShowButton
          rail="right"
          label="Show campaign navigation"
          controls="campaign-navigation"
          tooltip={tooltip}
          onClick={props.onToggle}
        >
          <PanelRightOpen size={16} aria-hidden="true" />
        </RailShowButton>
      </Show>

      {tooltip.view()}
    </>
  );
}
