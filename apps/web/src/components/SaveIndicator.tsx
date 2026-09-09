import Check from "lucide-solid/icons/check";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { Match, Switch } from "solid-js";
import type { SaveState } from "../campaign/timeline.ts";

/** Whether the last write to a conversation reached storage. Sits in the narrative panel's bar. */
export function SaveIndicator(props: { state: SaveState }) {
  return (
    <span
      class="flex items-center px-1 text-fg-muted"
      role="status"
      data-save-state={props.state}
      title={saveTitle(props.state)}
    >
      <Switch>
        <Match when={props.state === "saving"}>
          <LoaderCircle size={14} class="animate-spin" aria-hidden="true" />
        </Match>
        <Match when={props.state === "saved"}>
          <Check size={14} aria-hidden="true" />
        </Match>
        <Match when={props.state === "failed"}>
          <TriangleAlert size={14} class="text-danger" aria-hidden="true" />
        </Match>
      </Switch>
      <span class="sr-only">{saveTitle(props.state)}</span>
    </span>
  );
}

function saveTitle(state: SaveState): string {
  switch (state) {
    case "idle":
      return "";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "failed":
      return "Not saved";
  }
}
