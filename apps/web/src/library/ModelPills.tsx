import type { SheetSummary } from "@archefict/schema";
import Diamond from "lucide-solid/icons/diamond";
import Plus from "lucide-solid/icons/plus";
import X from "lucide-solid/icons/x";
import { createSignal, For, Show } from "solid-js";
import { Popover } from "./FieldValue.tsx";

/**
 * Under a sheet's title: the models it takes, one pill each (docs/sheets.md). Press a pill to
 * open the model, its × to drop it — the values stay, only the claim goes. `+ model` lists
 * the models not yet taken and offers a new one. A model shows a single pill saying so.
 */
export function ModelPills(props: {
  summary: SheetSummary;
  models: readonly SheetSummary[];
  onTake: (id: string) => void;
  onDrop: (id: string) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  let addButton: HTMLButtonElement | undefined;
  const [open, setOpen] = createSignal(false);
  const taken = () => props.summary.models ?? [];
  const titleOf = (id: string) => props.models.find((model) => model.id === id)?.title ?? null;
  const available = () => props.models.filter((model) => !taken().includes(model.id));

  return (
    <Show
      when={props.summary.kind !== "model"}
      fallback={
        <section class="min-w-0 overflow-x-auto" aria-label="Model information">
          <div class="flex w-max min-w-full items-center justify-end gap-2 whitespace-nowrap text-xs text-fg-subtle">
            <span class="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-0.5 text-[12.5px] text-accent">
              <Diamond size={11} aria-hidden="true" />
              Model
            </span>
            Sheets that take this model get its fields, with their types, and its body as a start.
          </div>
        </section>
      }
    >
      <section class="min-w-0 overflow-x-auto" aria-label="Models this sheet takes">
        <div class="flex w-max min-w-full items-center justify-end gap-1.5 whitespace-nowrap">
          <For each={taken()}>
            {(id) => (
              <span class="inline-flex items-center gap-0.5 rounded-full bg-surface-raised pr-1 pl-2.5 text-[12.5px] text-fg">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 py-0.5"
                  title={titleOf(id) ? `Open ${titleOf(id)}` : "This model no longer exists"}
                  onClick={() => {
                    if (titleOf(id)) props.onOpen(id);
                  }}
                >
                  <Diamond size={11} aria-hidden="true" class="text-fg-subtle" />
                  <span classList={{ "text-fg-subtle italic": titleOf(id) === null }}>
                    {titleOf(id) ?? "missing model"}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Drop ${titleOf(id) ?? "this model"}`}
                  title="Drop — the values stay"
                  class="rounded-full p-0.5 text-fg-subtle hover:text-danger"
                  onClick={() => props.onDrop(id)}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            )}
          </For>
          <button
            ref={addButton}
            type="button"
            class="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[12.5px] text-fg-subtle hover:border-fg-subtle hover:text-fg-muted"
            onClick={() => setOpen(true)}
          >
            <Plus size={11} aria-hidden="true" />
            model
          </button>
          <Show when={open() && addButton}>
            {(anchor) => (
              <Popover anchor={anchor()} onClose={() => setOpen(false)} label="Take a model">
                <div class="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
                  Take a model
                </div>
                <Show
                  when={available().length > 0}
                  fallback={
                    <p class="px-3 py-1.5 text-xs text-fg-subtle">
                      {props.models.length === 0 ? "No models yet." : "Every model is taken."}
                    </p>
                  }
                >
                  <For each={available()}>
                    {(model) => (
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg-muted hover:bg-surface hover:text-fg"
                        onClick={() => {
                          props.onTake(model.id);
                          setOpen(false);
                        }}
                      >
                        <Diamond size={12} aria-hidden="true" class="text-fg-subtle" />
                        <span class="truncate">{model.title}</span>
                      </button>
                    )}
                  </For>
                </Show>
                <button
                  type="button"
                  class="mt-1 flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-sm text-fg-muted italic hover:bg-surface hover:text-fg"
                  onClick={() => {
                    setOpen(false);
                    props.onCreate();
                  }}
                >
                  <span class="w-3 text-center not-italic">+</span>
                  New model…
                </button>
              </Popover>
            )}
          </Show>
        </div>
      </section>
    </Show>
  );
}
