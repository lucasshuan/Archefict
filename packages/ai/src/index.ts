/**
 * @archefict/ai
 *
 * Minimal narration loop over OpenRouter through the AI SDK.
 * No tools, no plan/execute split, no spend controls yet (ROADMAP Slices 7-10).
 *
 * The API key is passed per call and never stored here. Keys are device-owned.
 */
import type { NarrativeEntry } from "@archefict/schema";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type ModelMessage, streamText } from "ai";

export type SuggestedModel = {
  id: string;
  label: string;
  /** USD per million tokens, from OpenRouter on 2026-09-06. Informational only. */
  inputPerM: number;
  outputPerM: number;
};

/** Cheap enough for daily play, same family as Sonnet 5. Change it in settings. */
export const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

export const SUGGESTED_MODELS: readonly SuggestedModel[] = [
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", inputPerM: 1, outputPerM: 5 },
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", inputPerM: 2, outputPerM: 10 },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", inputPerM: 0.75, outputPerM: 3.75 },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini", inputPerM: 0.25, outputPerM: 2 },
  { id: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1", inputPerM: 0.55, outputPerM: 1.65 },
];

export const DEFAULT_SYSTEM_PROMPT = `You are the narrator and game master of an interactive story.
Write in second person, present tense. Describe the world, voice the characters, and let the player decide what they do.
Never act for the player. Keep replies to a few paragraphs. End on something the player can react to.
Use Markdown for headings, emphasis, lists, and blockquotes when it makes the scene clearer, but keep the prose natural. Do not embed images.`;

/**
 * How many recent messages are sent as context, counted after consecutive entries of one
 * side are merged (a reply split into parts is one message). A real strategy arrives with Slice 8.
 */
export const CONTEXT_WINDOW_ENTRIES = 40;

/** A reply answers a new player line. A continue picks up from a timeline already ending in one. */
export type TurnMode = "reply" | "continue";

/**
 * What the narrator is told when the player sends nothing.
 *
 * A continue's timeline already ends with an assistant turn, and a request that ends there
 * reads as finished: the model closes the turn and streams nothing back. This asks for the
 * next beat instead. It is sent, never stored, so it cannot pile up in the timeline.
 */
export const CONTINUE_INSTRUCTION =
  "Continue the narration from exactly where it stopped, as if it were the same reply. Do not repeat or summarise what you already wrote, and do not act for the player.";

/**
 * Builds the model's view of the timeline. Consecutive entries from the same side collapse
 * into one message, so a reply the app split into editable parts reads as the single
 * assistant turn it was. A continue ends on the instruction, past the context window: the
 * request must end with a user message or the model has nothing to answer.
 */
export function toModelMessages(
  entries: readonly NarrativeEntry[],
  mode: TurnMode = "reply",
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const entry of entries) {
    if (entry.text.trim() === "") continue;
    const role = roleOf(entry.kind);
    if (role === null) continue;
    const last = messages.at(-1);
    if (last && last.role === role && typeof last.content === "string") {
      last.content = `${last.content}\n${entry.text}`;
    } else {
      messages.push({ role, content: entry.text });
    }
  }
  const recent = messages.slice(-CONTEXT_WINDOW_ENTRIES);
  if (mode === "continue") recent.push({ role: "user", content: CONTINUE_INSTRUCTION });
  return recent;
}

function roleOf(kind: NarrativeEntry["kind"]): "user" | "assistant" | null {
  switch (kind) {
    case "user":
      return "user";
    case "ai":
      return "assistant";
    case "system":
      // Out-of-story notes are not narrative context yet. Meta channel comes later.
      return null;
  }
}

type BlockKind = "prose" | "heading" | "list" | "table" | "quote" | "fence";

/**
 * Splits a reply into the parts the timeline stores as separate, individually editable
 * entries. The feed renders a newline as a line break, so every prose line is one part.
 * Markdown blocks that only make sense whole stay whole: list items, table rows and
 * blockquote lines group with their neighbours of the same kind, fenced code is never cut.
 */
export function splitReply(text: string): string[] {
  const parts: string[] = [];
  let current: string[] = [];
  let currentKind: BlockKind | null = null;
  let inFence = false;

  const flush = (): void => {
    const joined = current.join("\n").trim();
    if (joined !== "") parts.push(joined);
    current = [];
    currentKind = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    if (inFence) {
      current.push(raw);
      if (isFenceLine(raw)) {
        inFence = false;
        flush();
      }
      continue;
    }
    if (isFenceLine(raw)) {
      flush();
      inFence = true;
      currentKind = "fence";
      current.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flush();
      continue;
    }
    const kind = classify(line);
    const continues = kind !== "prose" && kind !== "heading" && kind === currentKind;
    if (!continues) flush();
    current.push(line);
    currentKind = kind;
  }
  flush();
  return parts;
}

function isFenceLine(line: string): boolean {
  return /^\s{0,3}(`{3,}|~{3,})/.test(line);
}

function classify(line: string): BlockKind {
  if (/^\s{0,3}#{1,6}\s/.test(line)) return "heading";
  if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) return "list";
  if (/^\s*\|/.test(line)) return "table";
  if (/^\s*>/.test(line)) return "quote";
  return "prose";
}

export type NarrationRequest = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  entries: readonly NarrativeEntry[];
  /** Defaults to a reply. */
  mode?: TurnMode;
  signal?: AbortSignal;
};

export type NarrationUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type Narration = {
  text: AsyncIterable<string>;
  usage: Promise<NarrationUsage>;
};

export function streamNarration(request: NarrationRequest): Narration {
  const openrouter = createOpenRouter({
    apiKey: request.apiKey,
    headers: {
      "HTTP-Referer": "https://archefict.app",
      "X-Title": "Archefict",
    },
  });

  const result = streamText({
    model: openrouter(request.model),
    system: request.systemPrompt,
    messages: toModelMessages(request.entries, request.mode ?? "reply"),
    ...(request.signal ? { abortSignal: request.signal } : {}),
  });

  return {
    text: result.textStream,
    usage: Promise.resolve(result.usage).then((u) => ({
      ...(u.inputTokens !== undefined ? { inputTokens: u.inputTokens } : {}),
      ...(u.outputTokens !== undefined ? { outputTokens: u.outputTokens } : {}),
    })),
  };
}
