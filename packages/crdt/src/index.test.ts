import { Repo } from "@automerge/automerge-repo";
import { describe, expect, it } from "vitest";
import {
  appendEntries,
  appendEntry,
  archiveConversation,
  archiveSheet,
  type CampaignIndexDoc,
  conversationsOf,
  createCampaign,
  createEntry,
  createFolder,
  deleteCampaign,
  deleteEntry,
  entriesOf,
  FIRST_CONVERSATION_TITLE,
  foldersOf,
  moveSheet,
  openCampaign,
  redoAction,
  removeFolder,
  removeSheetField,
  renameCampaign,
  renameConversation,
  renameFolder,
  renameSheet,
  restoreConversation,
  restoreSheet,
  setInstructions,
  setSheetField,
  sheetsOf,
  type TimelineDoc,
  undoAction,
  updateEntry,
} from "./index.ts";

/** A bare entries document, for the tests that are about entries and nothing else. */
function timelineOnly() {
  return new Repo().create<TimelineDoc>({ entries: [] });
}

describe("campaign documents", () => {
  it("creates an index with one conversation that points at an empty timeline", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Test campaign");
    expect(handles.index.doc().name).toBe("Test campaign");
    const [first] = conversationsOf(handles.index);
    expect(first?.title).toBe(FIRST_CONVERSATION_TITLE);
    expect(first).toBeDefined();
    if (!first) return;
    const opened = await handles.openConversation(first.id);
    expect(opened.timeline.url).toBe(first.docUrl);
    expect(entriesOf(opened.timeline)).toEqual([]);
  });

  it("appends entries in order and reopens them through the index url", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Reopen");
    const [first] = conversationsOf(handles.index);
    if (!first) return;
    const { timeline, flush } = await handles.openConversation(first.id);
    const opening = createEntry({
      kind: "user",
      text: "I open the door.",
      provenance: { source: "user" },
    });
    const answer = createEntry({
      kind: "ai",
      text: "It creaks.",
      provenance: { source: "ai", model: "anthropic/claude-haiku-4.5", turnId: opening.id },
    });
    appendEntry(timeline, opening);
    appendEntry(timeline, answer);
    await flush();
    await handles.flush();

    const reopened = await openCampaign(repo, handles.index.url);
    const [again] = conversationsOf(reopened.index);
    if (!again) return;
    const conversation = await reopened.openConversation(again.id);
    expect(entriesOf(conversation.timeline).map((e) => e.text)).toEqual([
      "I open the door.",
      "It creaks.",
    ]);
    expect(entriesOf(conversation.timeline)[1]?.provenance.model).toBe(
      "anthropic/claude-haiku-4.5",
    );
  });

  it("flush resolves even for an in-memory repo", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Flush");
    const [first] = conversationsOf(handles.index);
    if (!first) return;
    const { timeline, flush } = await handles.openConversation(first.id);
    appendEntry(timeline, createEntry({ kind: "user", text: "x", provenance: { source: "user" } }));
    await expect(flush()).resolves.toBeUndefined();
    await expect(handles.flush()).resolves.toBeUndefined();
  });

  it("renames a campaign, ignoring blank names", () => {
    const repo = new Repo();
    const { index } = createCampaign(repo, "Old");
    renameCampaign(index, "  New name  ");
    expect(index.doc().name).toBe("New name");
    renameCampaign(index, "   ");
    expect(index.doc().name).toBe("New name");
  });

  it("rejects a non-automerge url", async () => {
    const repo = new Repo();
    await expect(openCampaign(repo, "nope")).rejects.toThrow(/Not an Automerge URL/);
  });

  it("refuses to open a conversation the index does not list", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Strict");
    await expect(handles.openConversation("missing")).rejects.toThrow(/No conversation/);
  });

  it("folds a Slice 0 index with a single timelineUrl into its first conversation", async () => {
    const repo = new Repo();
    const timeline = repo.create<TimelineDoc>({ entries: [] });
    appendEntry(
      timeline,
      createEntry({ kind: "user", text: "old feed", provenance: { source: "user" } }),
    );
    // The shape Slice 0 wrote: one feed per campaign, no conversations.
    const legacy = repo.create<CampaignIndexDoc>({
      name: "Legacy",
      timelineUrl: timeline.url,
      createdAt: 1,
    } as CampaignIndexDoc);

    const handles = await openCampaign(repo, legacy.url);
    const conversations = conversationsOf(handles.index);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.title).toBe(FIRST_CONVERSATION_TITLE);
    expect(conversations[0]?.docUrl).toBe(timeline.url);
    expect(conversations[0]?.createdAt).toBe(1);
    expect(handles.index.doc().timelineUrl).toBeUndefined();
    // The library came later still: the migration gives an old index empty shelves.
    expect(handles.index.doc().folders).toEqual([]);
    expect(handles.index.doc().sheets).toEqual([]);

    const first = conversations[0];
    if (!first) return;
    const opened = await handles.openConversation(first.id);
    expect(entriesOf(opened.timeline).map((e) => e.text)).toEqual(["old feed"]);

    // Opening again is a no-op: the migration ran once.
    const again = await openCampaign(repo, legacy.url);
    expect(conversationsOf(again.index)).toHaveLength(1);
  });

  it("deletes every document of a campaign and reports the conversations it had", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Doomed");
    await handles.createConversation("Second");
    const gone = deleteCampaign(repo, handles.index);
    expect(gone.map((c) => c.title)).toEqual([FIRST_CONVERSATION_TITLE, "Second"]);
  });
});

describe("conversations", () => {
  it("adds a conversation with an empty timeline of its own", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Many");
    const created = await handles.createConversation("Downtime");
    expect(conversationsOf(handles.index).map((c) => c.title)).toEqual([
      FIRST_CONVERSATION_TITLE,
      "Downtime",
    ]);
    const opened = await handles.openConversation(created.id);
    expect(entriesOf(opened.timeline)).toEqual([]);
    const [first] = conversationsOf(handles.index);
    expect(first?.docUrl).not.toBe(created.docUrl);
  });

  it("renames, ignoring blank and unchanged titles", () => {
    const repo = new Repo();
    const { index } = createCampaign(repo, "Rename");
    const [first] = conversationsOf(index);
    if (!first) return;
    renameConversation(index, first.id, "  The heist  ");
    expect(conversationsOf(index)[0]?.title).toBe("The heist");
    renameConversation(index, first.id, "   ");
    expect(conversationsOf(index)[0]?.title).toBe("The heist");
    renameConversation(index, "missing", "nothing");
    expect(conversationsOf(index)).toHaveLength(1);
  });

  it("archives and restores, and does nothing twice", () => {
    const repo = new Repo();
    const { index } = createCampaign(repo, "Archive");
    const [first] = conversationsOf(index);
    if (!first) return;
    archiveConversation(index, first.id);
    const archivedAt = conversationsOf(index)[0]?.archivedAt;
    expect(archivedAt).toBeTypeOf("number");
    archiveConversation(index, first.id);
    expect(conversationsOf(index)[0]?.archivedAt).toBe(archivedAt);
    restoreConversation(index, first.id);
    expect(conversationsOf(index)[0]?.archivedAt).toBeUndefined();
    restoreConversation(index, first.id);
    expect(conversationsOf(index)[0]?.archivedAt).toBeUndefined();
  });
});

describe("instructions", () => {
  it("are absent until the campaign writes its own, and can be cleared back", () => {
    const repo = new Repo();
    const { index } = createCampaign(repo, "Prompt");
    expect(index.doc().instructions).toBeUndefined();
    setInstructions(index, "Write in first person.");
    expect(index.doc().instructions).toBe("Write in first person.");
    setInstructions(index, "Write in first person, present tense.");
    expect(index.doc().instructions).toBe("Write in first person, present tense.");
    setInstructions(index, "");
    expect(index.doc().instructions).toBe("");
    setInstructions(index, undefined);
    expect(index.doc().instructions).toBeUndefined();
  });
});

describe("library", () => {
  it("creates folders inside folders and sheets inside them, appended in order", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Library");
    const characters = createFolder(handles.index, "Characters", null);
    const allies = createFolder(handles.index, "Allies", characters.id);
    const varn = await handles.createSheet("Varn Ashgrove", allies.id);
    await handles.createSheet("Mira", allies.id);
    const notes = await handles.createSheet("Notes", null);

    expect(foldersOf(handles.index).map((f) => [f.title, f.parentId, f.order])).toEqual([
      ["Characters", null, 0],
      ["Allies", characters.id, 0],
    ]);
    expect(
      sheetsOf(handles.index)
        .filter((s) => s.folderId === allies.id)
        .map((s) => [s.title, s.order]),
    ).toEqual([
      ["Varn Ashgrove", 0],
      ["Mira", 1],
    ]);
    expect(notes.order).toBe(0);

    const opened = await handles.openSheet(varn.id);
    expect(opened.doc.doc()).toEqual({ body: "", fields: {} });
    await expect(handles.openSheet("missing")).rejects.toThrow(/No sheet/);
  });

  it("renames, moves, archives and restores sheets", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Sheets");
    const { index } = handles;
    const folder = createFolder(index, "Places", null);
    const sheet = await handles.createSheet("Tavern", null);

    renameSheet(index, sheet.id, "  The Drowned Lantern  ");
    renameSheet(index, sheet.id, "   ");
    expect(sheetsOf(index)[0]?.title).toBe("The Drowned Lantern");

    moveSheet(index, sheet.id, folder.id);
    expect(sheetsOf(index)[0]?.folderId).toBe(folder.id);
    expect(sheetsOf(index)[0]?.order).toBe(0);
    moveSheet(index, sheet.id, folder.id);
    expect(sheetsOf(index)[0]?.order).toBe(0);

    archiveSheet(index, sheet.id);
    const archivedAt = sheetsOf(index)[0]?.archivedAt;
    expect(archivedAt).toBeTypeOf("number");
    archiveSheet(index, sheet.id);
    expect(sheetsOf(index)[0]?.archivedAt).toBe(archivedAt);
    restoreSheet(index, sheet.id);
    expect(sheetsOf(index)[0]?.archivedAt).toBeUndefined();
  });

  it("renames folders and removes them only once they are empty", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Folders");
    const { index } = handles;
    const folder = createFolder(index, "Factions", null);
    renameFolder(index, folder.id, " Guilds ");
    renameFolder(index, folder.id, "");
    expect(foldersOf(index)[0]?.title).toBe("Guilds");

    const inside = await handles.createSheet("Thieves", folder.id);
    expect(removeFolder(index, folder.id)).toBe(false);
    expect(foldersOf(index)).toHaveLength(1);

    const child = createFolder(index, "Sub", folder.id);
    moveSheet(index, inside.id, null);
    expect(removeFolder(index, folder.id)).toBe(false);
    expect(removeFolder(index, child.id)).toBe(true);
    expect(removeFolder(index, folder.id)).toBe(true);
    expect(foldersOf(index)).toEqual([]);
    expect(removeFolder(index, "missing")).toBe(false);
  });

  it("sets, rewrites and removes a sheet's fields", async () => {
    const repo = new Repo();
    const handles = createCampaign(repo, "Fields");
    const sheet = await handles.createSheet("Varn", null);
    const { doc } = await handles.openSheet(sheet.id);

    setSheetField(doc, "class", "Rogue");
    setSheetField(doc, " level ", "5");
    setSheetField(doc, "", "nothing");
    expect(doc.doc().fields).toEqual({ class: "Rogue", level: "5" });

    setSheetField(doc, "class", "Rogue / Thief");
    expect(doc.doc().fields["class"]).toBe("Rogue / Thief");

    removeSheetField(doc, "level");
    removeSheetField(doc, "level");
    expect(doc.doc().fields).toEqual({ class: "Rogue / Thief" });
  });
});

describe("entries", () => {
  it("edits an entry's text and marks it edited", () => {
    const timeline = timelineOnly();
    const entry = createEntry({
      kind: "ai",
      text: "The door creaks.",
      provenance: { source: "ai" },
    });
    appendEntry(timeline, entry);
    updateEntry(timeline, entry.id, "The door creaks open.");
    const [edited] = entriesOf(timeline);
    expect(edited?.text).toBe("The door creaks open.");
    expect(edited?.editedAt).toBeTypeOf("number");
    updateEntry(timeline, "missing", "ignored");
    expect(entriesOf(timeline)).toHaveLength(1);
  });

  it("deletes an entry by id and ignores unknown ids", () => {
    const timeline = timelineOnly();
    const first = createEntry({ kind: "user", text: "one", provenance: { source: "user" } });
    const second = createEntry({ kind: "user", text: "two", provenance: { source: "user" } });
    appendEntry(timeline, first);
    appendEntry(timeline, second);
    deleteEntry(timeline, first.id);
    deleteEntry(timeline, "missing");
    expect(entriesOf(timeline).map((e) => e.text)).toEqual(["two"]);
  });
});

describe("undo and redo", () => {
  function timelineWith(texts: readonly string[]) {
    const timeline = timelineOnly();
    const entries = texts.map((text) =>
      createEntry({ kind: "user", text, provenance: { source: "user" } }),
    );
    for (const entry of entries) appendEntry(timeline, entry);
    return { timeline, entries };
  }
  const texts = (timeline: ReturnType<typeof timelineWith>["timeline"]) =>
    entriesOf(timeline).map((entry) => entry.text);

  it("takes back an append of several entries as one step, and puts them back", () => {
    const timeline = timelineOnly();
    const parts = ["The door creaks.", "A voice answers."].map((text) =>
      createEntry({ kind: "ai", text, provenance: { source: "ai", turnId: "t1" } }),
    );
    const action = appendEntries(timeline, parts);
    expect(action).not.toBeNull();
    if (!action) return;

    expect(undoAction(timeline, action)).toBe(true);
    expect(entriesOf(timeline)).toEqual([]);
    expect(redoAction(timeline, action)).toBe(true);
    expect(texts(timeline)).toEqual(["The door creaks.", "A voice answers."]);
  });

  it("restores the previous text and drops editedAt when the entry had never been edited", () => {
    const { timeline, entries } = timelineWith(["first"]);
    const first = entries[0];
    expect(first).toBeDefined();
    if (!first) return;

    const action = updateEntry(timeline, first.id, "changed");
    expect(action).not.toBeNull();
    if (!action) return;
    expect(entriesOf(timeline)[0]?.editedAt).toBeTypeOf("number");

    expect(undoAction(timeline, action)).toBe(true);
    expect(texts(timeline)).toEqual(["first"]);
    expect(entriesOf(timeline)[0]?.editedAt).toBeUndefined();

    expect(redoAction(timeline, action)).toBe(true);
    expect(texts(timeline)).toEqual(["changed"]);
    expect(entriesOf(timeline)[0]?.editedAt).toBeTypeOf("number");
  });

  it("puts a deleted entry back where it was, even after later appends", () => {
    const { timeline, entries } = timelineWith(["one", "two", "three"]);
    const middle = entries[1];
    expect(middle).toBeDefined();
    if (!middle) return;

    const action = deleteEntry(timeline, middle.id);
    expect(action).not.toBeNull();
    if (!action) return;
    expect(texts(timeline)).toEqual(["one", "three"]);

    appendEntry(
      timeline,
      createEntry({ kind: "user", text: "four", provenance: { source: "user" } }),
    );
    expect(undoAction(timeline, action)).toBe(true);
    expect(texts(timeline)).toEqual(["one", "two", "three", "four"]);

    expect(redoAction(timeline, action)).toBe(true);
    expect(texts(timeline)).toEqual(["one", "three", "four"]);
  });

  it("restores a first entry at the top", () => {
    const { timeline, entries } = timelineWith(["one", "two"]);
    const first = entries[0];
    if (!first) return;
    const action = deleteEntry(timeline, first.id);
    if (!action) return;
    expect(undoAction(timeline, action)).toBe(true);
    expect(texts(timeline)).toEqual(["one", "two"]);
  });

  it("reports false for a stale action instead of writing", () => {
    const { timeline, entries } = timelineWith(["one"]);
    const first = entries[0];
    if (!first) return;
    const action = deleteEntry(timeline, first.id);
    if (!action) return;

    expect(undoAction(timeline, action)).toBe(true);
    // Already back: undoing the same delete twice must not duplicate it.
    expect(undoAction(timeline, action)).toBe(false);
    expect(texts(timeline)).toEqual(["one"]);

    const update = updateEntry(timeline, "missing", "nope");
    expect(update).toBeNull();
  });

  it("returns null when an update would not change anything", () => {
    const { timeline, entries } = timelineWith(["same"]);
    const first = entries[0];
    if (!first) return;
    expect(updateEntry(timeline, first.id, "same")).toBeNull();
  });
});
