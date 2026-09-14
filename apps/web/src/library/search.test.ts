import type { Folder, SheetSummary } from "@archefict/schema";
import { describe, expect, it } from "vitest";
import { searchSheets } from "./search.ts";

function sheet(title: string, folderId: string | null = null): SheetSummary {
  return { id: title, title, folderId, order: 0, docUrl: `automerge:${title}`, createdAt: 0 };
}

function folder(id: string, title: string, parentId: string | null = null): Folder {
  return { id, title, parentId, order: 0 };
}

const folders = [folder("f1", "Characters"), folder("f2", "Allies", "f1")];

describe("searchSheets", () => {
  it("finds nothing for a blank query", () => {
    expect(searchSheets("", [sheet("Varn")], folders)).toEqual([]);
    expect(searchSheets("   ", [sheet("Varn")], folders)).toEqual([]);
  });

  it("ranks the whole name, then the start, then a word, then anywhere", () => {
    const sheets = [
      sheet("Dockside Watch"),
      sheet("The Gullet"),
      sheet("Gullet"),
      sheet("Gulletborn"),
      sheet("Regulleted"),
    ];
    expect(searchSheets("gullet", sheets, folders).map((hit) => hit.sheet.title)).toEqual([
      "Gullet",
      "Gulletborn",
      "The Gullet",
      "Regulleted",
    ]);
  });

  it("is case insensitive and trims the query", () => {
    expect(searchSheets("  VARN ", [sheet("Varn Ashgrove")], folders)).toHaveLength(1);
  });

  it("says which folders a hit came from, read from the root down", () => {
    const hits = searchSheets("varn", [sheet("Varn", "f2")], folders);
    expect(hits[0]?.where).toBe("Characters / Allies");
    expect(searchSheets("mira", [sheet("Mira")], folders)[0]?.where).toBe("");
  });

  it("survives a folder chain that loops or points at nothing", () => {
    const looped = [folder("a", "A", "b"), folder("b", "B", "a")];
    expect(searchSheets("varn", [sheet("Varn", "a")], looped)[0]?.where).toBe("B / A");
    expect(searchSheets("varn", [sheet("Varn", "gone")], folders)[0]?.where).toBe("");
  });

  it("breaks a tie by title", () => {
    const hits = searchSheets("a", [sheet("Ba"), sheet("Aa"), sheet("Ca")], folders);
    expect(hits.map((hit) => hit.sheet.title)).toEqual(["Aa", "Ba", "Ca"]);
  });
});
