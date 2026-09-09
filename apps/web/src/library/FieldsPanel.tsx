import { removeSheetField, type SheetHandles, setSheetField } from "@archefict/crdt";
import X from "lucide-solid/icons/x";
import { For, Show } from "solid-js";
import { createDocSignal } from "../campaign/doc-signal.ts";
import { CONTROL } from "../components/control.ts";
import { Panel } from "../components/Panel.tsx";

/**
 * A sheet's fields: the structured half, in its own panel so it can be hidden or docked
 * elsewhere without touching the body. Keys are set once; values are written as text diffs on
 * every keystroke, so two devices editing one value merge rather than one losing.
 */
export function FieldsPanel(props: { sheet: SheetHandles }) {
  const doc = createDocSignal(props.sheet.doc);
  const entries = () => Object.entries(doc().fields).sort(([a], [b]) => a.localeCompare(b));

  function write(key: string, value: string): void {
    setSheetField(props.sheet.doc, key, value);
    void props.sheet.flush();
  }

  function remove(key: string): void {
    removeSheetField(props.sheet.doc, key);
    void props.sheet.flush();
  }

  return (
    <Panel title="Fields" class="w-72 shrink-0 bg-surface">
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        <Show when={entries().length === 0}>
          <p class="py-2 text-sm text-fg-subtle">No fields yet.</p>
        </Show>
        <ul class="flex flex-col gap-1.5">
          <For each={entries()}>
            {([key, value]) => (
              <li class="group grid grid-cols-[6rem_1fr_auto] items-center gap-1.5">
                <span class="truncate font-mono text-xs text-fg-muted" title={key}>
                  {key}
                </span>
                <input
                  aria-label={`${key} value`}
                  value={value}
                  class={`${CONTROL} min-w-0 py-1 text-sm`}
                  onInput={(event) => write(key, event.currentTarget.value)}
                />
                <button
                  type="button"
                  aria-label={`Remove ${key}`}
                  title="Remove field"
                  class="rounded-app p-1 text-fg-subtle opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => remove(key)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            )}
          </For>
        </ul>
        <form
          class="grid grid-cols-[6rem_1fr_auto] items-center gap-1.5 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const key = String(data.get("key") ?? "").trim();
            if (key === "") return;
            write(key, String(data.get("value") ?? ""));
            form.reset();
            form.querySelector<HTMLInputElement>('input[name="key"]')?.focus();
          }}
        >
          <input
            name="key"
            placeholder="key"
            aria-label="New field key"
            autocomplete="off"
            spellcheck={false}
            class={`${CONTROL} min-w-0 py-1 font-mono text-xs`}
          />
          <input
            name="value"
            placeholder="value"
            aria-label="New field value"
            autocomplete="off"
            class={`${CONTROL} min-w-0 py-1 text-sm`}
          />
          <button
            type="submit"
            class="rounded-app bg-surface-raised px-2 py-1 text-sm text-fg-muted hover:text-fg"
          >
            Add
          </button>
        </form>
      </div>
    </Panel>
  );
}
