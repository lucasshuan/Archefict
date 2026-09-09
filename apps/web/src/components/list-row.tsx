import { createSignal, type JSX } from "solid-js";

/**
 * The two pieces every list of named things in a panel shares — the conversations of the
 * Story tab, the folders and sheets of the Library. A row is a button; its actions hide until
 * the row is hovered or one of them is focused, except on the active row; renaming happens
 * in place.
 */

/** Hidden until the row is hovered or the action focused, except on the active row. */
export function RowAction(props: {
  label: string;
  title: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      class="mr-1 rounded-app p-1 text-fg-muted opacity-0 transition-opacity hover:bg-bg hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 group-hover:disabled:opacity-30"
      classList={{ "opacity-100": props.active }}
      aria-label={props.label}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** Enter commits, Escape cancels, blur commits. Blank titles are dropped by the store. */
export function RenameField(props: {
  value: string;
  label: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = createSignal(props.value);
  let settled = false;

  function commit(): void {
    if (settled) return;
    settled = true;
    props.onCommit(draft());
  }

  function cancel(): void {
    if (settled) return;
    settled = true;
    props.onCancel();
  }

  return (
    <input
      ref={(el) => {
        queueMicrotask(() => {
          el.focus();
          el.select();
        });
      }}
      aria-label={props.label}
      value={draft()}
      spellcheck={false}
      class="m-1 min-w-0 flex-1 rounded-app bg-bg px-2 py-1 text-sm"
      onInput={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      onBlur={commit}
    />
  );
}
