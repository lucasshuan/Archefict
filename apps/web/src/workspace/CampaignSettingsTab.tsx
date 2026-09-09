import { type CampaignHandles, type CampaignIndexDoc, setInstructions } from "@archefict/crdt";
import type { Doc } from "@automerge/automerge";
import { type Accessor, createEffect, createSignal, on, onCleanup } from "solid-js";
import { CONTROL } from "../components/control.ts";
import { Panel } from "../components/Panel.tsx";

/**
 * The campaign's own settings. Only the narrator's instructions today; the model override,
 * plugins and export land here later (docs/workspace.md). Instructions are content, so they
 * live in the index document and sync. The device default from the Settings page fills the
 * field until the campaign writes its own, and typing the default back returns to it, so the
 * campaign keeps following the default when the default changes.
 */
export function CampaignSettingsTab(props: {
  handles: CampaignHandles;
  index: Accessor<Doc<CampaignIndexDoc>>;
  /** The device default: what the narrator gets when the campaign has written nothing. */
  fallback: Accessor<string>;
}) {
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
    <Panel
      title="Settings"
      class="flex-1 bg-bg"
      menu={[{ label: "Reset instructions to default", onSelect: reset, disabled: !custom() }]}
    >
      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div class="mx-auto flex max-w-page flex-col gap-4">
          <section
            class="flex flex-col gap-5 rounded-app bg-surface p-5"
            aria-labelledby="campaign-narrator-heading"
          >
            <h2 id="campaign-narrator-heading" class="text-[15px] font-semibold text-fg">
              Narrator
            </h2>
            <div class="flex flex-col gap-1 text-sm">
              <label for="campaign-instructions" class="text-fg-muted">
                Instructions
              </label>
              <textarea
                id="campaign-instructions"
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
              <span class="text-xs text-fg-subtle">
                {custom()
                  ? "Written for this campaign."
                  : "The default from Settings, until this campaign writes its own."}
              </span>
            </div>
          </section>
        </div>
      </div>
    </Panel>
  );
}
