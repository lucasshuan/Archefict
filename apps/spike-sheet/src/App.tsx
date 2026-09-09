/**
 * Phase 0 spike (ROADMAP): Automerge 3 + ProseMirror.
 *
 * Throwaway. It exists to answer three questions before Slice 1 commits to the bet:
 *   1. Can a sheet body be edited as rich text through ProseMirror while Automerge stays
 *      canonical? (`@automerge/prosemirror` maps the two.)
 *   2. Do two tabs stay in sync through the same document?
 *   3. What does the document weigh after a thousand edits, and how long do they take?
 *
 * Findings go inline in the roadmap item, then this app is deleted or promoted.
 */
import * as A from "@automerge/automerge";
import {
  type AutomergeUrl,
  type DocHandle,
  type DocHandleChangePayload,
  isValidAutomergeUrl,
  Repo,
} from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { init } from "@automerge/prosemirror";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { type Command, EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";

type SheetDoc = {
  title: string;
  body: string;
  fields: Record<string, string>;
};

const DOC_KEY = "archefict-spike:sheet-url";

const repo = new Repo({
  storage: new IndexedDBStorageAdapter("archefict-spike"),
  network: [new BroadcastChannelNetworkAdapter()],
});

/** One document for this browser, remembered by url so a second tab opens the same one. */
async function openSheet(): Promise<DocHandle<SheetDoc>> {
  const remembered = localStorage.getItem(DOC_KEY);
  if (remembered && isValidAutomergeUrl(remembered)) {
    try {
      return await repo.find<SheetDoc>(remembered);
    } catch {
      // Gone from storage: make a new one below.
    }
  }
  const handle = repo.create<SheetDoc>({
    title: "Varn Ashgrove",
    body: "Varn keeps the Guild's ledgers and three of its secrets.",
    fields: { class: "Rogue", level: "5", status: "alive" },
  });
  await repo.flush([handle.documentId]);
  localStorage.setItem(DOC_KEY, handle.url);
  return handle;
}

export function App() {
  const [handle] = createResource(openSheet);
  return (
    <Show when={handle()} fallback={<p class="muted">Opening the sheet…</p>}>
      {(h) => <Sheet handle={h()} />}
    </Show>
  );
}

type Stats = { bytes: number; changes: number; bodyChars: number; fields: number };

function measure(doc: A.Doc<SheetDoc>): Stats {
  return {
    bytes: A.save(doc).byteLength,
    changes: A.getAllChanges(doc).length,
    bodyChars: doc.body.length,
    fields: Object.keys(doc.fields).length,
  };
}

type Burst = {
  label: string;
  n: number;
  ms: number;
  before: number;
  after: number;
  failed: number;
};

function Sheet(props: { handle: DocHandle<SheetDoc> }) {
  const [doc, setDoc] = createSignal<A.Doc<SheetDoc>>(props.handle.doc());
  const [stats, setStats] = createSignal<Stats>(measure(props.handle.doc()));
  const [bursts, setBursts] = createSignal<readonly Burst[]>([]);
  const [running, setRunning] = createSignal(false);

  const onChange = (payload: DocHandleChangePayload<SheetDoc>) => {
    setDoc(() => payload.doc);
    setStats(measure(payload.doc));
  };
  props.handle.on("change", onChange);
  onCleanup(() => props.handle.off("change", onChange));

  let mount: HTMLDivElement | undefined;
  let view: EditorView | undefined;

  onMount(() => {
    if (!mount) return;
    const { schema, pmDoc, plugin } = init(props.handle, ["body"]);
    const marks: Record<string, Command> = {};
    const strong = schema.marks["strong"];
    const em = schema.marks["em"];
    if (strong) marks["Mod-b"] = toggleMark(strong);
    if (em) marks["Mod-i"] = toggleMark(em);
    const state = EditorState.create({
      schema,
      doc: pmDoc,
      plugins: [
        keymap({ ...baseKeymap, ...marks, "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
        history(),
        plugin,
      ],
    });
    view = new EditorView(mount, { state });
  });
  onCleanup(() => view?.destroy());

  /** A thousand small edits through the editor, the way a person's edits arrive. */
  async function editBurst(n: number): Promise<void> {
    const v = view;
    if (!v || running()) return;
    setRunning(true);
    const words = ["shadow", "ledger", "guild", "rain", "coin", "oath", "blade", "lantern"];
    const before = measure(props.handle.doc()).bytes;
    const started = performance.now();
    let failed = 0;
    for (let i = 0; i < n; i += 1) {
      try {
        const size = v.state.doc.content.size;
        const pos = 1 + Math.floor(Math.random() * Math.max(1, size - 2));
        const remove = Math.random() < 0.25 && size > 60;
        const tr = remove
          ? v.state.tr.delete(pos, Math.min(size - 1, pos + 3))
          : v.state.tr.insertText(` ${words[i % words.length]}`, pos);
        v.dispatch(tr);
      } catch {
        failed += 1;
      }
      if (i % 50 === 49) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await repo.flush([props.handle.documentId]);
    const after = measure(props.handle.doc()).bytes;
    setBursts((list) => [
      ...list,
      { label: "editor", n, ms: Math.round(performance.now() - started), before, after, failed },
    ]);
    setRunning(false);
  }

  /** A thousand field writes: what a stat that changes every turn costs the document. */
  async function fieldBurst(n: number): Promise<void> {
    if (running()) return;
    setRunning(true);
    const before = measure(props.handle.doc()).bytes;
    const started = performance.now();
    for (let i = 0; i < n; i += 1) {
      props.handle.change((d) => {
        d.fields["hp"] = String(1 + Math.floor(Math.random() * 40));
      });
      if (i % 100 === 99) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await repo.flush([props.handle.documentId]);
    const after = measure(props.handle.doc()).bytes;
    setBursts((list) => [
      ...list,
      { label: "fields", n, ms: Math.round(performance.now() - started), before, after, failed: 0 },
    ]);
    setRunning(false);
  }

  function setField(key: string, value: string): void {
    props.handle.change((d) => {
      d.fields[key] = value;
    });
  }

  function removeField(key: string): void {
    props.handle.change((d) => {
      delete d.fields[key];
    });
  }

  return (
    <main class="spike">
      <section class="sheet">
        <input
          class="title"
          aria-label="Title"
          value={doc().title}
          onInput={(event) => {
            const title = event.currentTarget.value;
            props.handle.change((d) => {
              d.title = title;
            });
          }}
        />
        <div ref={mount} class="editor" data-testid="editor" />
        <p class="muted">
          Rich text through ProseMirror, canonical in Automerge. Ctrl+B / Ctrl+I mark, Ctrl+Z
          undoes. Open this page in a second tab to watch it sync.
        </p>
      </section>

      <aside class="side">
        <h2>Fields</h2>
        <ul class="fields" data-testid="fields">
          <For each={Object.entries(doc().fields).sort(([a], [b]) => a.localeCompare(b))}>
            {([key, value]) => (
              <li>
                <span class="key">{key}</span>
                <input
                  aria-label={`${key} value`}
                  value={value}
                  onInput={(event) => setField(key, event.currentTarget.value)}
                />
                <button type="button" aria-label={`Remove ${key}`} onClick={() => removeField(key)}>
                  ×
                </button>
              </li>
            )}
          </For>
        </ul>
        <form
          class="add"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const key = String(data.get("key") ?? "").trim();
            const value = String(data.get("value") ?? "");
            if (key === "") return;
            setField(key, value);
            form.reset();
          }}
        >
          <input name="key" placeholder="key" aria-label="New field key" />
          <input name="value" placeholder="value" aria-label="New field value" />
          <button type="submit">Add</button>
        </form>

        <h2>Document</h2>
        <table class="stats" data-testid="stats">
          <tbody>
            <tr>
              <td>saved bytes</td>
              <td data-stat="bytes">{stats().bytes.toLocaleString()}</td>
            </tr>
            <tr>
              <td>changes</td>
              <td data-stat="changes">{stats().changes.toLocaleString()}</td>
            </tr>
            <tr>
              <td>body chars</td>
              <td data-stat="bodyChars">{stats().bodyChars.toLocaleString()}</td>
            </tr>
            <tr>
              <td>fields</td>
              <td data-stat="fields">{stats().fields}</td>
            </tr>
          </tbody>
        </table>

        <h2>Bursts</h2>
        <div class="actions">
          <button type="button" disabled={running()} onClick={() => void editBurst(1000)}>
            1,000 editor edits
          </button>
          <button type="button" disabled={running()} onClick={() => void fieldBurst(1000)}>
            1,000 field writes
          </button>
        </div>
        <ul class="bursts" data-testid="bursts">
          <For each={bursts()}>
            {(burst) => (
              <li>
                <strong>{burst.label}</strong> ×{burst.n}: {burst.ms} ms,{" "}
                {burst.before.toLocaleString()} → {burst.after.toLocaleString()} bytes (
                {Math.round((burst.after - burst.before) / burst.n)} B/edit)
                <Show when={burst.failed > 0}>, {burst.failed} failed</Show>
              </li>
            )}
          </For>
        </ul>
        <p class="muted">
          doc <code>{props.handle.url.slice(0, 24)}…</code>
        </p>
      </aside>
    </main>
  );
}

// Keep the url type in scope for readers of the file; the repo hands it out as a string.
export type { AutomergeUrl };
