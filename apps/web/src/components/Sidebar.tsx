import PanelLeftClose from "lucide-solid/icons/panel-left-close";
import PanelLeftOpen from "lucide-solid/icons/panel-left-open";
import Plus from "lucide-solid/icons/plus";
import Settings from "lucide-solid/icons/settings";
import { createSignal, For, Show } from "solid-js";
import type { CampaignSummary } from "../campaign/store.ts";
import { CampaignCover } from "./CampaignCover.tsx";
import { CreateCampaignDialog } from "./CreateCampaignDialog.tsx";
import { createRailTooltip, RailShowButton } from "./rail.tsx";

export type MockUser = {
  name: string;
  status: string;
};

/** Stands in for the account until auth arrives (ROADMAP Slice 11). */
export const GUEST: MockUser = {
  name: "Guest player",
  status: "Local only · not signed in",
};

/**
 * The shell's own sidebar: campaigns, settings, the account. It is a rail — one column of
 * covers with the app's two other destinations at its foot, every one of them a picture or
 * an icon with its name in a tooltip — and there is no wider form with labels: the covers
 * are the labels. It hides to nothing. Hidden, the workspace has the whole width, and the
 * one thing left of the rail is a faint button at the page's corner to bring it back.
 */
export function Sidebar(props: {
  campaigns: readonly CampaignSummary[];
  activeUrl: string | null;
  /** The settings page is open, so no campaign is the current one. */
  settingsActive: boolean;
  user: MockUser;
  open: boolean;
  onSelect: (url: string) => void;
  onCreate: (name: string) => void;
  onOpenSettings: () => void;
  onToggle: () => void;
}) {
  const [creating, setCreating] = createSignal(false);
  const tooltip = createRailTooltip("left");

  return (
    <>
      <aside
        id="campaign-sidebar"
        aria-label="Campaign sidebar"
        class="flex shrink-0 flex-col overflow-hidden bg-bg transition-[width] duration-200 ease-out motion-reduce:transition-none"
        classList={{ "w-14 border-r border-border/50": props.open, "w-0": !props.open }}
      >
        {/* Everything inside is laid out for the rail's own width and never re-measures:
            hiding only takes the aside to zero and clips, so the rail slides out under the
            clip rather than reflowing on the way, and nothing re-anchors while it animates. */}
        <header class="flex h-12 w-14 shrink-0 items-center justify-center">
          <button
            type="button"
            class="rounded-app p-1.5 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg motion-reduce:transition-none"
            aria-label="Hide campaign sidebar"
            aria-controls="campaign-sidebar"
            aria-expanded={props.open}
            {...tooltip.on(() => "Hide campaign sidebar")}
            onClick={() => props.onToggle()}
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        </header>

        <nav class="flex min-h-0 w-14 flex-1 flex-col px-2" aria-label="Campaigns">
          <div class="flex justify-center pb-1">
            <button
              type="button"
              class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
              aria-label="New campaign"
              {...tooltip.on(() => "New campaign")}
              onClick={() => setCreating(true)}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          {/* Cards in a column, not rows: a campaign is a place, and its picture tells it
              from the others faster than its name does — a shelf of covers to pick from
              rather than a list to read down. */}
          {/* `-mx-2 px-2`: the list reaches the rail's edge and pads itself back, so the
              pill each card hangs in the gutter is inside the list's own box. Left in the
              nav's padding instead, it would be outside the list, and a list that scrolls
              clips what is outside it. */}
          <ul
            class="-mx-2 grid flex-1 content-start gap-2 overflow-y-auto px-2"
            onScroll={tooltip.hide}
          >
            <For each={props.campaigns}>
              {(campaign) => {
                const active = () => campaign.url === props.activeUrl;
                let picture!: HTMLSpanElement;
                // Named by its picture rather than by the row: the pill in the gutter is part
                // of the row, and a tooltip beside the pill would float off the card.
                const show = () => tooltip.show(picture, campaign.name);
                return (
                  <li
                    class="group relative"
                    onMouseEnter={show}
                    onMouseLeave={tooltip.hide}
                    onFocusIn={show}
                    onFocusOut={tooltip.hide}
                  >
                    {/* The pill: the accent at the rail's edge, tall for the current
                        campaign and short for the one under the pointer, the way a rail of
                        avatars does it. It hangs in the gutter outside the picture, so it is
                        a state of the card and never a frame on the picture. */}
                    <span
                      class="pointer-events-none absolute inset-x-0 top-0 aspect-square"
                      aria-hidden="true"
                    >
                      <span
                        // Scaled, not resized: `scale` and `opacity` animate on the
                        // compositor, so the pill glides while the picture beside it is busy
                        // re-filtering. A height transition lays out every frame and stutters
                        // under that load. Tailwind v4 sets the `scale` property, not
                        // `transform`, so that is what the transition names.
                        class="absolute top-1/2 -left-2 h-8 w-1 origin-center -translate-y-1/2 rounded-r-full bg-accent transition-[scale,opacity] duration-400 ease-in-out motion-reduce:transition-none"
                        classList={{
                          "scale-y-100 opacity-100": active(),
                          "scale-y-0 opacity-0 group-hover:scale-y-50 group-hover:opacity-100 group-focus-within:scale-y-50 group-focus-within:opacity-100":
                            !active(),
                        }}
                      />
                    </span>
                    <button
                      type="button"
                      class="block w-full overflow-hidden rounded-lg"
                      aria-current={active() ? "page" : undefined}
                      // The card is only a picture, so the name is given outright.
                      aria-label={campaign.name}
                      onClick={() => {
                        tooltip.hide();
                        props.onSelect(campaign.url);
                      }}
                    >
                      {/* The current campaign is marked by being the only one at full
                          strength: the rest sit back — darker, flatter, colour half drained —
                          and lift partway towards it on hover. Filters, not opacity: opacity
                          over the ground darkens a cover but leaves it as saturated and as
                          contrasty as the current one, so a shelf of bright covers still
                          shouts; pulling saturation and contrast is what makes the rest
                          recede. Works the same whether the cover is a drawing or a photo. */}
                      <span
                        ref={picture}
                        class="block aspect-square w-full transition-[filter] duration-400 ease-in-out motion-reduce:transition-none"
                        classList={{
                          "brightness-100 contrast-100 saturate-100": active(),
                          "brightness-30 contrast-80 saturate-50 group-hover:brightness-60 group-hover:contrast-95 group-hover:saturate-75":
                            !active(),
                        }}
                      >
                        <CampaignCover src={campaign.cover} seed={campaign.url} />
                      </span>
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
        </nav>

        <div class="flex w-14 flex-col items-center gap-1 p-2">
          <button
            type="button"
            class="flex h-9 w-10 items-center justify-center rounded-app transition-colors hover:bg-surface-raised hover:text-fg motion-reduce:transition-none"
            classList={{
              "bg-surface-raised text-fg": props.settingsActive,
              "text-fg-muted": !props.settingsActive,
            }}
            aria-current={props.settingsActive ? "page" : undefined}
            aria-label="Settings"
            {...tooltip.on(() => "Settings")}
            onClick={() => props.onOpenSettings()}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          <div
            class="flex h-10 w-10 items-center justify-center"
            {...tooltip.on(() => `${props.user.name} · ${props.user.status}`)}
          >
            <span
              role="img"
              class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
              aria-label={props.user.name}
            >
              {initials(props.user.name)}
            </span>
          </div>
        </div>
      </aside>

      <Show when={!props.open}>
        <RailShowButton
          rail="left"
          label="Show campaign sidebar"
          controls="campaign-sidebar"
          tooltip={tooltip}
          onClick={() => props.onToggle()}
        >
          <PanelLeftOpen size={16} aria-hidden="true" />
        </RailShowButton>
      </Show>

      {tooltip.view()}

      <CreateCampaignDialog
        open={creating()}
        onCreate={(name) => {
          setCreating(false);
          props.onCreate(name);
        }}
        onClose={() => setCreating(false)}
      />
    </>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
