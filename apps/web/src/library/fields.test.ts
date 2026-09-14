import { describe, expect, it } from "vitest";
import {
  claimOf,
  editingMeta,
  evaluateFormula,
  fieldKeys,
  formatNumber,
  inferMeta,
  inheritedMetas,
  readField,
  resolveMeta,
  splitOptions,
} from "./fields.ts";

describe("field types", () => {
  it("infers a number and a checkbox from a value, and text otherwise", () => {
    expect(inferMeta("12")).toEqual({ type: "number" });
    expect(inferMeta("-3.5")).toEqual({ type: "number" });
    expect(inferMeta("true")).toEqual({ type: "checkbox" });
    expect(inferMeta("wounded")).toEqual({ type: "text" });
    expect(inferMeta("1,100")).toEqual({ type: "text" });
  });

  it("resolves the sheet's own description first, then an inherited one, then inference", () => {
    const own = { hp: { type: "select" as const, options: ["a"] } };
    const inherited = {
      hp: { type: "checkbox" as const },
      ac: { type: "number" as const, unit: "AC" },
    };
    expect(resolveMeta("hp", "12", own, inherited).type).toBe("select");
    expect(resolveMeta("ac", "12", own, inherited)).toEqual({ type: "number", unit: "AC" });
    expect(resolveMeta("str", "18", own, inherited).type).toBe("number");
    expect(resolveMeta("name", "Varn", own, inherited).type).toBe("text");
  });

  it("lists a formula among the keys even though it stores no value", () => {
    expect(fieldKeys({ hp: "12" }, { to_hit: { type: "formula", expr: "hp" } })).toEqual([
      "hp",
      "to_hit",
    ]);
  });

  it("formats numbers for reading only", () => {
    expect(formatNumber(1100, { thousands: true })).toBe("1,100");
    expect(formatNumber(1100)).toBe("1100");
    expect(formatNumber(2.5, { decimals: 2 })).toBe("2.50");
    expect(formatNumber(2.345678)).toBe("2.345678");
  });

  it("splits a multi-select value and ignores blanks", () => {
    expect(splitOptions("ally, fence,, ")).toEqual(["ally", "fence"]);
  });
});

describe("evaluateFormula", () => {
  const fields = { level: "5", prof: "2", hp: "12", name: "Varn" };
  const meta = {
    to_hit: { type: "formula" as const, expr: "level + prof" },
    twice: { type: "formula" as const, expr: "to_hit * 2" },
    loop: { type: "formula" as const, expr: "loop + 1" },
  };

  it("reads fields by name with the four operations, precedence and parentheses", () => {
    expect(evaluateFormula("level + prof", fields, meta)).toEqual({ value: 7 });
    expect(evaluateFormula("level + prof * 2", fields, meta)).toEqual({ value: 9 });
    expect(evaluateFormula("(level + prof) * 2", fields, meta)).toEqual({ value: 14 });
    expect(evaluateFormula("-level + 10 / 4", fields, meta)).toEqual({ value: -2.5 });
  });

  it("follows a formula that refers to another, and stops a cycle", () => {
    expect(evaluateFormula("twice", fields, meta)).toEqual({ value: 14 });
    expect(evaluateFormula("loop", fields, meta).error).toMatch(/refers to itself/);
  });

  it("says what went wrong", () => {
    expect(evaluateFormula("name + 1", fields, meta).error).toBe("name is not a number");
    expect(evaluateFormula("hp + ac", fields, meta).error).toBe("no field named ac");
    expect(evaluateFormula("hp / 0", fields, meta).error).toBe("divided by zero");
    expect(evaluateFormula("(hp + 1", fields, meta).error).toBe("missing )");
    expect(evaluateFormula("hp +", fields, meta).error).toBe("formula ends early");
    expect(evaluateFormula("hp $ 2", fields, meta).error).toBe("cannot read the formula");
    expect(evaluateFormula("hp 2", fields, meta).error).toBe("unexpected 2");
  });
});

describe("readField", () => {
  const fields = { debt: "1100", status: "wounded", tags: "ally, fence", alive: "true", note: "" };
  const meta = {
    debt: { type: "number" as const, unit: "crowns", thousands: true },
    status: { type: "select" as const, options: ["alive", "wounded"] },
    tags: { type: "multiselect" as const, options: ["ally", "fence"] },
    alive: { type: "checkbox" as const },
    to_hit: { type: "formula" as const, expr: "debt / 100" },
  };

  it("reads each type into its shape", () => {
    expect(readField("debt", fields, meta)).toEqual({
      kind: "number",
      text: "1,100",
      unit: "crowns",
    });
    expect(readField("status", fields, meta)).toEqual({ kind: "select", option: "wounded" });
    expect(readField("tags", fields, meta)).toEqual({
      kind: "multiselect",
      options: ["ally", "fence"],
    });
    expect(readField("alive", fields, meta)).toEqual({ kind: "checkbox", checked: true });
    expect(readField("to_hit", fields, meta)).toEqual({
      kind: "formula",
      text: "11",
      error: null,
      expr: "debt / 100",
    });
    expect(readField("note", fields, meta)).toEqual({ kind: "empty" });
  });

  it("keeps a value the type cannot read, rather than hiding it", () => {
    expect(readField("debt", { debt: "lots" }, meta)).toEqual({
      kind: "number",
      text: "lots",
      unit: "crowns",
    });
  });
});

describe("models a sheet takes", () => {
  const character = {
    fields: { level: "1", hp: "" },
    meta: {
      level: { type: "number" as const },
      status: { type: "select" as const, options: ["alive"] },
    },
  };
  const merchant = {
    fields: { debt: "" },
    meta: { debt: { type: "number" as const, unit: "crowns" }, level: { type: "text" as const } },
  };

  it("folds their descriptions in the order taken, first claim winning", () => {
    expect(inheritedMetas([character, merchant])).toEqual({
      level: { type: "number" },
      hp: { type: "text" },
      status: { type: "select", options: ["alive"] },
      debt: { type: "number", unit: "crowns" },
    });
    expect(inheritedMetas([merchant, character])["level"]).toEqual({ type: "text" });
    expect(claimOf("debt", [character, merchant])).toBe(1);
    expect(claimOf("hideout", [character, merchant])).toBeNull();
    // A key the model never described reads as the model's own row reads it.
    expect(inheritedMetas([{ fields: { ac: "15", note: "" }, meta: undefined }])).toEqual({
      ac: { type: "number" },
      note: { type: "text" },
    });
  });

  it("lists a model's keys as rows and reads them by the model's type; the sheet's own wins", () => {
    const inherited = inheritedMetas([character, merchant]);
    expect(fieldKeys({ hideout: "Gullet" }, undefined, inherited)).toEqual([
      "debt",
      "hideout",
      "hp",
      "level",
      "status",
    ]);
    expect(readField("debt", { debt: "1100" }, undefined, inherited)).toEqual({
      kind: "number",
      text: "1100",
      unit: "crowns",
    });
    expect(readField("debt", { debt: "1100" }, { debt: { type: "text" } }, inherited)).toEqual({
      kind: "text",
      text: "1100",
    });
    expect(editingMeta("status", "", undefined, inherited).type).toBe("select");
  });

  it("lets a formula on the sheet name a field a model describes", () => {
    const inherited = inheritedMetas([
      { fields: {}, meta: { prof: { type: "formula", expr: "2" } } },
    ]);
    const meta = { to_hit: { type: "formula" as const, expr: "level + prof" } };
    expect(readField("to_hit", { level: "5" }, meta, inherited)).toMatchObject({
      kind: "formula",
      text: "7",
    });
  });
});
