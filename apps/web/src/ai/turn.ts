import { splitReply, streamNarration } from "@archefict/ai";
import { createEntry } from "@archefict/crdt";
import type { AiSettings, NarrativeEntry } from "@archefict/schema";
import { type Accessor, batch, createSignal, onCleanup } from "solid-js";
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
  /** The narrator's instructions: the campaign's own, or the device default. */
  instructions: Accessor<string>;
}): TurnRunner {
  const [streamingText, setStreamingText] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  let controller: AbortController | null = null;

  // Switching campaigns unmounts the session; a reply still streaming must not land later.
  onCleanup(() => controller?.abort());

  /**
   * A turn. With text, the player entry is appended and the narrator answers it. With none,
   * this is a continue: nothing is written and the narrator picks up from where the story
   * already stands.
   */
  async function submit(text: string): Promise<void> {
    if (controller !== null) return;
    const trimmed = text.trim();
    const settings = options.settings();
    // Nothing to say, and nothing to continue from or no key to continue with.
    if (trimmed === "" && (settings.apiKey === "" || options.entries().length === 0)) return;
    setError(null);

    const turnId = crypto.randomUUID();
    if (trimmed !== "") {
      await options.timeline.append([
        createEntry({ kind: "user", text: trimmed, provenance: { source: "user", turnId } }),
      ]);
    }

    if (settings.apiKey === "") return; // Manual mode: the player narrates both sides.

    controller = new AbortController();
    setStreamingText("");
    let reply = "";

    try {
      const narration = streamNarration({
        apiKey: settings.apiKey,
        model: settings.narratorModel,
        systemPrompt: options.instructions(),
        entries: options.entries(),
        mode: trimmed === "" ? "continue" : "reply",
        signal: controller.signal,
      });
      for await (const chunk of narration.text) {
        reply += chunk;
        setStreamingText(reply);
      }
      const usage = await narration.usage;
      // Nothing to write, so say why: otherwise the spinner just vanishes and the story
      // stands still, which reads as a bug in the app rather than a turn the model refused.
      if (reply.trim() === "") setError("The narrator returned nothing. Try again.");
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
    const entries = parts.map((text, i) =>
      createEntry({
        kind: "ai",
        text,
        provenance: { source: "ai", ...shared, ...(i === 0 && usage ? { usage } : {}) },
      }),
    );
    // The feed renders the in-flight reply as provisional entries. Drop them in the same
    // batch that writes the real ones, or both show for as long as the flush takes.
    await batch(() => {
      setStreamingText(null);
      return options.timeline.append(entries);
    });
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
