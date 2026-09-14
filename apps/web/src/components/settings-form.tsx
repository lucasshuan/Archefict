import Info from "lucide-solid/icons/info";
import { createUniqueId, type JSX, Show } from "solid-js";

/**
 * A titled group of fields, as a panel raised off the page.
 *
 * Tone alone lifts it off the page — no border, no rule, no icon. An icon, small caps,
 * letter-spacing and a hairline were four marks for one level, and none of them was size or
 * weight, the two the eye reads first. So the heading simply outranks its labels, a step
 * larger and at full brightness against their muted tone, and the controls inside drop back
 * to the page ground: wells cut into the panel, and the contrast that keeps its shape
 * readable without an edge drawn around it.
 *
 * `action` is what may be done to the whole group — sitting on the heading row, always shown.
 * Settings are not a list of rows, so there is no `⋯` and nothing waits for a hover here.
 */
export function Section(props: { title: string; action?: JSX.Element; children: JSX.Element }) {
  const heading = createUniqueId();
  return (
    <section class="flex flex-col gap-5 rounded-app bg-surface p-5" aria-labelledby={heading}>
      <div class="flex items-center gap-3">
        <h2 id={heading} class="min-w-0 flex-1 text-[15px] font-semibold text-fg">
          {props.title}
        </h2>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

/**
 * Label plus an info badge. The explanation lives in the badge tooltip rather than under
 * the control, so a page of many settings stays scannable. Hovering the label or the badge
 * shows it, and focusing the badge shows it for the keyboard.
 */
export function FieldLabel(props: { control: string; label: string; hint: string }) {
  const tip = createUniqueId();

  return (
    <div class="group/tip relative flex w-fit items-center gap-2">
      <label for={props.control} class="text-fg-muted">
        {props.label}
      </label>
      <button
        type="button"
        aria-label="More information"
        aria-describedby={tip}
        class="rounded-full text-fg-subtle transition-colors hover:text-fg-muted"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {/* Beside the badge, so it never covers the control it describes and the scrolling
          panel cannot clip it. Never hit-testable, so it cannot block a click. */}
      <span
        id={tip}
        role="tooltip"
        class="pointer-events-none absolute top-1/2 left-full z-10 ml-2 w-64 max-w-[calc(100vw-2rem)] -translate-y-1/2 rounded-lg bg-surface-raised px-2.5 py-1.5 text-xs text-fg opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 motion-reduce:transition-none"
      >
        {props.hint}
      </span>
    </div>
  );
}

/**
 * A labelled control. The caller gives its input the same id.
 *
 * `note` is for what the field's value currently *is* — following a default, out of date —
 * not for what the field means. Meaning goes in the badge tooltip, which is static; a note
 * changes as the value does, which is why it is under the control where a change is seen.
 */
export function Field(props: {
  id: string;
  label: string;
  hint: string;
  note?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div class="flex flex-col gap-1 text-sm">
      <FieldLabel control={props.id} label={props.label} hint={props.hint} />
      {props.children}
      <Show when={props.note}>
        <span class="text-xs text-fg-subtle">{props.note}</span>
      </Show>
    </div>
  );
}
