import { Repo } from "@automerge/automerge-repo";
import { describe, expect, it } from "vitest";
import {
  appendEntry,
  createCampaign,
  createEntry,
  deleteEntry,
  entriesOf,
  openCampaign,
  renameCampaign,
  updateEntry,
} from "./index.ts";

describe("campaign documents", () => {
  it("creates an index that points at an empty timeline", () => {
    const repo = new Repo();
    const { index, timeline } = createCampaign(repo, "Test campaign");
    expect(index.doc().name).toBe("Test campaign");
    expect(index.doc().timelineUrl).toBe(timeline.url);
    expect(entriesOf(timeline)).toEqual([]);
  });

  it("appends entries in order and reopens them from the index url", async () => {
    const repo = new Repo();
    const { index, timeline, flush } = createCampaign(repo, "Reopen");
    const first = createEntry({
      kind: "user",
      text: "I open the door.",
      provenance: { source: "user" },
    });
    const second = createEntry({
      kind: "ai",
      text: "It creaks.",
      provenance: { source: "ai", model: "anthropic/claude-haiku-4.5", turnId: first.id },
    });
    appendEntry(timeline, first);
    appendEntry(timeline, second);
    await flush();

    const reopened = await openCampaign(repo, index.url);
    expect(entriesOf(reopened.timeline).map((e) => e.text)).toEqual([
      "I open the door.",
      "It creaks.",
    ]);
    expect(entriesOf(reopened.timeline)[1]?.provenance.model).toBe("anthropic/claude-haiku-4.5");
  });

  it("flush resolves even for an in-memory repo", async () => {
    const repo = new Repo();
    const { timeline, flush } = createCampaign(repo, "Flush");
    appendEntry(timeline, createEntry({ kind: "user", text: "x", provenance: { source: "user" } }));
    await expect(flush()).resolves.toBeUndefined();
  });

  it("renames a campaign, ignoring blank names", () => {
    const repo = new Repo();
    const { index } = createCampaign(repo, "Old");
    renameCampaign(index, "  New name  ");
    expect(index.doc().name).toBe("New name");
    renameCampaign(index, "   ");
    expect(index.doc().name).toBe("New name");
  });

  it("edits an entry's text and marks it edited", () => {
    const repo = new Repo();
    const { timeline } = createCampaign(repo, "Edit");
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
    const repo = new Repo();
    const { timeline } = createCampaign(repo, "Delete");
    const first = createEntry({ kind: "user", text: "one", provenance: { source: "user" } });
    const second = createEntry({ kind: "user", text: "two", provenance: { source: "user" } });
    appendEntry(timeline, first);
    appendEntry(timeline, second);
    deleteEntry(timeline, first.id);
    deleteEntry(timeline, "missing");
    expect(entriesOf(timeline).map((e) => e.text)).toEqual(["two"]);
  });

  it("rejects a non-automerge url", async () => {
    const repo = new Repo();
    await expect(openCampaign(repo, "nope")).rejects.toThrow(/Not an Automerge URL/);
  });
});
