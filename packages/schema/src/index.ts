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
  systemPrompt: z.string(),
});
export type AiSettings = z.infer<typeof AiSettings>;
