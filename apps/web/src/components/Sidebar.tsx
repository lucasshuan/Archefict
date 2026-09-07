import { createSignal, For, Show } from "solid-js";
import type { CampaignSummary } from "../campaign/store.ts";

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
  const [newName, setNewName] = createSignal("");
  const [pendingDelete, setPendingDelete] = createSignal<string | null>(null);

  function create(): void {
    props.onCreate(newName());
    setNewName("");
  }

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
          <span class="font-narrative text-lg tracking-wide">Archefict</span>
          <button
            type="button"
            class="rounded-app px-2 py-1 text-fg-muted hover:bg-surface-raised md:hidden"
            aria-label="Close menu"
            onClick={() => props.onClose()}
          >
            ×
          </button>
        </div>

        <nav class="flex min-h-0 flex-1 flex-col px-2" aria-label="Campaigns">
          <div class="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Campaigns
          </div>
          <ul class="flex-1 space-y-0.5 overflow-y-auto">
            <For each={props.campaigns}>
              {(campaign) => {
                const active = () => campaign.url === props.activeUrl;
                const confirming = () => pendingDelete() === campaign.url;
                return (
                  <li
                    class="group rounded-app"
                    classList={{ "bg-surface-raised": active() || confirming() }}
                  >
                    <Show
                      when={!confirming()}
                      fallback={
                        <div class="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                          <span class="truncate text-fg-muted">Delete for good?</span>
                          <span class="flex shrink-0 gap-1">
                            <button
                              type="button"
                              class="rounded-app bg-danger px-2 py-0.5 text-xs font-medium text-accent-fg"
                              onClick={() => {
                                setPendingDelete(null);
                                props.onDelete(campaign.url);
                              }}
                            >
                              Yes, delete
                            </button>
                            <button
                              type="button"
                              class="rounded-app border border-border px-2 py-0.5 text-xs"
                              onClick={() => setPendingDelete(null)}
                            >
                              Keep
                            </button>
                          </span>
                        </div>
                      }
                    >
                      <div class="flex items-center">
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
                          <span
                            class="h-1.5 w-1.5 shrink-0 rounded-full"
                            classList={{ "bg-accent": active(), "bg-border": !active() }}
                            aria-hidden="true"
                          />
                          <span class="truncate">{campaign.name}</span>
                        </button>
                        <button
                          type="button"
                          class="mr-1 rounded-app px-1.5 py-0.5 text-xs text-fg-muted opacity-0 hover:bg-bg hover:text-danger focus:opacity-100 group-hover:opacity-100"
                          classList={{ "opacity-100": active() }}
                          aria-label={`Delete ${campaign.name}`}
                          onClick={() => setPendingDelete(campaign.url)}
                        >
                          Delete
                        </button>
                      </div>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>

          <form
            class="mt-2 flex gap-1 px-1 pb-2"
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
          >
            <input
              aria-label="New campaign name"
              placeholder="New campaign"
              value={newName()}
              onInput={(event) => setNewName(event.currentTarget.value)}
              class="min-w-0 flex-1 rounded-app border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              class="rounded-app bg-accent px-2 py-1 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              Create
            </button>
          </form>
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
            <span aria-hidden="true">⚙</span>
            Settings
          </button>
          <div class="mt-1 flex items-center gap-3 rounded-app px-2 py-2">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg"
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
