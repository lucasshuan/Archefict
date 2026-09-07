import { splitReply, streamNarration } from "@archefict/ai";
import { createEntry } from "@archefict/crdt";
import type { AiSettings, NarrativeEntry } from "@archefict/schema";
import { type Accessor, createSignal, onCleanup } from "solid-js";
import type { TimelineController } from "../campaign/timeline.ts";

export type TurnRunner = {
  /** Text of the reply being streamed, or null when idle. */
  streamingText: Accessor<string | null>;
  error: Accessor<string | null>;
  busy: Accessor<boolean>;
  submit: (text: string) => Promise<void>;
  stop: () => void;
};

/**
 * One player turn: append the user's entry, then (if a key is set) stream a reply.
 *
 * The reply is streamed into a signal, not into Automerge, and written to the document
 * once, when complete. Streaming token-by-token into a CRDT would bloat its history for no
 * benefit. The provenance carries the model, the turn id and token usage.
 *
 * Writing, persistence and undo are the timeline controller's job. This orchestrates only.
 */
export function createTurnRunner(options: {
  timeline: TimelineController;
  entries: () => readonly NarrativeEntry[];
  settings: Accessor<AiSettings>;
}): TurnRunner {
  const [streamingText, setStreamingText] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  let controller: AbortController | null = null;

  // Switching campaigns unmounts the session; a reply still streaming must not land later.
  onCleanup(() => controller?.abort());

  async function submit(text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed === "" || controller !== null) return;
    setError(null);

    const turnId = crypto.randomUUID();
    await options.timeline.append([
      createEntry({ kind: "user", text: trimmed, provenance: { source: "user", turnId } }),
    ]);

    const settings = options.settings();
    if (settings.apiKey === "") return; // Manual mode: the player narrates both sides.

    controller = new AbortController();
    setStreamingText("");
    let reply = "";

    try {
      const narration = streamNarration({
        apiKey: settings.apiKey,
        model: settings.narratorModel,
        systemPrompt: settings.systemPrompt,
        entries: options.entries(),
        signal: controller.signal,
      });
      for await (const chunk of narration.text) {
        reply += chunk;
        setStreamingText(reply);
      }
      const usage = await narration.usage;
      await commitReply(reply, { model: settings.narratorModel, turnId, usage });
    } catch (caught) {
      if (controller.signal.aborted) {
        await commitReply(reply, { model: settings.narratorModel, turnId });
      } else {
        setError(describe(caught));
      }
    } finally {
      controller = null;
      setStreamingText(null);
    }
  }

  /**
   * One reply becomes one entry per line (lists, tables, quotes and code stay whole), so
   * each beat can be edited or deleted on its own. All parts share the turn id and are
   * appended in one action, so a single undo takes back the whole reply. Token usage is
   * recorded on the first part only, so spend is never counted twice.
   */
  async function commitReply(
    reply: string,
    provenance: {
      model: string;
      turnId: string;
      usage?: { inputTokens?: number; outputTokens?: number };
    },
  ): Promise<void> {
    const parts = splitReply(reply);
    if (parts.length === 0) return;
    const { usage, ...shared } = provenance;
    await options.timeline.append(
      parts.map((text, i) =>
        createEntry({
          kind: "ai",
          text,
          provenance: { source: "ai", ...shared, ...(i === 0 && usage ? { usage } : {}) },
        }),
      ),
    );
  }

  function stop(): void {
    controller?.abort();
  }

  return {
    streamingText,
    error,
    busy: () => streamingText() !== null,
    submit,
    stop,
  };
}

function describe(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}
