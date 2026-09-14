import type { Folder, SheetSummary } from "@archefict/schema";

/** One hit: the sheet, and the folders it sits in, for the row's second line. */
export type SheetMatch = {
  sheet: SheetSummary;
  /** "Characters / Allies", or "" for a sheet at the root. */
  where: string;
};

/**
 * How well a title answers a query. Lower is better; -1 is no answer at all. Four bands, in
 * the order a person would rank them themselves: the whole name, the start of the name, the
 * start of a word inside it, and anywhere in it. Nothing fuzzier — a library is a set of names
 * somebody chose, so a miss is far more likely to be a different sheet than a typo.
 */
function rank(title: string, query: string): number {
  const name = title.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(query))) return 2;
  return name.includes(query) ? 3 : -1;
}

/** Where a sheet lives, read from the root down. */
function pathOf(folderId: string | null, folders: readonly Folder[]): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let at = folderId;
  // A parent chain that loops cannot be built by the UI, but a merge of two devices could.
  while (at !== null && !seen.has(at)) {
    seen.add(at);
    const folder = folders.find((candidate) => candidate.id === at);
    if (folder === undefined) break;
    names.unshift(folder.title);
    at = folder.parentId;
  }
  return names.join(" / ");
}

/**
 * The sheets a query finds, best first. Folders are not searched and not drawn: a search is
 * the way out of the tree, so its answer is flat, and each row says where it came from instead.
 * A blank query finds nothing, because the tree is the answer then.
 */
export function searchSheets(
  query: string,
  sheets: readonly SheetSummary[],
  folders: readonly Folder[],
): readonly SheetMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];
  return sheets
    .map((sheet) => ({ sheet, score: rank(sheet.title, needle) }))
    .filter((hit) => hit.score >= 0)
    .sort((a, b) => a.score - b.score || a.sheet.title.localeCompare(b.sheet.title))
    .map((hit) => ({ sheet: hit.sheet, where: pathOf(hit.sheet.folderId, folders) }));
}
