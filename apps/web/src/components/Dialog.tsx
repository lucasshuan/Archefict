import X from "lucide-solid/icons/x";
import { createEffect, type JSX } from "solid-js";

/**
 * A native <dialog> driven by an `open` prop. Escape, the close button and the
 * backdrop all go through `onClose`; the parent owns the state.
 */
export function Dialog(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: JSX.Element;
}) {
  let dialog: HTMLDialogElement | undefined;

  createEffect(() => {
    if (!dialog) return;
    if (props.open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape already closes a native <dialog>; the click handler only maps backdrop clicks to onClose.
    <dialog
      ref={dialog}
      class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-fg shadow-2xl"
      aria-label={props.title}
      onClose={() => props.onClose()}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself, not on its content.
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div class="flex flex-col gap-4 p-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">{props.title}</h2>
          <button
            type="button"
            class="rounded-app p-1 text-fg-muted hover:bg-surface-raised hover:text-fg"
            aria-label="Close"
            onClick={() => props.onClose()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {props.children}
      </div>
    </dialog>
  );
}
