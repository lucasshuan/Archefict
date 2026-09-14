import type { NodeType, Node as PmNode } from "prosemirror-model";
import { describe, expect, it } from "vitest";
import { createSheetAdapter } from "./schema.ts";
import { parseRaw, serializeRaw } from "./serialize.ts";

describe("serializeRaw", () => {
  const s = createSheetAdapter().schema;
  const type = (name: string): NodeType => {
    const found = s.nodes[name];
    if (!found) throw new Error(`schema has no node ${name}`);
    return found;
  };
  const mark = (name: string, attrs?: Record<string, unknown>) => {
    const found = s.marks[name];
    if (!found) throw new Error(`schema has no mark ${name}`);
    return found.create(attrs);
  };
  const p = (...content: PmNode[]) => type("paragraph").create(null, content);
  const context = {
    fields: { hp: "12", status: "wounded" },
    titleOf: (id: string) => (id === "s_2pv" ? "Mira Vance" : null),
  };

  it("writes blocks as Markdown and chips in the typed syntax", () => {
    const doc = type("doc").create(null, [
      type("heading").create({ level: 2 }, s.text("Varn")),
      p(
        s.text("He owes "),
        type("field").create({ sheet: "s_2pv", key: "debt", display: "value" }),
        s.text(" to "),
        type("ref").create({ sheet: "s_2pv" }),
        s.text(". Own: "),
        type("field").create({ key: "hp" }),
        s.text(" and "),
        type("field").create({ key: "status", display: "value" }),
        s.text("."),
      ),
      p(
        s.text("bold", [mark("strong")]),
        s.text(" and "),
        s.text("a link", [mark("link", { href: "https://x.y" })]),
      ),
      type("bullet_list").create(null, [
        type("list_item").create(null, [p(s.text("one"))]),
        type("list_item").create(null, [
          p(s.text("two")),
          type("bullet_list").create(null, [type("list_item").create(null, [p(s.text("two.a"))])]),
        ]),
      ]),
      type("blockquote").create(null, [p(s.text("quoted"))]),
      type("table").create(null, [
        type("table_row").create(null, [
          type("table_header").create(null, s.text("stat")),
          type("table_header").create(null, s.text("value")),
        ]),
        type("table_row").create(null, [
          type("table_cell").create(null, s.text("hp")),
          type("table_cell").create(null, s.text("12")),
        ]),
      ]),
      type("code_block").create(null, s.text("roll 2d6")),
    ]);

    const source = [
      "## Varn",
      "",
      "He owes {{Mira Vance|s_2pv.debt}} to [[Mira Vance|s_2pv]]. Own: [hp:: 12] and {{status}}.",
      "",
      "**bold** and [a link](https://x.y)",
      "",
      "- one",
      "- two",
      "",
      "  - two.a",
      "",
      "> quoted",
      "",
      "| stat | value |",
      "| --- | --- |",
      "| hp | 12 |",
      "",
      "```",
      "roll 2d6",
      "```",
      "",
    ].join("\n");

    expect(serializeRaw(doc, context)).toBe(source);
    const parsed = parseRaw(source, s);
    expect(parsed.doc.eq(doc)).toBe(true);
    expect([...parsed.fields]).toEqual([["hp", "12"]]);
  });

  it("names a sheet it cannot find by its id, and a missing field as empty", () => {
    const doc = type("doc").create(null, [
      p(type("ref").create({ sheet: "s_gone" }), type("field").create({ key: "nope" })),
    ]);
    expect(serializeRaw(doc, context)).toBe("[[s_gone|s_gone]][nope:: ]\n");
  });

  it("keeps incomplete raw syntax as editable prose and always returns a valid document", () => {
    const parsed = parseRaw("Editing [hp:: and {{status", s);
    expect(parsed.doc.textContent).toBe("Editing [hp:: and {{status");
    expect([...parsed.fields]).toEqual([]);

    expect(parseRaw("", s).doc.childCount).toBe(1);
  });
});
