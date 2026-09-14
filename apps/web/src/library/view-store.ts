import { type Accessor, createSignal } from "solid-js";

const KEY = "archefict:sheet-view";

/** How a sheet is shown (docs/sheets.md): the field index above the body, and raw source. */
export type SheetView = {
  /** The index of every field, above the body. Hidden by default: fields live in the prose. */
  properties: boolean;
  /** Raw source in place of the rendered body — the `::`, `{{ }}`, `[[ ]]` as typed. */
  raw: boolean;
};

export type SheetViewStore = {
  view: Accessor<SheetView>;
  toggleProperties: () => void;
  toggleRaw: () => void;
};

/**
 * One choice for every sheet on this device: switching sheets keeps the view. A device
 * preference like the layout and the drafts, so localStorage, never the document.
 */
export function createSheetViewStore(): SheetViewStore {
  const [view, setView] = createSignal<SheetView>(read());
  function update(change: Partial<SheetView>): void {
    const next = { ...view(), ...change };
    setView(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
  }
  return {
    view,
    toggleProperties: () => update({ properties: !view().properties }),
    toggleRaw: () => update({ raw: !view().raw }),
  };
}

function read(): SheetView {
  const fallback: SheetView = { properties: false, raw: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const value = parsed as Partial<SheetView>;
    return {
      properties: value.properties === true,
      raw: value.raw === true,
    };
  } catch {
    return fallback;
  }
}
