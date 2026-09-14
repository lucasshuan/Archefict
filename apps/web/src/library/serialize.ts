import { marked as markdown, type Token, type Tokens } from "marked";
import type { Mark, Node as PmNode, Schema } from "prosemirror-model";

/**
 * The raw form of a sheet body (docs/sheets.md, view 3): what was typed, as text. Blocks are
 * Markdown; a placed field is `[key:: value]`, a read is `{{key}}`, another sheet's field is
 * `{{Title|id.key}}`, a reference is `[[Title|id]]`. The model's view of a sheet is this same
 * text under a header, so there is one syntax to learn, not two.
 *
 * `parseRaw` is the inverse used by the editable raw view. Keep both directions in this file:
 * every syntax added to one must be added to the other and covered by a round-trip test.
 */
export type SerializeContext = {
  /** This sheet's fields, for the value inside `[key:: value]`. */
  fields: Readonly<Record<string, string>>;
  titleOf: (id: string) => string | null;
};

export function serializeRaw(doc: PmNode, context: SerializeContext): string {
  return `${blocks(doc, context).join("\n\n")}\n`;
}

export type ParsedRaw = {
  doc: PmNode;
  /** Values written by `[key:: value]`; reads such as `{{key}}` do not create fields. */
  fields: ReadonlyMap<string, string>;
};

/** Turns the source view back into the same schema the rendered editor uses. */
export function parseRaw(source: string, schema: Schema): ParsedRaw {
  const fields = new Map<string, string>();
  const content = parseBlocks(markdown.lexer(source), schema, fields);
  const paragraph = schema.nodes["paragraph"];
  if (!paragraph) throw new Error("sheet schema has no paragraph");
  return {
    doc: schema.topNodeType.create(null, content.length > 0 ? content : [paragraph.create()]),
    fields,
  };
}

function blocks(parent: PmNode, context: SerializeContext): string[] {
  const out: string[] = [];
  parent.forEach((node) => {
    out.push(block(node, context));
  });
  return out;
}

function block(node: PmNode, context: SerializeContext): string {
  switch (node.type.name) {
    case "paragraph":
      return inline(node, context);
    case "heading":
      return `${"#".repeat(Number(node.attrs["level"]) || 1)} ${inline(node, context)}`;
    case "blockquote":
    case "aside":
      return prefixLines(blocks(node, context).join("\n\n"), "> ");
    case "code_block":
      return `\`\`\`\n${node.textContent}\n\`\`\``;
    case "horizontal_rule":
      return "---";
    case "bullet_list":
      return list(node, context, () => "- ");
    case "ordered_list": {
      const start = Number(node.attrs["order"]) || 1;
      return list(node, context, (index) => `${start + index}. `);
    }
    case "table":
      return table(node, context);
    case "unknownBlock": {
      const kind = String(
        node.attrs["unknownParentBlock"] ?? node.attrs["unknownBlock"]?.type ?? "unknown",
      );
      return `::: ${kind}\n${blocks(node, context).join("\n\n")}\n:::`;
    }
    default:
      return node.isTextblock ? inline(node, context) : blocks(node, context).join("\n\n");
  }
}

function list(node: PmNode, context: SerializeContext, marker: (index: number) => string): string {
  const items: string[] = [];
  node.forEach((item, _offset, index) => {
    const lead = marker(index);
    const parts = blocks(item, context);
    const [first = "", ...rest] = parts;
    const body = [first, ...rest.map((part) => prefixLines(part, " ".repeat(lead.length)))];
    items.push(`${lead}${body.join("\n\n")}`);
  });
  return items.join("\n");
}

function table(node: PmNode, context: SerializeContext): string {
  const rows: string[] = [];
  node.forEach((row, _offset, index) => {
    const cells: string[] = [];
    let allHeaders = row.childCount > 0;
    row.forEach((cell) => {
      if (cell.type.name !== "table_header") allHeaders = false;
      cells.push(inline(cell, context).replace(/\|/g, "\\|"));
    });
    rows.push(`| ${cells.join(" | ")} |`);
    if (index === 0 && allHeaders) rows.push(`| ${cells.map(() => "---").join(" | ")} |`);
  });
  return rows.join("\n");
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line === "" ? prefix.trimEnd() : prefix + line))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Inline content: text with marks, and the chips.
// ---------------------------------------------------------------------------

function inline(node: PmNode, context: SerializeContext): string {
  let out = "";
  let run = "";
  let runMarks: readonly Mark[] = [];

  const flush = () => {
    if (run !== "") out += marked(run, runMarks);
    run = "";
    runMarks = [];
  };

  node.forEach((child) => {
    if (child.isText) {
      const text = child.text ?? "";
      if (run !== "" && !sameMarks(runMarks, child.marks)) flush();
      runMarks = child.marks;
      run += text;
      return;
    }
    flush();
    out += leaf(child, context);
  });
  flush();
  return out;
}

function sameMarks(a: readonly Mark[], b: readonly Mark[]): boolean {
  return a.length === b.length && a.every((mark, index) => mark.eq(b[index] as Mark));
}

/** Marks nest from the outside in the order the schema lists them: link, em, strong, code. */
function marked(text: string, marks: readonly Mark[]): string {
  let out = text;
  const has = (name: string) => marks.find((mark) => mark.type.name === name);
  if (has("code")) out = `\`${out}\``;
  if (has("strong")) out = `**${out}**`;
  if (has("em")) out = `*${out}*`;
  const link = has("link");
  if (link) out = `[${out}](${String(link.attrs["href"] ?? "")})`;
  return out;
}

function leaf(node: PmNode, context: SerializeContext): string {
  switch (node.type.name) {
    case "field": {
      const key = String(node.attrs["key"]);
      const sheet = node.attrs["sheet"] as string | null;
      if (sheet) return `{{${context.titleOf(sheet) ?? sheet}|${sheet}.${key}}}`;
      if (node.attrs["display"] === "value") return `{{${key}}}`;
      return `[${key}:: ${context.fields[key] ?? ""}]`;
    }
    case "ref": {
      const sheet = String(node.attrs["sheet"]);
      return `[[${context.titleOf(sheet) ?? sheet}|${sheet}]]`;
    }
    case "image":
      return `![${String(node.attrs["alt"] ?? "")}](${String(node.attrs["src"] ?? "")})`;
    case "hard_break":
      return "\n";
    default:
      return node.textContent;
  }
}

// ---------------------------------------------------------------------------
// Raw source back into ProseMirror.
// ---------------------------------------------------------------------------

function parseBlocks(
  tokens: readonly Token[],
  schema: Schema,
  fields: Map<string, string>,
): PmNode[] {
  const out: PmNode[] = [];
  const node = (name: string) => {
    const found = schema.nodes[name];
    if (!found) throw new Error(`sheet schema has no node ${name}`);
    return found;
  };

  for (const token of tokens) {
    switch (token.type) {
      case "space":
      case "def":
        break;
      case "paragraph": {
        const paragraph = token as Tokens.Paragraph;
        out.push(node("paragraph").create(null, parseInline(paragraph.tokens, schema, fields)));
        break;
      }
      case "text": {
        const text = token as Tokens.Text;
        out.push(
          node("paragraph").create(null, parseInline(text.tokens ?? [text], schema, fields)),
        );
        break;
      }
      case "heading": {
        const heading = token as Tokens.Heading;
        out.push(
          node("heading").create(
            { level: heading.depth },
            parseInline(heading.tokens, schema, fields),
          ),
        );
        break;
      }
      case "blockquote": {
        const quote = token as Tokens.Blockquote;
        const content = parseBlocks(quote.tokens, schema, fields);
        out.push(
          node("blockquote").create(
            null,
            content.length > 0 ? content : [node("paragraph").create()],
          ),
        );
        break;
      }
      case "code": {
        const code = token as Tokens.Code;
        out.push(
          node("code_block").create(null, code.text === "" ? undefined : schema.text(code.text)),
        );
        break;
      }
      case "hr":
        out.push(node("horizontal_rule").create());
        break;
      case "list": {
        const list = token as Tokens.List;
        const itemType = node("list_item");
        const paragraphType = node("paragraph");
        const items = list.items.map((item) => {
          const content = parseBlocks(item.tokens, schema, fields);
          if (content[0]?.type !== paragraphType) content.unshift(paragraphType.create());
          return itemType.create(null, content);
        });
        const attrs = list.ordered
          ? { order: typeof list.start === "number" ? list.start : 1 }
          : null;
        out.push(node(list.ordered ? "ordered_list" : "bullet_list").create(attrs, items));
        break;
      }
      case "table": {
        const table = token as Tokens.Table;
        const rowType = node("table_row");
        const headerType = node("table_header");
        const cellType = node("table_cell");
        const header = rowType.create(
          null,
          table.header.map((cell) =>
            headerType.create(null, parseInline(cell.tokens, schema, fields)),
          ),
        );
        const rows = table.rows.map((row) =>
          rowType.create(
            null,
            row.map((cell) => cellType.create(null, parseInline(cell.tokens, schema, fields))),
          ),
        );
        out.push(node("table").create(null, [header, ...rows]));
        break;
      }
      default: {
        // HTML and extensions this client does not understand stay visible as literal source.
        // That is safer than silently dropping them during a raw edit.
        const raw = token.raw ?? "";
        if (raw !== "") out.push(node("paragraph").create(null, schema.text(raw)));
      }
    }
  }
  return out;
}

function parseInline(
  tokens: readonly Token[],
  schema: Schema,
  fields: Map<string, string>,
  marks: readonly Mark[] = [],
): PmNode[] {
  const out: PmNode[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const text = token as Tokens.Text;
        if (text.tokens && text.tokens.length > 0) {
          out.push(...parseInline(text.tokens, schema, fields, marks));
        } else {
          out.push(...parseInlineText(text.text, schema, fields, marks));
        }
        break;
      }
      case "escape":
        out.push(...textNode((token as Tokens.Escape).text, schema, marks));
        break;
      case "strong":
      case "em": {
        const markedToken = token as Tokens.Strong | Tokens.Em;
        const mark = schema.marks[token.type];
        out.push(
          ...parseInline(
            markedToken.tokens,
            schema,
            fields,
            mark ? [...marks, mark.create()] : marks,
          ),
        );
        break;
      }
      case "codespan": {
        const code = schema.marks["code"];
        out.push(
          ...textNode(
            (token as Tokens.Codespan).text,
            schema,
            code ? [...marks, code.create()] : marks,
          ),
        );
        break;
      }
      case "link": {
        const linkToken = token as Tokens.Link;
        const link = schema.marks["link"];
        out.push(
          ...parseInline(
            linkToken.tokens,
            schema,
            fields,
            link
              ? [...marks, link.create({ href: linkToken.href, title: linkToken.title ?? null })]
              : marks,
          ),
        );
        break;
      }
      case "image": {
        const image = token as Tokens.Image;
        const type = schema.nodes["image"];
        if (type) out.push(type.create({ src: image.href, alt: image.text, title: image.title }));
        break;
      }
      case "br": {
        const br = schema.nodes["hard_break"];
        if (br) out.push(br.create());
        break;
      }
      default: {
        const nested = "tokens" in token ? token.tokens : undefined;
        if (nested && nested.length > 0) out.push(...parseInline(nested, schema, fields, marks));
        else out.push(...parseInlineText(token.raw ?? "", schema, fields, marks));
      }
    }
  }
  return out;
}

const KEY = "[A-Za-z_][\\w-]*";
const RAW_INLINE = new RegExp(
  `\\[(${KEY})::\\s*([^\\]]*)\\]` +
    `|\\{\\{([^|{}]+)\\|([^|{}]+)\\.(${KEY})\\}\\}` +
    `|\\{\\{(${KEY})\\}\\}` +
    `|\\[\\[([^|\\]]+)\\|([^\\]]+)\\]\\]`,
  "g",
);

function parseInlineText(
  text: string,
  schema: Schema,
  fields: Map<string, string>,
  marks: readonly Mark[],
): PmNode[] {
  const out: PmNode[] = [];
  let at = 0;
  for (const match of text.matchAll(RAW_INLINE)) {
    const index = match.index;
    if (index > at) out.push(...textNode(text.slice(at, index), schema, marks));

    const pairKey = match[1];
    const foreignSheet = match[4];
    const foreignKey = match[5];
    const ownKey = match[6];
    const refSheet = match[8];
    const field = schema.nodes["field"];
    const ref = schema.nodes["ref"];
    if (pairKey && field) {
      fields.set(pairKey, (match[2] ?? "").trim());
      out.push(field.create({ key: pairKey, display: "pair" }));
    } else if (foreignSheet && foreignKey && field) {
      out.push(field.create({ sheet: foreignSheet, key: foreignKey, display: "value" }));
    } else if (ownKey && field) {
      out.push(field.create({ key: ownKey, display: "value" }));
    } else if (refSheet && ref) {
      out.push(ref.create({ sheet: refSheet }));
    } else {
      out.push(...textNode(match[0], schema, marks));
    }
    at = index + match[0].length;
  }
  if (at < text.length) out.push(...textNode(text.slice(at), schema, marks));
  return out;
}

function textNode(text: string, schema: Schema, marks: readonly Mark[]): PmNode[] {
  return text === "" ? [] : [schema.text(text, marks)];
}
