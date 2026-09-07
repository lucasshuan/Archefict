import BookOpen from "lucide-solid/icons/book-open";
import Plus from "lucide-solid/icons/plus";
import Settings from "lucide-solid/icons/settings";
import Swords from "lucide-solid/icons/swords";
import Trash2 from "lucide-solid/icons/trash-2";
import X from "lucide-solid/icons/x";
import { createSignal, For, Show } from "solid-js";
import type { CampaignSummary } from "../campaign/store.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { CreateCampaignDialog } from "./CreateCampaignDialog.tsx";

export type MockUser = {
  name: string;
  status: string;
};

/** Stands in for the account until auth arrives (ROADMAP Slice 11). */
export const GUEST: MockUser = { name: "Guest player", status: "Local only · not signed in" };

export function Sidebar(props: {
  campaigns: readonly CampaignSummary[];
  activeUrl: string | null;
  user: MockUser;
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  onCreate: (name: string) => void;
  onDelete: (url: string) => void;
  onOpenSettings: () => void;
}) {
  const [creating, setCreating] = createSignal(false);
  const [pendingDelete, setPendingDelete] = createSignal<CampaignSummary | null>(null);

  return (
    <>
      <Show when={props.open}>
        <button
          type="button"
          aria-label="Close menu"
          class="fixed inset-0 z-10 bg-bg/70 md:hidden"
          onClick={() => props.onClose()}
        />
      </Show>
      <aside
        aria-label="Sidebar"
        class="fixed inset-y-0 left-0 z-20 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0"
        classList={{ "-translate-x-full": !props.open }}
      >
        <div class="flex items-center justify-between px-4 py-3">
          <span class="flex items-center gap-2 font-narrative text-lg tracking-wide">
            <Swords size={18} class="text-accent" aria-hidden="true" />
            Archefict
          </span>
          <button
            type="button"
            class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg md:hidden"
            aria-label="Close menu"
            onClick={() => props.onClose()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav class="flex min-h-0 flex-1 flex-col px-2" aria-label="Campaigns">
          <div class="flex items-center justify-between px-2 pb-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Campaigns
            </span>
            <button
              type="button"
              class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
              aria-label="New campaign"
              title="New campaign"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <ul class="flex-1 space-y-0.5 overflow-y-auto">
            <For each={props.campaigns}>
              {(campaign) => {
                const active = () => campaign.url === props.activeUrl;
                return (
                  <li
                    class="group flex items-center rounded-app"
                    classList={{ "bg-surface-raised": active() }}
                  >
                    <button
                      type="button"
                      class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm hover:text-fg"
                      classList={{ "text-fg": active(), "text-fg-muted": !active() }}
                      aria-current={active() ? "page" : undefined}
                      onClick={() => {
                        props.onSelect(campaign.url);
                        props.onClose();
                      }}
                    >
                      <BookOpen
                        size={14}
                        class="shrink-0"
                        classList={{ "text-accent": active() }}
                        aria-hidden="true"
                      />
                      <span class="truncate">{campaign.name}</span>
                    </button>
                    <button
                      type="button"
                      class="mr-1 rounded-app p-1 text-fg-muted opacity-0 transition-opacity hover:bg-bg hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      classList={{ "opacity-100": active() }}
                      aria-label={`Delete ${campaign.name}`}
                      title="Delete campaign"
                      onClick={() => setPendingDelete(campaign)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
        </nav>

        <div class="border-t border-border p-2">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-app px-2 py-1.5 text-left text-sm text-fg-muted hover:bg-surface-raised hover:text-fg"
            onClick={() => {
              props.onOpenSettings();
              props.onClose();
            }}
          >
            <Settings size={16} aria-hidden="true" />
            Settings
          </button>
          <div class="mt-1 flex items-center gap-3 rounded-app px-2 py-2">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
              aria-hidden="true"
            >
              {initials(props.user.name)}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm">{props.user.name}</span>
              <span class="block truncate text-xs text-fg-muted">{props.user.status}</span>
            </span>
          </div>
        </div>
      </aside>

      <CreateCampaignDialog
        open={creating()}
        onCreate={(name) => {
          setCreating(false);
          props.onCreate(name);
          props.onClose();
        }}
        onClose={() => setCreating(false)}
      />
      <ConfirmDialog
        open={pendingDelete() !== null}
        title="Delete campaign"
        message={`Delete "${pendingDelete()?.name ?? ""}" and everything in it? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          const target = pendingDelete();
          setPendingDelete(null);
          if (target) props.onDelete(target.url);
        }}
        onClose={() => setPendingDelete(null)}
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
