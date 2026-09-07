import type { NarrativeEntry } from "@archefict/schema";
import { describe, expect, it } from "vitest";
import {
  CONTEXT_WINDOW_ENTRIES,
  DEFAULT_MODEL,
  SUGGESTED_MODELS,
  splitReply,
  toModelMessages,
} from "./index.ts";

function entry(kind: NarrativeEntry["kind"], text: string, i: number): NarrativeEntry {
  return { id: `e${i}`, kind, text, createdAt: i, provenance: { source: kind } };
}

describe("toModelMessages", () => {
  it("maps user and ai entries to user and assistant roles, skipping system and blanks", () => {
    const messages = toModelMessages([
      entry("user", "I knock.", 1),
      entry("ai", "No answer.", 2),
      entry("system", "note", 3),
      entry("user", "   ", 4),
    ]);
    expect(messages).toEqual([
      { role: "user", content: "I knock." },
      { role: "assistant", content: "No answer." },
    ]);
  });

  it("merges consecutive entries from one side into a single message", () => {
    const messages = toModelMessages([
      entry("user", "I knock.", 1),
      entry("ai", "The door creaks.", 2),
      entry("ai", "A voice answers.", 3),
      entry("user", "I enter.", 4),
    ]);
    expect(messages).toEqual([
      { role: "user", content: "I knock." },
      { role: "assistant", content: "The door creaks.\nA voice answers." },
      { role: "user", content: "I enter." },
    ]);
  });

  it("keeps only the most recent messages, counted after merging", () => {
    const many = Array.from({ length: CONTEXT_WINDOW_ENTRIES + 10 }, (_, i) =>
      entry(i % 2 === 0 ? "user" : "ai", `m${i}`, i),
    );
    const messages = toModelMessages(many);
    expect(messages).toHaveLength(CONTEXT_WINDOW_ENTRIES);
    expect(messages[0]?.content).toBe("m10");
  });
});

describe("splitReply", () => {
  it("makes every prose line its own part, blank lines or not", () => {
    expect(splitReply("The door creaks.\nA voice answers.\n\nYou step in.")).toEqual([
      "The door creaks.",
      "A voice answers.",
      "You step in.",
    ]);
  });

  it("keeps list items, table rows and quote lines together, and headings alone", () => {
    const reply = [
      "## The cellar",
      "You see:",
      "- a lantern",
      "- a rope",
      "> Careful, whispers the guide.",
      "> The steps are wet.",
      "| item | weight |",
      "|---|---|",
      "| rope | 2 |",
      "You climb down.",
    ].join("\n");
    expect(splitReply(reply)).toEqual([
      "## The cellar",
      "You see:",
      "- a lantern\n- a rope",
      "> Careful, whispers the guide.\n> The steps are wet.",
      "| item | weight |\n|---|---|\n| rope | 2 |",
      "You climb down.",
    ]);
  });

  it("never cuts fenced code, even across blank lines", () => {
    const reply = "Read this:\n```txt\nline 1\n\nline 3\n```\nDone.";
    expect(splitReply(reply)).toEqual(["Read this:", "```txt\nline 1\n\nline 3\n```", "Done."]);
  });

  it("drops empty parts and trims whitespace", () => {
    expect(splitReply("  \n\nOnly this.  \n\n  ")).toEqual(["Only this."]);
    expect(splitReply("")).toEqual([]);
  });
});

describe("model catalogue", () => {
  it("lists the default model", () => {
    expect(SUGGESTED_MODELS.some((m) => m.id === DEFAULT_MODEL)).toBe(true);
  });
});
