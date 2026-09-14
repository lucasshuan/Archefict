import * as A from "@automerge/automerge";
import { pmDocFromSpans, pmNodeToSpans, type SchemaAdapter } from "@automerge/prosemirror";
import { Fragment, type NodeType, type Node as PmNode } from "prosemirror-model";
import { describe, expect, it } from "vitest";
import { createSheetAdapter } from "./schema.ts";

/**
 * The sheet schema against a real Automerge document: ProseMirror doc to spans, spans into a
 * document, spans out, back to a doc. What comes back must be what went in, for every part
 * the schema adds — tables, field chips, refs — and the one part it must never lose: a block
 * type it does not know (docs/sheets.md, the preservation contract).
 */

type Json = { type: string; attrs?: Record<string, unknown>; content?: Json[]; text?: string };

/** The binding decorates every node with its own bookkeeping attrs. Not part of the content. */
function strip(node: Json): Json {
  const out: Json = { type: node.type };
  if (node.text !== undefined) out.text = node.text;
  if (node.attrs) {
    const attrs = Object.fromEntries(
      Object.entries(node.attrs).filter(
        ([key]) => key !== "isAmgBlock" && key !== "unknownAttrs" && key !== "unknownBlock",
      ),
    );
    if (Object.keys(attrs).length > 0) out.attrs = attrs;
  }
  if (node.content) out.content = node.content.map(strip);
  return out;
}

function roundTrip(adapter: SchemaAdapter, doc: PmNode): PmNode {
  const spans = pmNodeToSpans(adapter, doc) as unknown as A.Span[];
  let am = A.from<{ body: string }>({ body: "" });
  am = A.change(am, (d) => A.updateSpans(d, ["body"], spans));
  return pmDocFromSpans(adapter, A.spans(am, ["body"]));
}

function expectRoundTrip(adapter: SchemaAdapter, doc: PmNode): void {
  const back = roundTrip(adapter, doc);
  expect(strip(back.toJSON() as Json)).toEqual(strip(doc.toJSON() as Json));
}

describe("sheet schema round trip", () => {
  const adapter = createSheetAdapter();
  const s = adapter.schema;
  const type = (name: string): NodeType => {
    const found = s.nodes[name];
    if (!found) throw new Error(`schema has no node ${name}`);
    return found;
  };
  const text = (value: string) => (value ? s.text(value) : null);
  const p = (value: string) => type("paragraph").create(null, text(value));
  const cell = (value: string) => type("table_cell").create(null, text(value));
  const head = (value: string) => type("table_header").create(null, text(value));
  const row = (...cells: PmNode[]) => type("table_row").create(null, cells);
  const table = (...rows: PmNode[]) => type("table").create(null, rows);
  const doc = (...blocks: PmNode[]) => type("doc").create(null, blocks);

  it("keeps a table with a header row, and prose on both sides", () => {
    expectRoundTrip(
      adapter,
      doc(
        p("before"),
        table(
          row(head("stat"), head("value")),
          row(cell("hp"), cell("12")),
          row(cell("ac"), cell("")),
        ),
        p("after"),
      ),
    );
  });

  it("keeps two tables apart when a paragraph sits between them", () => {
    expectRoundTrip(adapter, doc(table(row(cell("a"), cell("b"))), p(""), table(row(cell("c")))));
  });

  it("keeps a table whose first cell is empty", () => {
    expectRoundTrip(adapter, doc(table(row(cell(""), cell("x")), row(cell("y"), cell("")))));
  });

  it("keeps a header row whose first header is empty, and an all-empty row", () => {
    expectRoundTrip(
      adapter,
      doc(table(row(head(""), head("b")), row(cell(""), cell("")), row(cell("z"), cell("")))),
    );
  });

  it("keeps field and ref chips inline with their attributes", () => {
    expectRoundTrip(
      adapter,
      doc(
        type("paragraph").create(null, [
          s.text("He owes "),
          type("field").create({ sheet: "s_2pv", key: "debt", display: "value" }),
          s.text(" crowns to "),
          type("ref").create({ sheet: "s_2pv" }),
          s.text(". Own field: "),
          type("field").create({ key: "hp" }),
        ]),
      ),
    );
  });

  it("keeps a nested list, as before", () => {
    const item = (value: string, ...rest: PmNode[]) =>
      type("list_item").create(null, [p(value), ...rest]);
    expectRoundTrip(
      adapter,
      doc(
        type("bullet_list").create(null, [
          item("one", type("bullet_list").create(null, [item("one.a")])),
          item("two"),
        ]),
      ),
    );
  });

  it("keeps a block type it has never heard of, with its attributes", () => {
    const foreign: A.Span[] = [
      {
        type: "block",
        value: {
          type: new A.ImmutableString("plugin:widget"),
          parents: [],
          attrs: { kind: new A.ImmutableString("dice"), v: 1 },
          isEmbed: false,
        },
      },
      { type: "text", value: "roll 2d6" },
      {
        type: "block",
        value: { type: new A.ImmutableString("paragraph"), parents: [], attrs: {}, isEmbed: false },
      },
      { type: "text", value: "then prose" },
    ];
    let am = A.from<{ body: string }>({ body: "" });
    am = A.change(am, (d) => A.updateSpans(d, ["body"], foreign));

    // Open it with a schema that lacks the block, edit elsewhere, write it back.
    const opened = pmDocFromSpans(adapter, A.spans(am, ["body"]));
    expect(opened.child(0).type.name).toBe("unknownBlock");
    const edited = opened.copy(opened.content.append(Fragment.from(p("edited"))));
    const back = pmNodeToSpans(adapter, edited) as unknown as A.Span[];
    am = A.change(am, (d) => A.updateSpans(d, ["body"], back));

    const spans = A.spans(am, ["body"]);
    const survived = spans.find(
      (span) => span.type === "block" && String(span.value["type"]) === "plugin:widget",
    );
    expect(survived).toBeDefined();
    const attrs = (survived as { value: Record<string, unknown> }).value["attrs"] as Record<
      string,
      unknown
    >;
    expect(String(attrs["kind"])).toBe("dice");
    expect(attrs["v"]).toBe(1);
    expect(spans.some((span) => span.type === "text" && span.value === "edited")).toBe(true);
  });
});
