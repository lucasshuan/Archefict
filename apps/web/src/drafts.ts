/**
 * Unsent composer text, per campaign, in this browser only.
 * Deliberately not in the CRDT: a draft is not part of the story until it is sent.
 */
const PREFIX = "archefict:draft:";

export function readDraft(key: string): string {
  try {
    return localStorage.getItem(PREFIX + key) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(key: string, value: string): void {
  try {
    if (value === "") localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage blocked: the draft lives only while the page does.
  }
}
