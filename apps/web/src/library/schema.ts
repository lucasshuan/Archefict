import { ImmutableString } from "@automerge/automerge";
import { type MappedSchemaSpec, SchemaAdapter } from "@automerge/prosemirror";
import type { Attrs, Node as PmNode } from "prosemirror-model";
import { tableNodes } from "prosemirror-tables";

/**
 * The sheet schema: what a body may contain, and how each part is stored in Automerge.
 *
 * Starts from the binding's basic schema (paragraphs, headings, lists, quotes, code, images,
 * the link/em/strong/code marks) and adds what a sheet needs (docs/sheets.md):
 *
 * - `table`, `table_row`, `table_cell`, `table_header` from prosemirror-tables. A cell is a
 *   textblock (`inline*`), not a box of paragraphs, and that is what makes tables storable:
 *   Automerge holds a flat run of block markers, each carrying its `parents`, and the binding
 *   only emits a marker for a container when the container has a textblock child. A row of
 *   textblock cells emits a row marker; cells after the first emit cell markers with the row
 *   and table as parents; the table wrapper is rebuilt from those parents, the way a bullet
 *   list is rebuilt around its items.
 * - `field`: an inline chip bound to a field on this sheet (`sheet: null`) or on another one.
 *   The value is never in the node — the node is a placement; the map is the store.
 * - `ref`: an inline chip pointing at another sheet.
 *
 * Both chips are embeds: an atom with attributes, stored the way the image node is. Their
 * attributes are `ImmutableString`s so Automerge keeps them as plain values rather than
 * collaborative text.
 *
 * `unknownBlock` is designated on purpose: a block type this schema has never heard of — a
 * plugin's, or a newer client's — survives a round trip through this editor instead of being
 * dropped. The binding refuses to start without one; naming it here makes it a decision.
 *
 * Block type names are the core namespace and carry no prefix. Plugin node types will.
 */

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

/** colspan, rowspan and colwidth travel as they are; prosemirror-tables owns their meaning. */
const cellParsers = {
  fromAutomerge: (block: { attrs: Record<string, unknown> }): Attrs => ({
    colspan: int(block.attrs["colspan"], 1),
    rowspan: int(block.attrs["rowspan"], 1),
    colwidth: Array.isArray(block.attrs["colwidth"]) ? block.attrs["colwidth"].map(Number) : null,
  }),
  fromProsemirror: (node: PmNode) => ({
    colspan: node.attrs["colspan"] as number,
    rowspan: node.attrs["rowspan"] as number,
    colwidth: (node.attrs["colwidth"] as number[] | null) ?? null,
  }),
};

const tables = tableNodes({ tableGroup: "block", cellContent: "inline*", cellAttributes: {} });

const spec: MappedSchemaSpec = {
  nodes: {
    doc: { content: "block+" },

    paragraph: {
      automerge: { block: "paragraph" },
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },

    unknownBlock: {
      automerge: { unknownBlock: true },
      group: "block",
      content: "block+",
      parseDOM: [{ tag: "div", attrs: { "data-unknown-block": "true" } }],
      toDOM: () => ["div", { "data-unknown-block": "true" }, 0],
    },

    blockquote: {
      automerge: { block: "blockquote" },
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "blockquote" }],
      toDOM: () => ["blockquote", 0],
    },

    horizontal_rule: {
      group: "block",
      parseDOM: [{ tag: "hr" }],
      toDOM: () => ["hr"],
    },

    heading: {
      automerge: {
        block: "heading",
        attrParsers: {
          fromAutomerge: (block) => ({ level: int(block.attrs["level"], 1) }),
          fromProsemirror: (node) => ({ level: node.attrs["level"] as number }),
        },
      },
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
      toDOM: (node) => [`h${node.attrs["level"]}`, 0],
    },

    code_block: {
      automerge: { block: "code-block" },
      content: "text*",
      marks: "",
      group: "block",
      code: true,
      defining: true,
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
      toDOM: () => ["pre", ["code", 0]],
    },

    text: { group: "inline" },

    image: {
      automerge: {
        block: "image",
        isEmbed: true,
        attrParsers: {
          fromAutomerge: (block) => ({
            src: str(block.attrs["src"]) || null,
            alt: block.attrs["alt"] ?? null,
            title: block.attrs["title"] ?? null,
          }),
          fromProsemirror: (node) => ({
            src: new ImmutableString(str(node.attrs["src"])),
            alt: node.attrs["alt"] ?? null,
            title: node.attrs["title"] ?? null,
          }),
        },
      },
      inline: true,
      attrs: { src: {}, alt: { default: null }, title: { default: null } },
      group: "inline",
      draggable: true,
      parseDOM: [
        {
          tag: "img[src]",
          getAttrs: (dom) => ({
            src: dom.getAttribute("src"),
            title: dom.getAttribute("title"),
            alt: dom.getAttribute("alt"),
          }),
        },
      ],
      toDOM: (node) => {
        const { src, alt, title } = node.attrs;
        return ["img", { src, alt, title }];
      },
    },

    ordered_list: {
      group: "block",
      content: "list_item+",
      attrs: { order: { default: 1 } },
      parseDOM: [
        {
          tag: "ol",
          getAttrs: (dom) => ({
            order: dom.hasAttribute("start") ? Number(dom.getAttribute("start")) : 1,
          }),
        },
      ],
      toDOM: (node) =>
        node.attrs["order"] === 1 ? ["ol", 0] : ["ol", { start: node.attrs["order"] }, 0],
    },

    bullet_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM: () => ["ul", 0],
    },

    list_item: {
      automerge: {
        block: {
          within: { ordered_list: "ordered-list-item", bullet_list: "unordered-list-item" },
        },
      },
      content: "paragraph block*",
      parseDOM: [{ tag: "li" }],
      toDOM: () => ["li", 0],
      defining: true,
    },

    aside: {
      automerge: { block: "aside" },
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "aside" }],
      toDOM: () => ["aside", 0],
    },

    // Tables. See the note at the top for why a cell is a textblock.
    table: { ...tables["table"], automerge: { block: "table" } },
    // The binding leaves a container's *first* child implicit when it is the container's
    // default type — a list item's first paragraph has no marker of its own — and an implicit
    // child with no text in it is nothing at all: an empty first cell would vanish. `cell_slot`
    // exists only to be the row's default type instead. It is never created; it just makes
    // every real cell explicit, so an empty one survives. It has to be the first alternative
    // of the same group: as an optional prefix (`cell_slot? …`) the DFA still lists the cell
    // first and the default stays the cell.
    cell_slot: { atom: true, toDOM: () => ["span", { "data-cell-slot": "true" }] },
    table_row: {
      ...tables["table_row"],
      content: "(cell_slot | table_cell | table_header)*",
      automerge: { block: "table-row" },
    },
    table_cell: {
      ...tables["table_cell"],
      automerge: { block: "table-cell", attrParsers: cellParsers },
    },
    table_header: {
      ...tables["table_header"],
      automerge: { block: "table-header", attrParsers: cellParsers },
    },

    // A placement of a field. `sheet` null means this sheet; `display` is how the chip reads.
    field: {
      automerge: {
        block: "field",
        isEmbed: true,
        attrParsers: {
          fromAutomerge: (block) => ({
            sheet: str(block.attrs["sheet"]) || null,
            key: str(block.attrs["key"]),
            display: block.attrs["display"] === "value" ? "value" : "pair",
          }),
          fromProsemirror: (node) => ({
            sheet: node.attrs["sheet"] ? new ImmutableString(str(node.attrs["sheet"])) : null,
            key: new ImmutableString(str(node.attrs["key"])),
            display: new ImmutableString(str(node.attrs["display"])),
          }),
        },
      },
      inline: true,
      group: "inline",
      atom: true,
      selectable: true,
      draggable: true,
      attrs: { sheet: { default: null }, key: {}, display: { default: "pair" } },
      parseDOM: [
        {
          tag: "span[data-field]",
          getAttrs: (dom) => ({
            key: dom.getAttribute("data-field"),
            sheet: dom.getAttribute("data-sheet"),
            display: dom.getAttribute("data-display") === "value" ? "value" : "pair",
          }),
        },
      ],
      toDOM: (node) => [
        "span",
        {
          "data-field": node.attrs["key"],
          "data-sheet": node.attrs["sheet"] ?? undefined,
          "data-display": node.attrs["display"],
          class: "chip",
        },
        String(node.attrs["key"]),
      ],
    },

    // A reference to another sheet.
    ref: {
      automerge: {
        block: "ref",
        isEmbed: true,
        attrParsers: {
          fromAutomerge: (block) => ({ sheet: str(block.attrs["sheet"]) }),
          fromProsemirror: (node) => ({ sheet: new ImmutableString(str(node.attrs["sheet"])) }),
        },
      },
      inline: true,
      group: "inline",
      atom: true,
      selectable: true,
      draggable: true,
      attrs: { sheet: {} },
      parseDOM: [
        {
          tag: "span[data-ref]",
          getAttrs: (dom) => ({ sheet: dom.getAttribute("data-ref") }),
        },
      ],
      toDOM: (node) => ["span", { "data-ref": node.attrs["sheet"], class: "chip" }, "ref"],
    },
  },

  marks: {
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs: (dom) => ({ href: dom.getAttribute("href"), title: dom.getAttribute("title") }),
        },
      ],
      toDOM: (mark) => ["a", { href: mark.attrs["href"], title: mark.attrs["title"] }, 0],
      automerge: {
        markName: "link",
        parsers: {
          fromAutomerge: (mark) => {
            if (typeof mark === "string") {
              try {
                const value: unknown = JSON.parse(mark);
                if (typeof value === "object" && value !== null) {
                  const { href, title } = value as { href?: unknown; title?: unknown };
                  return { href: str(href), title: str(title) };
                }
              } catch {
                // Not JSON: an older or foreign link value. Fall through to an empty link.
              }
            }
            return { href: "", title: "" };
          },
          fromProsemirror: (mark) =>
            JSON.stringify({ href: mark.attrs["href"], title: mark.attrs["title"] }),
        },
      },
    },
    em: {
      parseDOM: [
        { tag: "i" },
        { tag: "em" },
        { style: "font-style=italic" },
        { style: "font-style=normal", clearMark: (m) => m.type.name === "em" },
      ],
      toDOM: () => ["em", 0],
      automerge: { markName: "em" },
    },
    strong: {
      parseDOM: [
        { tag: "strong" },
        { tag: "b", getAttrs: (node) => node.style.fontWeight !== "normal" && null },
        { style: "font-weight=400", clearMark: (m) => m.type.name === "strong" },
        {
          style: "font-weight",
          getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        },
      ],
      toDOM: () => ["strong", 0],
      automerge: { markName: "strong" },
    },
    code: {
      parseDOM: [{ tag: "code" }],
      toDOM: () => ["code", 0],
      automerge: { markName: "code" },
    },
  },
};

/** One adapter per editor is fine; the schema inside is immutable. */
export function createSheetAdapter(): SchemaAdapter {
  return new SchemaAdapter(spec);
}
