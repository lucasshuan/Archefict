import { type CampaignHandles, type CampaignIndexDoc, setInstructions } from "@archefict/crdt";
import type { Doc } from "@automerge/automerge";
import { type Accessor, createEffect, createSignal, on, onCleanup } from "solid-js";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { CONTROL } from "../components/control.ts";
import { Field, Section } from "../components/settings-form.tsx";

/**
 * The campaign's own settings. The campaign's name and the narrator's instructions today;
 * the cover image, the model override, plugins and export land here later
 * (docs/workspace.md). Both are content, so they live in the index document and sync.
 *
 * The name is read in the right sidebar and changed only here: the sidebar shows the
 * campaign, and this page is where the campaign is changed. Deleting the campaign is here
 * too, behind a confirmation that names it — the one destructive thing in the app, kept
 * where the campaign's name is in view rather than on a card that has no room for it. The
 * instructions take the device default from the Settings page until the campaign writes its
 * own, and typing the default back returns to it, so the campaign keeps following the default
 * when the default changes.
 *
 * It is a settings page, not a tab of panels. The other tabs are workspaces — things you
 * arrange, hide, drag and work inside — and a panel is what makes a region one of those. This
 * is a form you visit, change and leave, so it takes the shape of the global Settings page
 * instead: one scrolling column of raised `Section` cards, each a titled group of `Field`s,
 * on the page ground. The one thing it does not borrow is that page's row of tabs, which one
 * group does not need yet.
 */
const NAME_ID = "campaign-name";
const INSTRUCTIONS_ID = "campaign-instructions";

export function CampaignSettingsTab(props: {
  handles: CampaignHandles;
  index: Accessor<Doc<CampaignIndexDoc>>;
  /** The device default: what the narrator gets when the campaign has written nothing. */
  fallback: Accessor<string>;
  onRename: (name: string) => void;
  /** Deletes the campaign and everything in it. Asked for confirmation here first. */
  onDelete: () => void;
}) {
  const [name, setName] = createSignal(props.index().name);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);
  let nameFocused = false;

  // Renamed from another device: follow it unless the field is being typed in.
  createEffect(
    on(
      () => props.index().name,
      (value) => {
        if (!nameFocused) setName(value);
      },
      { defer: true },
    ),
  );

  // An empty name is not a rename, it is a cleared field: the campaign keeps its name and
  // the field shows it again.
  function commitName(): void {
    const next = name().trim();
    if (next === "" || next === props.index().name) {
      setName(props.index().name);
      return;
    }
    props.onRename(next);
  }

  const stored = () => props.index().instructions;
  const custom = () => stored() !== undefined;
  const [draft, setDraft] = createSignal(stored() ?? props.fallback());
  let focused = false;

  // Another device, or the reset below, changed the document: follow it unless the field
  // is being typed in, where the person's text wins until they leave it.
  createEffect(
    on(
      [stored, props.fallback],
      ([value, fallback]) => {
        if (!focused) setDraft(value ?? fallback);
      },
      { defer: true },
    ),
  );

  function commit(): void {
    const text = draft();
    setInstructions(props.handles.index, text === props.fallback() ? undefined : text);
    void props.handles.flush();
  }
  onCleanup(commit);

  function reset(): void {
    setDraft(props.fallback());
    setInstructions(props.handles.index, undefined);
    void props.handles.flush();
  }

  return (
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div class="mx-auto flex max-w-page flex-col gap-4">
        <Section
          title="Campaign"
          action={
            <button
              type="button"
              class="rounded-app px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-raised hover:text-danger motion-reduce:transition-none"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete campaign
            </button>
          }
        >
          <Field
            id={NAME_ID}
            label="Name"
            hint="What the campaign is called, in its sidebar and in the list of campaigns."
          >
            <input
              id={NAME_ID}
              type="text"
              value={name()}
              class={CONTROL}
              onFocus={() => {
                nameFocused = true;
              }}
              onBlur={() => {
                nameFocused = false;
                commitName();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </Field>
        </Section>
        <Section
          title="Narrator"
          action={
            // On the heading row and always visible. A panel would have buried this in a `⋯`
            // that waits for a hover; a settings page has no such thing, and the one action
            // this group has should not be the first thing that needs discovering.
            <button
              type="button"
              disabled={!custom()}
              class="rounded-app px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
              onClick={reset}
            >
              Reset to default
            </button>
          }
        >
          <Field
            id={INSTRUCTIONS_ID}
            label="Instructions"
            hint="The narrator's system prompt for this campaign. Leave it as the default and the campaign follows Settings; change it and the campaign keeps its own."
            note={
              custom()
                ? "Written for this campaign."
                : "The default from Settings, until this campaign writes its own."
            }
          >
            <textarea
              id={INSTRUCTIONS_ID}
              rows={10}
              value={draft()}
              class={`${CONTROL} resize-y`}
              onFocus={() => {
                focused = true;
              }}
              onBlur={() => {
                focused = false;
                commit();
              }}
              onInput={(event) => setDraft(event.currentTarget.value)}
            />
          </Field>
        </Section>
      </div>
      <ConfirmDialog
        open={confirmingDelete()}
        title="Delete campaign"
        message={`Delete "${props.index().name}" and everything in it? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false);
          props.onDelete();
        }}
        onClose={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
