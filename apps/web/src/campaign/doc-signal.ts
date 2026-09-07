import type { Doc } from "@automerge/automerge";
import type { DocHandle, DocHandleChangePayload } from "@automerge/automerge-repo";
import { type Accessor, createSignal, onCleanup } from "solid-js";

/**
 * The whole Automerge-to-Solid bridge. Kept deliberately tiny so it can be swapped
 * for a projection layer (or TanStack DB) once a slice needs joins.
 *
 * Automerge documents are immutable snapshots, so a new object per change is exactly
 * what a signal wants.
 */
export function createDocSignal<T>(handle: DocHandle<T>): Accessor<Doc<T>> {
  const [doc, setDoc] = createSignal<Doc<T>>(handle.doc());
  const onChange = (payload: DocHandleChangePayload<T>) => setDoc(() => payload.doc);
  handle.on("change", onChange);
  onCleanup(() => handle.off("change", onChange));
  return doc;
}
