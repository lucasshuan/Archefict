/**
 * One skin for every text control: a well cut into the panel that holds it. The ground tone
 * is what says "editable" — the same tone as whatever holds it would read as more panel,
 * and a lighter one would float above it. No focus rule here; the base layer's focus-visible
 * outline is the app's single focus treatment, and an input that sets outline-none has to
 * reinvent it.
 */
export const CONTROL = "rounded-app border border-border bg-surface-sunken px-3 py-2";
