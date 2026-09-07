import type { NarrativeEntry } from "@archefict/schema";
import { describe, expect, it } from "vitest";
import {
  CONTEXT_WINDOW_ENTRIES,
  DEFAULT_MODEL,
  SUGGESTED_MODELS,
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

  it("keeps only the most recent entries", () => {
    const many = Array.from({ length: CONTEXT_WINDOW_ENTRIES + 10 }, (_, i) =>
      entry(i % 2 === 0 ? "user" : "ai", `m${i}`, i),
    );
    const messages = toModelMessages(many);
    expect(messages).toHaveLength(CONTEXT_WINDOW_ENTRIES);
    expect(messages[0]?.content).toBe("m10");
  });
});

describe("model catalogue", () => {
  it("lists the default model", () => {
    expect(SUGGESTED_MODELS.some((m) => m.id === DEFAULT_MODEL)).toBe(true);
  });
});
