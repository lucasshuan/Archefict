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
Never act for the player. Keep replies to a few paragraphs. End on something the player can react to.`;

/** How many recent entries are sent as context. A real strategy arrives with Slice 8. */
export const CONTEXT_WINDOW_ENTRIES = 40;

export function toModelMessages(entries: readonly NarrativeEntry[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const entry of entries.slice(-CONTEXT_WINDOW_ENTRIES)) {
    if (entry.text.trim() === "") continue;
    switch (entry.kind) {
      case "user":
        messages.push({ role: "user", content: entry.text });
        break;
      case "ai":
        messages.push({ role: "assistant", content: entry.text });
        break;
      case "system":
        // Out-of-story notes are not narrative context yet. Meta channel comes later.
        break;
    }
  }
  return messages;
}

export type NarrationRequest = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  entries: readonly NarrativeEntry[];
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
    messages: toModelMessages(request.entries),
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
