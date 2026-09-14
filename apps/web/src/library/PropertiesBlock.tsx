import {
  removeSheetField,
  type SheetHandles,
  setSheetField,
  setSheetFieldMeta,
} from "@archefict/crdt";
import type { FieldMeta } from "@archefict/schema";
import Diamond from "lucide-solid/icons/diamond";
import Plus from "lucide-solid/icons/plus";
import X from "lucide-solid/icons/x";
import { createMemo, createSignal, For, Index, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createDocSignal } from "../campaign/doc-signal.ts";
import { FieldDisplay, FieldEditor, NameInput, TypeMenu, typeIcon } from "./FieldValue.tsx";
import {
  claimOf,
  editingMeta,
  type Fields,
  fieldKeys,
  inheritedMetas,
  isBlank,
  type Metas,
  readField,
  resolveMeta,
} from "./fields.ts";

/** A model this sheet takes, with its document read: what it claims and what it defaults to. */
export type TakenModel = {
  id: string;
  title: string;
  fields: Fields;
  meta: Metas | undefined;
};

/**
 * The index of a sheet's fields, above its body (docs/sheets.md, view 2): every field the
 * sheet has, one row each — `icon · name · value` — grouped under the model that claims it,
 * then the ones only this sheet has, then a quiet row to add one. Nothing is an input at
 * rest: a value edits on click, in the control its type calls for, and the type sits behind
 * the icon. A claimed field's menu names its model. Remove shows on hover.
 *
 * Values are written as they are typed, the same path the chips use, so the index and a chip
 * editing one value merge rather than one losing. Taking or dropping a model writes nothing.
 */
export function PropertiesBlock(props: {
  sheet: SheetHandles;
  models: readonly TakenModel[];
  onOpenModel: (id: string) => void;
}) {
  const doc = createDocSignal(props.sheet.doc);
  const fields = (): Fields => doc().fields;
  const metas = (): Metas | undefined => doc().meta;
  const inherited = createMemo(() => inheritedMetas(props.models));
  const keys = () => fieldKeys(fields(), metas(), inherited());
  const groups = createMemo(() => {
    const byModel = props.models.map((model) => ({ model, keys: [] as string[] }));
    const own: string[] = [];
    for (const key of keys()) {
      const claim = claimOf(key, props.models);
      if (claim === null) own.push(key);
      else byModel[claim]?.keys.push(key);
    }
    return { byModel: byModel.filter((group) => group.keys.length > 0), own };
  });
  const [editing, setEditing] = createSignal<string | null>(null);
  const [adding, setAdding] = createSignal(false);

  function write(key: string, value: string): void {
    setSheetField(props.sheet.doc, key, value);
    void props.sheet.flush();
  }
  function describe(key: string, meta: FieldMeta | null): void {
    setSheetFieldMeta(props.sheet.doc, key, meta);
    void props.sheet.flush();
  }
  function remove(key: string): void {
    removeSheetField(props.sheet.doc, key);
    void props.sheet.flush();
  }
  function add(name: string): void {
    setAdding(false);
    if (!keys().includes(name)) write(name, "");
    setEditing(name);
  }

  const row = (key: string, claim: TakenModel | null) => (
    <FieldRow
      name={key}
      fields={fields()}
      metas={metas()}
      inherited={inherited()}
      claim={claim}
      editing={editing() === key}
      onEdit={() => setEditing(key)}
      onDone={() => setEditing((current) => (current === key ? null : current))}
      onChange={(value) => write(key, value)}
      onMeta={(meta) => describe(key, meta)}
      onRemove={() => remove(key)}
      onOpenModel={props.onOpenModel}
    />
  );

  return (
    <section aria-label="Fields" class="flex flex-col">
      {/* Groups by position and rows by key string, never by object: the group objects are
          rebuilt on every document change, and a row rebuilt under the caret loses its editor. */}
      <Index each={groups().byModel}>
        {(group) => (
          <>
            <GroupHeading
              title={group().model.title}
              onOpen={() => props.onOpenModel(group().model.id)}
            />
            <For each={group().keys}>{(key) => row(key, group().model)}</For>
          </>
        )}
      </Index>
      <Show when={groups().byModel.length > 0 && groups().own.length > 0}>
        <GroupHeading title="Only here" />
      </Show>
      <For each={groups().own}>{(key) => row(key, null)}</For>
      <div class="grid min-h-7.5 grid-cols-[18px_1fr] items-center gap-2 px-1.5">
        <Show
          when={adding()}
          fallback={
            <button
              type="button"
              class="col-span-2 grid grid-cols-[18px_1fr] items-center gap-2 rounded-lg py-1 text-left text-[13px] text-fg-subtle hover:bg-surface-raised/60 hover:text-fg-muted"
              onClick={() => setAdding(true)}
            >
              <Plus size={14} aria-hidden="true" class="justify-self-center" />
              Add a field
            </button>
          }
        >
          <span />
          <span class="inline-flex items-center gap-2">
            <NameInput onCommit={add} onCancel={() => setAdding(false)} />
            <span class="text-xs text-fg-subtle">
              Enter sets its value · type sits behind the icon
            </span>
          </span>
        </Show>
      </div>
    </section>
  );
}

function GroupHeading(props: { title: string; onOpen?: () => void }) {
  const inner = (
    <>
      <Show when={props.onOpen}>
        <Diamond size={10} aria-hidden="true" />
      </Show>
      {props.title}
    </>
  );
  return (
    <div class="flex items-center px-1.5 pt-2 pb-0.5 text-[11px] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
      <Show
        when={props.onOpen}
        fallback={<span class="inline-flex items-center gap-1.5">{inner}</span>}
      >
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded px-1 hover:text-fg-muted"
          title="Open the model"
          onClick={props.onOpen}
        >
          {inner}
        </button>
      </Show>
    </div>
  );
}

function FieldRow(props: {
  name: string;
  fields: Fields;
  metas: Metas | undefined;
  inherited: Metas;
  claim: TakenModel | null;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onChange: (value: string) => void;
  onMeta: (meta: FieldMeta | null) => void;
  onRemove: () => void;
  onOpenModel: (id: string) => void;
}) {
  let iconButton: HTMLButtonElement | undefined;
  let valueCell: HTMLDivElement | undefined;
  const [menu, setMenu] = createSignal(false);
  const value = () => props.fields[props.name] ?? "";
  const explicit = () => props.metas?.[props.name] !== undefined;
  const resolved = () =>
    resolveMeta(props.name, props.fields[props.name], props.metas, props.inherited);
  const reading = () => readField(props.name, props.fields, props.metas, props.inherited);
  const editor = () =>
    editingMeta(props.name, props.fields[props.name], props.metas, props.inherited);
  const options = () => {
    const meta = resolved();
    return meta.type === "select" || meta.type === "multiselect" ? meta.options : [];
  };
  /** The model's own value for this key, shown dimmed while this sheet has none. */
  const fallback = () => {
    const claimed = props.claim?.fields[props.name];
    return claimed?.trim() ? claimed : null;
  };
  const origin = () =>
    explicit() ? "set here" : props.claim ? `from ${props.claim.title}` : "inferred";

  return (
    <div class="group grid min-h-7.5 grid-cols-[18px_8.5rem_minmax(0,1fr)_18px] items-center gap-2 rounded-lg px-1.5 hover:bg-surface-raised/60">
      <button
        ref={iconButton}
        type="button"
        aria-label={`${props.name}: ${resolved().type}. Change type`}
        title={`${resolved().type} · ${origin()} — change`}
        class="justify-self-center rounded p-0.5 text-fg-subtle hover:text-fg"
        onClick={() => setMenu(true)}
      >
        <Dynamic component={typeIcon(resolved().type)} size={14} aria-hidden="true" />
      </button>
      <Show when={menu() && iconButton}>
        {(anchor) => (
          <TypeMenu
            name={props.name}
            meta={resolved()}
            explicit={explicit()}
            claim={
              props.claim
                ? {
                    title: props.claim.title,
                    onOpen: () => props.onOpenModel(props.claim?.id ?? ""),
                  }
                : undefined
            }
            value={value()}
            anchor={anchor()}
            onMeta={props.onMeta}
            onClose={() => setMenu(false)}
          />
        )}
      </Show>
      <span class="truncate text-[13px] text-fg-muted" title={props.name}>
        {props.name}
      </span>
      <div ref={valueCell} class="min-w-0">
        <Show
          when={props.editing && editor().type !== "checkbox" && valueCell}
          fallback={
            <button
              type="button"
              class="flex min-h-7 w-full items-center text-left text-sm"
              aria-label={`${props.name}: edit`}
              onClick={() => {
                if (resolved().type === "checkbox") {
                  props.onChange(value().trim() === "true" ? "false" : "true");
                } else {
                  props.onEdit();
                }
              }}
            >
              <Show
                when={isBlank(reading()) ? fallback() : null}
                fallback={<FieldDisplay reading={reading()} options={options()} />}
              >
                {(text) => (
                  <span
                    class="text-fg-subtle"
                    title={`Default from ${props.claim?.title ?? "the model"}`}
                  >
                    {text()}
                  </span>
                )}
              </Show>
            </button>
          }
        >
          {(anchor) => (
            <FieldEditor
              name={props.name}
              value={value()}
              meta={editor()}
              anchor={anchor()}
              onChange={props.onChange}
              onMeta={props.onMeta}
              onDone={props.onDone}
            />
          )}
        </Show>
      </div>
      <button
        type="button"
        aria-label={`Remove ${props.name}`}
        title={
          props.claim
            ? `Clear ${props.name} here; ${props.claim.title} still claims it`
            : "Remove field"
        }
        class="justify-self-center rounded p-0.5 text-fg-subtle opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
        onClick={props.onRemove}
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
