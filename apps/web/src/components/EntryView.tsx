import type { EntryKind } from "@archefict/schema";

export function EntryView(props: { kind: EntryKind; text: string; streaming?: boolean }) {
  return (
    <article
      class="rounded-app px-4 py-3"
      classList={{
        "bg-surface border border-border": props.kind === "user",
        "font-narrative text-[1.05rem] leading-relaxed": props.kind === "ai",
        "text-fg-muted text-sm italic": props.kind === "system",
      }}
      data-kind={props.kind}
      aria-busy={props.streaming ? "true" : undefined}
    >
      <p class="whitespace-pre-wrap">
        {props.text}
        {props.streaming ? <span class="animate-pulse text-accent">▍</span> : null}
      </p>
    </article>
  );
}
