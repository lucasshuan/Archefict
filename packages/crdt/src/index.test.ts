import { Repo } from "@automerge/automerge-repo";
import { describe, expect, it } from "vitest";
import { appendEntry, createCampaign, createEntry, entriesOf, openCampaign } from "./index.ts";

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
    const { index, timeline } = createCampaign(repo, "Reopen");
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

    const reopened = await openCampaign(repo, index.url);
    expect(entriesOf(reopened.timeline).map((e) => e.text)).toEqual([
      "I open the door.",
      "It creaks.",
    ]);
    expect(entriesOf(reopened.timeline)[1]?.provenance.model).toBe("anthropic/claude-haiku-4.5");
  });

  it("rejects a non-automerge url", async () => {
    const repo = new Repo();
    await expect(openCampaign(repo, "nope")).rejects.toThrow(/Not an Automerge URL/);
  });
});
