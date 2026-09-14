import { InputRule, inputRules } from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";
import { NodeSelection, type Plugin } from "prosemirror-state";
import type { ChipContext } from "./chips.tsx";

/** A field name: a word, no spaces, no dots — dots are for another sheet's field. */
const KEY = "[A-Za-z_][\\w-]*";

/**
 * The typed syntax for fields, consumed as it is typed (docs/sheets.md): `::` writes, `{{ }}`
 * reads. Nothing here survives into storage — the text becomes a chip the moment the rule
 * fires, the way `## ` becomes a heading rather than staying two hashes and a space.
 *
 * - `hp:: ` — a chip for `hp`, showing key and value. The field is created empty if it did not
 *   exist, and the chip is selected so it opens for the value at once.
 * - `[hp:: 12]` — the same chip with the value set in one go, for mid-sentence use.
 * - `{{hp}}` — a chip showing only the value. Reads; never creates.
 */
export function fieldRules(
  schema: Schema,
  context: Pick<ChipContext, "ensureField" | "setField">,
): Plugin {
  const field = schema.nodes["field"];
  if (!field) return inputRules({ rules: [] });

  const rules = [
    new InputRule(new RegExp(`(^|\\s)(${KEY})::\\s$`), (state, match, start, end) => {
      const key = match[2];
      if (!key) return null;
      const from = start + (match[1]?.length ?? 0);
      context.ensureField(key);
      const tr = state.tr.replaceWith(from, end, field.create({ key, display: "pair" }));
      return tr.setSelection(NodeSelection.create(tr.doc, from));
    }),

    new InputRule(new RegExp(`\\[(${KEY})::\\s*([^\\]]*)\\]$`), (state, match, start, end) => {
      const key = match[1];
      if (!key) return null;
      context.setField(key, (match[2] ?? "").trim());
      return state.tr.replaceWith(start, end, field.create({ key, display: "pair" }));
    }),

    new InputRule(new RegExp(`\\{\\{(${KEY})\\}\\}$`), (state, match, start, end) => {
      const key = match[1];
      if (!key) return null;
      return state.tr.replaceWith(start, end, field.create({ key, display: "value" }));
    }),
  ];
  return inputRules({ rules });
}
