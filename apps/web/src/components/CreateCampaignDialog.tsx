import Plus from "lucide-solid/icons/plus";
import { createEffect, createSignal } from "solid-js";
import { Dialog } from "./Dialog.tsx";

export function CreateCampaignDialog(props: {
  open: boolean;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = createSignal("");
  let input: HTMLInputElement | undefined;

  createEffect(() => {
    if (!props.open) return;
    setName("");
    // showModal focuses the first control, which is the close button. The name field is the point.
    queueMicrotask(() => input?.focus());
  });

  return (
    <Dialog open={props.open} title="New campaign" onClose={props.onClose}>
      <form
        class="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          props.onCreate(name());
        }}
      >
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-fg-muted">Name</span>
          <input
            ref={input}
            value={name()}
            placeholder="Untitled campaign"
            onInput={(event) => setName(event.currentTarget.value)}
            class="rounded-xl bg-bg px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-app bg-surface-raised px-3 py-1 hover:opacity-80"
            onClick={() => props.onClose()}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="inline-flex items-center gap-1.5 rounded-app bg-accent px-3 py-1 font-medium text-accent-fg hover:opacity-90"
          >
            <Plus size={14} aria-hidden="true" />
            Create
          </button>
        </div>
      </form>
    </Dialog>
  );
}
