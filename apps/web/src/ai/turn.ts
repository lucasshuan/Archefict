import { streamNarration } from "@archefict/ai";
import {
  appendEntry,
  createEntry,
  deleteEntry,
  entriesOf,
  type TimelineDoc,
  updateEntry,
} from "@archefict/crdt";
import type { AiSettings } from "@archefict/schema";
import type { DocHandle } from "@automerge/automerge-repo";
import { type Accessor, createSignal, onCleanup } from "solid-js";

export type SaveState = "idle" | "saving" | "saved" | "failed";

export type TurnRunner = {
  /** Text of the reply being streamed, or null when idle. */
  streamingText: Accessor<string | null>;
  error: Accessor<string | null>;
  busy: Accessor<boolean>;
  /** Whether the last write has reached storage. "saved" is the only durable state. */
  saveState: Accessor<SaveState>;
  submit: (text: string) => Promise<void>;
  stop: () => void;
  /** Rewrite one entry. Any entry, the AI's included: the timeline is the player's. */
  edit: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/**
 * One player turn: append the user's entry, then (if a key is set) stream a reply.
 *
 * The reply is streamed into a signal, not into Automerge, and written to the document
 * once, when complete. Streaming token-by-token into a CRDT would bloat its history for no
 * benefit. The provenance carries the model, the turn id and token usage.
 *
 * Every write is followed by a flush. The Repo persists on a debounce, and a reload inside
 * that window would lose the entry. "Saved" in the UI means the flush resolved.
 */
export function createTurnRunner(options: {
  timeline: DocHandle<TimelineDoc>;
  flush: () => Promise<void>;
  settings: Accessor<AiSettings>;
}): TurnRunner {
  const [streamingText, setStreamingText] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [saveState, setSaveState] = createSignal<SaveState>("idle");
  let controller: AbortController | null = null;

  // Switching campaigns unmounts the session; a reply still streaming must not land later.
  onCleanup(() => controller?.abort());

  async function persist(): Promise<void> {
    setSaveState("saving");
    try {
      await options.flush();
      setSaveState("saved");
    } catch (caught) {
      setSaveState("failed");
      setError(`Could not save to local storage: ${describe(caught)}`);
    }
  }

  async function submit(text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed === "" || controller !== null) return;
    setError(null);

    const turnId = crypto.randomUUID();
    appendEntry(
      options.timeline,
      createEntry({ kind: "user", text: trimmed, provenance: { source: "user", turnId } }),
    );
    await persist();

    const settings = options.settings();
    if (settings.apiKey === "") return; // Manual mode: the player narrates both sides.

    controller = new AbortController();
    setStreamingText("");
    let reply = "";

    try {
      const narration = streamNarration({
        apiKey: settings.apiKey,
        model: settings.model,
        systemPrompt: settings.systemPrompt,
        entries: entriesOf(options.timeline),
        signal: controller.signal,
      });
      for await (const chunk of narration.text) {
        reply += chunk;
        setStreamingText(reply);
      }
      const usage = await narration.usage;
      await commitReply(reply, { model: settings.model, turnId, usage });
    } catch (caught) {
      if (controller.signal.aborted) {
        await commitReply(reply, { model: settings.model, turnId });
      } else {
        setError(describe(caught));
      }
    } finally {
      controller = null;
      setStreamingText(null);
    }
  }

  async function commitReply(
    reply: string,
    provenance: {
      model: string;
      turnId: string;
      usage?: { inputTokens?: number; outputTokens?: number };
    },
  ): Promise<void> {
    if (reply.trim() === "") return;
    appendEntry(
      options.timeline,
      createEntry({ kind: "ai", text: reply, provenance: { source: "ai", ...provenance } }),
    );
    await persist();
  }

  function stop(): void {
    controller?.abort();
  }

  async function edit(id: string, text: string): Promise<void> {
    updateEntry(options.timeline, id, text);
    await persist();
  }

  async function remove(id: string): Promise<void> {
    deleteEntry(options.timeline, id);
    await persist();
  }

  return {
    streamingText,
    error,
    busy: () => streamingText() !== null,
    saveState,
    submit,
    stop,
    edit,
    remove,
  };
}

function describe(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  return String(caught);
}
