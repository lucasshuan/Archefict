/**
 * @archefict/schema
 *
 * Shared, validated shapes. One definition feeds runtime validation, TypeScript types,
 * and (later) JSON Schema for LLM tools and plugin manifests.
 *
 * Kernel note: fictional campaign time is deliberately absent here. Entries carry a
 * wall-clock `createdAt` for ordering only. Campaign time is its own type, added when the
 * timeline needs it (ROADMAP Slice 3).
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Provenance: every change records who made it. Kernel primitive.
// ---------------------------------------------------------------------------

export const ProvenanceSource = z.enum(["user", "ai", "system"]);
export type ProvenanceSource = z.infer<typeof ProvenanceSource>;

export const TokenUsage = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
});
export type TokenUsage = z.infer<typeof TokenUsage>;

export const Provenance = z.object({
  source: ProvenanceSource,
  /** Model id in `provider/model` form when source is "ai". */
  model: z.string().optional(),
  /** Groups every change made by one user action or one AI turn. Undo unit. */
  turnId: z.string().optional(),
  usage: TokenUsage.optional(),
});
export type Provenance = z.infer<typeof Provenance>;

// ---------------------------------------------------------------------------
// Narrative timeline entry. The story feed. Meta chat is a separate channel (later).
// ---------------------------------------------------------------------------

export const EntryKind = z.enum(["user", "ai", "system"]);
export type EntryKind = z.infer<typeof EntryKind>;

export const NarrativeEntry = z.object({
  id: z.string().min(1),
  kind: EntryKind,
  /** Editable Markdown source. Rendering is sanitized at the UI boundary. */
  text: z.string(),
  /** Wall-clock milliseconds. Ordering only; not campaign time. */
  createdAt: z.number().int().nonnegative(),
  /** Wall-clock milliseconds of the last text edit, if any. */
  editedAt: z.number().int().nonnegative().optional(),
  provenance: Provenance,
});
export type NarrativeEntry = z.infer<typeof NarrativeEntry>;

// ---------------------------------------------------------------------------
// Conversation. One thread of play. The campaign index lists them; each one's entries
// live in their own document so a long conversation never weighs on the others.
// ---------------------------------------------------------------------------

export const Conversation = z.object({
  id: z.string().min(1),
  title: z.string(),
  /** Automerge url of the document holding this conversation's entries. */
  docUrl: z.string().min(1),
  /** Wall-clock milliseconds. Ordering only. */
  createdAt: z.number().int().nonnegative(),
  /** Set when the conversation was put away. Archived, not deleted: restoring is one click. */
  archivedAt: z.number().int().nonnegative().optional(),
});
export type Conversation = z.infer<typeof Conversation>;

// ---------------------------------------------------------------------------
// Library: folders and sheets. Records in the campaign index; a sheet's body and fields
// live in their own document, `sheet:<id>`. Folders are their own entity and hold folders
// and sheets; a sheet holds nothing (docs/workspace.md).
// ---------------------------------------------------------------------------

export const Folder = z.object({
  id: z.string().min(1),
  title: z.string(),
  /** The folder this one sits in, or null at the root. */
  parentId: z.string().min(1).nullable(),
  /** Position among its siblings. Appended on creation; reordering comes later. */
  order: z.number().int().nonnegative(),
  /**
   * Models handed to a sheet made inside this folder, at creation, in this order. Handed,
   * not imposed: the sheet lists them and can drop them, and moving a sheet changes nothing.
   */
  models: z.array(z.string().min(1)).optional(),
});
export type Folder = z.infer<typeof Folder>;

/** A sheet is prose with fields; a model is a sheet other sheets take their shape from. */
export const SheetKind = z.enum(["sheet", "model"]);
export type SheetKind = z.infer<typeof SheetKind>;

export const SheetSummary = z.object({
  id: z.string().min(1),
  title: z.string(),
  folderId: z.string().min(1).nullable(),
  order: z.number().int().nonnegative(),
  /** Automerge url of the document holding the body and fields. */
  docUrl: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  /** Set when the sheet was put away. Archived, not deleted. */
  archivedAt: z.number().int().nonnegative().optional(),
  /** Absent means a sheet. A model's fields and their types are what taking it brings. */
  kind: SheetKind.optional(),
  /** Ids of the models this sheet takes, in the order taken. First claim on a key wins. */
  models: z.array(z.string().min(1)).optional(),
});
export type SheetSummary = z.infer<typeof SheetSummary>;

/**
 * What a field is (docs/sheets.md). Optional, per key, beside the value: the value stays a
 * string whatever the type, and the type says how it is shown, edited and checked. A sheet
 * says this for its own keys; a folder schema (later) says it for every sheet inside; a key
 * nobody described is inferred from its value, then read as text. A formula stores no value.
 */
export const FieldMeta = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text") }),
  z.object({
    type: z.literal("number"),
    unit: z.string().optional(),
    decimals: z.number().int().min(0).max(6).optional(),
    thousands: z.boolean().optional(),
  }),
  z.object({ type: z.literal("select"), options: z.array(z.string()) }),
  z.object({ type: z.literal("multiselect"), options: z.array(z.string()) }),
  z.object({ type: z.literal("checkbox") }),
  /** Reserved for campaign time (Slice 3). Shown, not yet editable. */
  z.object({ type: z.literal("date") }),
  z.object({ type: z.literal("formula"), expr: z.string() }),
]);
export type FieldMeta = z.infer<typeof FieldMeta>;
export type FieldType = FieldMeta["type"];

// ---------------------------------------------------------------------------
// Timeline history. Local to one device, never synced: undo belongs to the person.
// ---------------------------------------------------------------------------

/**
 * One reversible timeline action, stored with everything needed to invert and replay it.
 * Appending a split AI reply is a single action, so one undo takes back the whole turn
 * instead of one line at a time.
 */
export const TimelineAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("append"),
    entries: z.array(NarrativeEntry).min(1),
  }),
  z.object({
    type: z.literal("update"),
    id: z.string().min(1),
    before: z.string(),
    after: z.string(),
    /** editedAt before the change. Absent when the entry had never been edited. */
    beforeEditedAt: z.number().int().nonnegative().optional(),
    afterEditedAt: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("delete"),
    entry: NarrativeEntry,
    /** Id of the entry above it, null when it was first. Restores position. */
    afterId: z.string().nullable(),
    index: z.number().int().nonnegative(),
  }),
]);
export type TimelineAction = z.infer<typeof TimelineAction>;

export const TimelineHistory = z.object({
  version: z.literal(1),
  undo: z.array(TimelineAction),
  redo: z.array(TimelineAction),
});
export type TimelineHistory = z.infer<typeof TimelineHistory>;

// ---------------------------------------------------------------------------
// AI settings. Device-owned. Never stored in a synced document.
// ---------------------------------------------------------------------------

/** OpenRouter-style model id: `provider/model[:variant]`. */
export const ModelId = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+$/, "expected provider/model");
export type ModelId = z.infer<typeof ModelId>;

export const AiSettings = z.object({
  apiKey: z.string().default(""),
  narratorModel: ModelId,
  /** The narrator's instructions for any campaign that has not written its own. */
  systemPrompt: z.string(),
});
export type AiSettings = z.infer<typeof AiSettings>;
