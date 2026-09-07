import Trash2 from "lucide-solid/icons/trash-2";
import { createEffect } from "solid-js";
import { Dialog } from "./Dialog.tsx";

/** A destructive confirmation. Cancel takes focus by default so Enter never destroys anything by accident. */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  let cancel: HTMLButtonElement | undefined;

  createEffect(() => {
    if (props.open) queueMicrotask(() => cancel?.focus());
  });

  return (
    <Dialog open={props.open} title={props.title} onClose={props.onClose}>
      <p class="text-sm text-fg-muted">{props.message}</p>
      <div class="flex justify-end gap-2">
        <button
          ref={cancel}
          type="button"
          class="rounded-app bg-surface-raised px-3 py-1 hover:opacity-80"
          onClick={() => props.onClose()}
        >
          Cancel
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-app bg-danger px-3 py-1 font-medium text-danger-fg hover:opacity-90"
          onClick={() => props.onConfirm()}
        >
          <Trash2 size={14} aria-hidden="true" />
          {props.confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
