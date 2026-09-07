/**
 * Which campaigns this browser knows about, and which one is open.
 *
 * Local-only for now. In the cloud phase this becomes the account's campaign list in
 * Postgres (membership is security state and never lives in a CRDT, docs/stack.md).
 * The campaign documents themselves are Automerge; this is only the index of pointers.
 */
const KEY = "archefict:library:v1";
const LEGACY_SINGLE_CAMPAIGN_KEY = "archefict:campaign:index-url";

export type LibraryEntry = {
  indexUrl: string;
  createdAt: number;
};

export type LibraryRecord = {
  version: 1;
  campaigns: LibraryEntry[];
  activeIndexUrl: string | null;
};

const EMPTY: LibraryRecord = { version: 1, campaigns: [], activeIndexUrl: null };

export function readLibrary(): LibraryRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) return parsed;
    }
    // Before the library existed there was one campaign, remembered under its own key.
    const legacy = localStorage.getItem(LEGACY_SINGLE_CAMPAIGN_KEY);
    if (legacy) {
      const migrated: LibraryRecord = {
        version: 1,
        campaigns: [{ indexUrl: legacy, createdAt: Date.now() }],
        activeIndexUrl: legacy,
      };
      writeLibrary(migrated);
      localStorage.removeItem(LEGACY_SINGLE_CAMPAIGN_KEY);
      return migrated;
    }
  } catch {
    // Fall through to an empty library.
  }
  return { ...EMPTY, campaigns: [] };
}

export function writeLibrary(record: LibraryRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage blocked: the list lasts for this session only.
  }
}

function isRecord(value: unknown): value is LibraryRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<LibraryRecord>;
  return (
    v.version === 1 &&
    Array.isArray(v.campaigns) &&
    v.campaigns.every((c) => typeof c?.indexUrl === "string" && typeof c?.createdAt === "number") &&
    (v.activeIndexUrl === null || typeof v.activeIndexUrl === "string")
  );
}
