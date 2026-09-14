import type { ModelInfo } from "@archefict/contract";

/**
 * Finding a model by typing part of its name.
 *
 * The catalogue writes one model two ways — `z-ai/glm-4.6-flash` and "Z.AI: GLM 4.6 Flash" —
 * and nobody types either exactly. So the query and the catalogue are both cut down to
 * letters and digits before anything is compared: every separator a person might use, and
 * every separator OpenRouter happens to use, stops mattering. `glm flash`, `GLM-Flash` and
 * `glm4.6 flash` all reach the same model.
 *
 * Matching is by word and unordered — each word of the query has to land somewhere in the id
 * or the name — so `haiku anthropic` finds what `anthropic haiku` finds. Ranking is what puts
 * the exact and the contiguous matches at the top, not the filter.
 */

/** Lower is better; `null` is no match at all. */
export type Score = number | null;

/** Letters and digits only: `Z.AI: GLM 4.6` and `z-ai/glm-4.6` flatten to the same thing. */
function flatten(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The query as words. Everything that is not a letter or a digit separates them. */
export function words(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "");
}

export function scoreModel(model: ModelInfo, query: string): Score {
  const tokens = words(query);
  // A query of pure punctuation is no query: everything stays, in its usual order.
  if (tokens.length === 0) return 0;

  const id = model.id.toLowerCase();
  const flatId = flatten(model.id);
  const flatName = flatten(model.name);
  const flatQuery = flatten(query);
  if (!tokens.every((token) => flatId.includes(token) || flatName.includes(token))) return null;

  if (id === query.trim().toLowerCase()) return 1;
  if (flatId === flatQuery) return 2;
  if (flatId.startsWith(flatQuery)) return 3;
  if (flatName.startsWith(flatQuery)) return 4;
  if (flatId.includes(flatQuery)) return 5;
  // Words scattered through the id beat words that needed the name to be found.
  if (tokens.every((token) => flatId.includes(token))) return 6;
  return 7;
}

/**
 * Sorts the catalogue for a query. Best first; anything that does not match is dropped.
 * Within one rank, models the narrator can use come before the ones it cannot, and the
 * suggested models before the rest.
 */
export function rankModels(
  models: readonly ModelInfo[],
  query: string,
  suggestedRank: (id: string) => number,
): ModelInfo[] {
  const scored: Array<{ model: ModelInfo; score: number }> = [];
  for (const model of models) {
    const score = query === "" ? 0 : scoreModel(model, query);
    if (score === null) continue;
    scored.push({ model, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      Number(!a.model.tools) - Number(!b.model.tools) ||
      suggestedRank(a.model.id) - suggestedRank(b.model.id) ||
      a.model.id.localeCompare(b.model.id),
  );
  return scored.map((entry) => entry.model);
}

/** A piece of a row's id, and whether the query put it there. */
export type Part = { text: string; hit: boolean };

/**
 * Cuts a model id into the pieces the query matched and the pieces it did not, so a long slug
 * shows why it is in the list. Each word is marked where it first lands; overlapping marks
 * merge, because two underlines touching read as one.
 */
export function highlightParts(text: string, query: string): Part[] {
  const lower = text.toLowerCase();
  const hits: Array<{ start: number; end: number }> = [];
  for (const token of words(query)) {
    const at = lower.indexOf(token);
    if (at >= 0) hits.push({ start: at, end: at + token.length });
  }
  hits.sort((a, b) => a.start - b.start || a.end - b.end);

  // Two marks that touch are one mark: kept separate they would render as two spans and read
  // as a gap that is not there.
  const merged: Array<{ start: number; end: number }> = [];
  for (const hit of hits) {
    const last = merged.at(-1);
    if (last !== undefined && hit.start <= last.end) last.end = Math.max(last.end, hit.end);
    else merged.push({ ...hit });
  }

  const parts: Part[] = [];
  let cut = 0;
  for (const hit of merged) {
    if (hit.start > cut) parts.push({ text: text.slice(cut, hit.start), hit: false });
    parts.push({ text: text.slice(hit.start, hit.end), hit: true });
    cut = hit.end;
  }
  if (cut < text.length) parts.push({ text: text.slice(cut), hit: false });
  return parts;
}
