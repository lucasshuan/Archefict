import type { FieldMeta } from "@archefict/schema";

/**
 * What a field is and how it reads (docs/sheets.md). Pure: no Solid, no Automerge. The value is
 * always a string; everything here is interpretation of it.
 *
 * Where a field's type comes from, first match wins:
 *   1. the sheet's own `meta[key]`;
 *   2. an inherited description — a folder schema, later; the slot is `inherited`;
 *   3. inferred from the value: a number is a number, `true`/`false` a checkbox;
 *   4. text.
 */

export type Fields = Readonly<Record<string, string>>;
export type Metas = Readonly<Record<string, FieldMeta>>;

const NUMBER = /^-?\d+(\.\d+)?$/;

export function inferMeta(value: string): FieldMeta {
  const trimmed = value.trim();
  if (NUMBER.test(trimmed)) return { type: "number" };
  if (trimmed === "true" || trimmed === "false") return { type: "checkbox" };
  return { type: "text" };
}

export function resolveMeta(
  key: string,
  value: string | undefined,
  meta: Metas | undefined,
  inherited?: Metas,
): FieldMeta {
  return meta?.[key] ?? inherited?.[key] ?? inferMeta(value ?? "");
}

/**
 * The type to edit under. Inference must not pull the control away mid-word: typing `true`
 * into a text well would make it a checkbox, which has no well. Explicit meta as it is;
 * inferred, but never to checkbox.
 */
export function editingMeta(
  key: string,
  value: string | undefined,
  meta: Metas | undefined,
  inherited?: Metas,
): FieldMeta {
  const explicit = meta?.[key] ?? inherited?.[key];
  if (explicit) return explicit;
  const inferred = inferMeta(value ?? "");
  return inferred.type === "checkbox" ? { type: "text" } : inferred;
}

/**
 * What the models a sheet takes say about its keys, folded in the order taken: the first to
 * claim a key wins. A key the model never described is read the way the model's own row reads
 * it — inferred from the model's value — so a `level: 1` on the model is a number on every
 * sheet that takes it.
 */
export function inheritedMetas(
  models: readonly { fields: Fields; meta: Metas | undefined }[],
): Metas {
  const out: Record<string, FieldMeta> = {};
  for (const model of models) {
    for (const key of fieldKeys(model.fields, model.meta)) {
      if (key in out) continue;
      out[key] = resolveMeta(key, model.fields[key], model.meta);
    }
  }
  return out;
}

/** Which model, by position in the list taken, first claims a key. Null when none does. */
export function claimOf(
  key: string,
  models: readonly { fields: Fields; meta: Metas | undefined }[],
): number | null {
  for (const [index, model] of models.entries()) {
    if (key in model.fields || key in (model.meta ?? {})) return index;
  }
  return null;
}

/**
 * Every key a sheet has: its values, its descriptions (a formula being description only), and
 * what the models it takes claim, so a taken model's fields appear as rows before anything is
 * typed into them.
 */
export function fieldKeys(fields: Fields, meta: Metas | undefined, inherited?: Metas): string[] {
  const keys = new Set(Object.keys(fields));
  for (const key of Object.keys(meta ?? {})) keys.add(key);
  for (const key of Object.keys(inherited ?? {})) keys.add(key);
  return [...keys].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Multi-select: several options in one string.
// ---------------------------------------------------------------------------

export function splitOptions(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function joinOptions(options: readonly string[]): string {
  return options.join(", ");
}

// ---------------------------------------------------------------------------
// Numbers: format for reading, never for storage.
// ---------------------------------------------------------------------------

export function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!NUMBER.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(
  value: number,
  options: { decimals?: number | undefined; thousands?: boolean | undefined } = {},
): string {
  const decimals = options.decimals;
  return new Intl.NumberFormat("en-US", {
    useGrouping: options.thousands ?? false,
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 6,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Formulas: the smallest language that reads `level + prof`. Grows when play asks.
// ---------------------------------------------------------------------------

export type FormulaResult = { value: number; error?: undefined } | { value: null; error: string };

const MAX_DEPTH = 8;

/**
 * `+ - * /`, parentheses, unary minus, numbers, and other fields by name. A field that is
 * itself a formula is evaluated in turn, to a depth that stops a cycle. Names follow the
 * field rule (`[A-Za-z_]\w*`); a hyphenated key cannot be told apart from a subtraction.
 */
export function evaluateFormula(
  expr: string,
  fields: Fields,
  meta: Metas | undefined,
  depth = 0,
): FormulaResult {
  if (depth > MAX_DEPTH) return { value: null, error: "formula refers to itself" };
  const tokens = tokenize(expr);
  if (tokens === null) return { value: null, error: "cannot read the formula" };
  let at = 0;
  const peek = () => tokens[at];
  const next = () => tokens[at++];

  const lookup = (name: string): FormulaResult => {
    const own = meta?.[name];
    if (own?.type === "formula") return evaluateFormula(own.expr, fields, meta, depth + 1);
    const raw = fields[name];
    if (raw === undefined) return { value: null, error: `no field named ${name}` };
    const parsed = parseNumber(raw);
    return parsed === null ? { value: null, error: `${name} is not a number` } : { value: parsed };
  };

  function primary(): FormulaResult {
    const token = next();
    if (token === undefined) return { value: null, error: "formula ends early" };
    if (token.kind === "number") return { value: token.value };
    if (token.kind === "name") return lookup(token.value);
    if (token.kind === "op" && token.value === "-") {
      const inner = primary();
      return inner.value === null ? inner : { value: -inner.value };
    }
    if (token.kind === "op" && token.value === "(") {
      const inner = sum();
      const close = next();
      if (close?.kind !== "op" || close.value !== ")") {
        return { value: null, error: "missing )" };
      }
      return inner;
    }
    return { value: null, error: `unexpected ${token.value}` };
  }

  function product(): FormulaResult {
    let left = primary();
    while (left.value !== null) {
      const token = peek();
      if (token?.kind !== "op" || (token.value !== "*" && token.value !== "/")) break;
      next();
      const right = primary();
      if (right.value === null) return right;
      if (token.value === "/" && right.value === 0)
        return { value: null, error: "divided by zero" };
      left = { value: token.value === "*" ? left.value * right.value : left.value / right.value };
    }
    return left;
  }

  function sum(): FormulaResult {
    let left = product();
    while (left.value !== null) {
      const token = peek();
      if (token?.kind !== "op" || (token.value !== "+" && token.value !== "-")) break;
      next();
      const right = product();
      if (right.value === null) return right;
      left = { value: token.value === "+" ? left.value + right.value : left.value - right.value };
    }
    return left;
  }

  const result = sum();
  if (result.value !== null && at < tokens.length) {
    return { value: null, error: `unexpected ${tokens[at]?.value ?? ""}` };
  }
  return result;
}

type Token =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "op"; value: string };

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([-+*/()]))/y;
  let at = 0;
  while (at < expr.length) {
    pattern.lastIndex = at;
    const match = pattern.exec(expr);
    if (!match) {
      return /^\s*$/.test(expr.slice(at)) ? tokens : null;
    }
    at = pattern.lastIndex;
    if (match[1] !== undefined) tokens.push({ kind: "number", value: Number(match[1]) });
    else if (match[2] !== undefined) tokens.push({ kind: "name", value: match[2] });
    else if (match[3] !== undefined) tokens.push({ kind: "op", value: match[3] });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Reading a field: one shape for the index row, the chip, and the model's view.
// ---------------------------------------------------------------------------

export type Reading =
  | { kind: "text"; text: string }
  | { kind: "number"; text: string; unit: string | null }
  | { kind: "select"; option: string | null }
  | { kind: "multiselect"; options: string[] }
  | { kind: "checkbox"; checked: boolean }
  | { kind: "date"; text: string }
  | { kind: "formula"; text: string | null; error: string | null; expr: string }
  | { kind: "empty" };

/** Nothing to show: no value, a select with no option picked, a multi-select with none. */
export function isBlank(reading: Reading): boolean {
  switch (reading.kind) {
    case "empty":
      return true;
    case "select":
      return reading.option === null;
    case "multiselect":
      return reading.options.length === 0;
    default:
      return false;
  }
}

export function readField(
  key: string,
  fields: Fields,
  meta: Metas | undefined,
  inherited?: Metas,
): Reading {
  const value = fields[key];
  const resolved = resolveMeta(key, value, meta, inherited);
  switch (resolved.type) {
    case "formula": {
      // A formula may name a field a model describes; the sheet's own descriptions still win.
      const all = inherited ? { ...inherited, ...meta } : meta;
      const result = evaluateFormula(resolved.expr, fields, all);
      return {
        kind: "formula",
        text: result.value === null ? null : formatNumber(result.value, { thousands: true }),
        error: result.error ?? null,
        expr: resolved.expr,
      };
    }
    case "number": {
      if (value === undefined || value.trim() === "") return { kind: "empty" };
      const parsed = parseNumber(value);
      return {
        kind: "number",
        text: parsed === null ? value : formatNumber(parsed, resolved),
        unit: resolved.unit ?? null,
      };
    }
    case "select":
      return { kind: "select", option: value?.trim() ? value.trim() : null };
    case "multiselect":
      return { kind: "multiselect", options: splitOptions(value ?? "") };
    case "checkbox":
      return { kind: "checkbox", checked: value?.trim() === "true" };
    case "date":
      return value?.trim() ? { kind: "date", text: value } : { kind: "empty" };
    default:
      return value?.trim() ? { kind: "text", text: value } : { kind: "empty" };
  }
}
