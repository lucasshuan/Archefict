import type { NarrativeEntry } from "@archefict/schema";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { NarrativeFeed } from "./NarrativeFeed.tsx";

const entries: NarrativeEntry[] = [
  { id: "1", kind: "user", text: "I open the door.", createdAt: 1, provenance: { source: "user" } },
  { id: "2", kind: "ai", text: "It creaks.", createdAt: 2, provenance: { source: "ai" } },
];

describe("NarrativeFeed", () => {
  afterEach(cleanup);

  it("shows an empty state when nothing has happened", () => {
    render(() => <NarrativeFeed entries={[]} streamingText={null} />);
    expect(screen.getByText(/The story has not started/)).toBeTruthy();
  });

  it("renders entries and the reply being streamed", () => {
    render(() => <NarrativeFeed entries={entries} streamingText="A cold draft" />);
    expect(screen.getByText("I open the door.")).toBeTruthy();
    expect(screen.getByText("It creaks.")).toBeTruthy();
    expect(screen.getByText(/A cold draft/)).toBeTruthy();
    expect(screen.queryByText(/The story has not started/)).toBeNull();
  });
});
