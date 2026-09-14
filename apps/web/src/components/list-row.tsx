import { createSignal } from "solid-js";
import { Menu, type MenuItem } from "./Menu.tsx";

/**
 * The pieces every list of named things in a panel shares — the conversations of the Story
 * tab, the folders and sheets of the Library. A row is a button, and everything that can be
 * done to it is behind one `⋯` that shows on hover; renaming happens in place.
 *
 * One `⋯` rather than a strip of icons (Sep 14, 2026). A row grew a third action and then a
 * fourth, and four icons in a 288px panel leave a name no room; more than that, the actions
 * differ per row — a folder makes things, a sheet is duplicated and archived — and a row of
 * icons that changes shape between neighbours reads as noise. A menu says the same things in
 * words, in one place, at one width, and is the keyboard's way in besides.
 */

/**
 * The mark for "this is the one you are on", wherever a list has rows: the row lifts a tone
 * and takes a hairline of accent down its left edge. Two signals rather than one, so the
 * active row survives a dim screen, and the smallest dose of accent that still reads.
 *
 * The hairline is in two halves. `ROW_RULE` goes in every row's `class`, always, and draws
 * it at rest scaled to nothing; `ROW_RULE_ACTIVE` is toggled on the row you are on and grows
 * it in. Split because a pseudo-element that only exists while active appears in one frame
 * and cannot be transitioned, and because of how Solid's `classList` works: a key that turns
 * false removes every class in it, whatever the element's own `class` says. So the active
 * half holds nothing a row needs at rest — not `relative`, not `overflow-hidden` — and a
 * caller may put anything it likes in `class` without the toggle stripping it.
 */
export const ROW_RULE =
  "relative before:pointer-events-none before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:origin-center before:scale-y-0 before:rounded-full before:bg-accent before:opacity-0 before:transition-[scale,opacity] before:duration-400 before:ease-in-out motion-reduce:before:transition-none";
export const ROW_RULE_ACTIVE = "before:scale-y-100 before:opacity-100";

/**
 * A row's `⋯`. Hidden until the row is hovered, the menu focused or the list open, except on
 * the active row, which keeps it — the row you are on is the one you act on most.
 */
export function RowMenu(props: { label: string; items: readonly MenuItem[]; active: boolean }) {
  return (
    <div
      class="mr-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100 motion-reduce:transition-none"
      classList={{ "opacity-100": props.active }}
    >
      <Menu label={props.label} items={props.items} variant="row" />
    </div>
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
      class="m-1 min-w-0 flex-1 rounded-app bg-surface-sunken px-2 py-1 text-sm"
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

/** The least a row needs to be listed under Archived. */
export type Archived = { id: string; title: string };
