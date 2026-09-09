import type { ModelInfo } from "@archefict/contract";
import { vendorMark } from "./model-vendors.ts";

/**
 * How a model is written down, in one place.
 *
 * The picker's rows and the line under the closed field describe the same three facts, so
 * they say them the same way: a name without the vendor the mark already carries, a context
 * window rounded to what a glance can use, and a price pair read as in → out.
 */

/**
 * OpenRouter names its models "Vendor: Model", which the mark already says. Dropped only
 * when the prefix really is the vendor, so a name that merely holds a colon survives.
 */
export function shortName(model: ModelInfo): string {
  const cut = model.name.indexOf(": ");
  if (cut <= 0) return model.name;
  const prefix = slug(model.name.slice(0, cut));
  const vendor = slug(vendorMark(model.id).vendor);
  if (prefix === "" || !(vendor.startsWith(prefix) || prefix.startsWith(vendor))) {
    return model.name;
  }
  return model.name.slice(cut + 2);
}

/** Tokens at the precision a glance needs: "200K", "1M". Null when the catalogue is offline. */
export function formatContext(tokens: number): string | null {
  if (tokens <= 0) return null;
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

/**
 * USD per million. Whole dollars stay whole and the rest carry cents, so a right-aligned
 * column of them lines up instead of mixing "$0.5" with "$0.25". Sub-cent prices are real
 * on OpenRouter, and those keep whatever precision they need.
 */
export function usd(perMillion: number): string {
  if (perMillion === 0) return "$0";
  if (Number.isInteger(perMillion)) return `$${perMillion}`;
  if (perMillion < 0.01) return `$${Number(perMillion.toFixed(4))}`;
  return `$${perMillion.toFixed(2)}`;
}

export function isFree(model: ModelInfo): boolean {
  return model.pricing.input === 0 && model.pricing.output === 0;
}

/** The same facts as a row, on one line: for the field once the list is closed. */
export function summarise(model: ModelInfo): string {
  const context = formatContext(model.contextLength);
  const price = isFree(model)
    ? "free"
    : `${usd(model.pricing.input)} → ${usd(model.pricing.output)} per M tokens`;
  return [
    shortName(model),
    context ? `${context} context` : null,
    price,
    model.tools ? null : "cannot use tools",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A row's accessible name: the same facts, spelled out rather than punctuated. */
export function describe(model: ModelInfo): string {
  const context = formatContext(model.contextLength);
  const price = isFree(model)
    ? "free"
    : `${usd(model.pricing.input)} per million in, ${usd(model.pricing.output)} per million out`;
  return [
    shortName(model),
    model.id,
    context ? `${context} context` : null,
    price,
    model.tools ? null : "cannot use tools",
  ]
    .filter(Boolean)
    .join(", ");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
