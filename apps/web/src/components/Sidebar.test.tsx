import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CampaignSummary } from "../campaign/store.ts";
import { GUEST, Sidebar } from "./Sidebar.tsx";

const campaigns: CampaignSummary[] = [
  { url: "automerge:aaa" as CampaignSummary["url"], name: "Greyhaven", createdAt: 1 },
  { url: "automerge:bbb" as CampaignSummary["url"], name: "Tidewater", createdAt: 2 },
];

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  render(() => (
    <Sidebar
      campaigns={campaigns}
      activeUrl="automerge:aaa"
      user={GUEST}
      open={true}
      {...handlers}
      {...overrides}
    />
  ));
  return handlers;
}

describe("Sidebar", () => {
  afterEach(cleanup);

  it("lists campaigns and marks the active one", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "Greyhaven" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("button", { name: "Tidewater" }).getAttribute("aria-current")).toBe(
      null,
    );
    expect(screen.getByText("Guest player")).toBeTruthy();
  });

  it("creates a campaign with the typed name and clears the field", () => {
    const handlers = renderSidebar();
    const input = screen.getByLabelText("New campaign name") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Ashfall" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(handlers.onCreate).toHaveBeenCalledWith("Ashfall");
    expect(input.value).toBe("");
  });

  it("deletes only after confirmation", () => {
    const handlers = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Delete Tidewater" }));
    expect(handlers.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(handlers.onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Tidewater" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(handlers.onDelete).toHaveBeenCalledWith("automerge:bbb");
  });

  it("opens settings", () => {
    const handlers = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(handlers.onOpenSettings).toHaveBeenCalled();
  });
});
