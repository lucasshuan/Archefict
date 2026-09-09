import arcee from "@lobehub/icons-static-svg/icons/arcee.svg?raw";
import aws from "@lobehub/icons-static-svg/icons/aws.svg?raw";
import baidu from "@lobehub/icons-static-svg/icons/baidu.svg?raw";
import bytedance from "@lobehub/icons-static-svg/icons/bytedance.svg?raw";
import claude from "@lobehub/icons-static-svg/icons/claude.svg?raw";
import cohere from "@lobehub/icons-static-svg/icons/cohere.svg?raw";
import deepseek from "@lobehub/icons-static-svg/icons/deepseek.svg?raw";
import google from "@lobehub/icons-static-svg/icons/google.svg?raw";
import ibm from "@lobehub/icons-static-svg/icons/ibm.svg?raw";
import inception from "@lobehub/icons-static-svg/icons/inception.svg?raw";
import kwaipilot from "@lobehub/icons-static-svg/icons/kwaipilot.svg?raw";
import liquid from "@lobehub/icons-static-svg/icons/liquid.svg?raw";
import longcat from "@lobehub/icons-static-svg/icons/longcat.svg?raw";
import meta from "@lobehub/icons-static-svg/icons/meta.svg?raw";
import microsoft from "@lobehub/icons-static-svg/icons/microsoft.svg?raw";
import minimax from "@lobehub/icons-static-svg/icons/minimax.svg?raw";
import mistral from "@lobehub/icons-static-svg/icons/mistral.svg?raw";
import moonshot from "@lobehub/icons-static-svg/icons/moonshot.svg?raw";
import morph from "@lobehub/icons-static-svg/icons/morph.svg?raw";
import nvidia from "@lobehub/icons-static-svg/icons/nvidia.svg?raw";
import openai from "@lobehub/icons-static-svg/icons/openai.svg?raw";
import openrouter from "@lobehub/icons-static-svg/icons/openrouter.svg?raw";
import perplexity from "@lobehub/icons-static-svg/icons/perplexity.svg?raw";
import poolside from "@lobehub/icons-static-svg/icons/poolside.svg?raw";
import qwen from "@lobehub/icons-static-svg/icons/qwen.svg?raw";
import relace from "@lobehub/icons-static-svg/icons/relace.svg?raw";
import stepfun from "@lobehub/icons-static-svg/icons/stepfun.svg?raw";
import tencent from "@lobehub/icons-static-svg/icons/tencent.svg?raw";
import upstage from "@lobehub/icons-static-svg/icons/upstage.svg?raw";
import xai from "@lobehub/icons-static-svg/icons/xai.svg?raw";
import xiaomimimo from "@lobehub/icons-static-svg/icons/xiaomimimo.svg?raw";
import zai from "@lobehub/icons-static-svg/icons/zai.svg?raw";

/**
 * Vendor marks for model ids.
 *
 * The mark comes from @lobehub/icons-static-svg, which is nothing but SVG files — no code,
 * no dependencies, no lifecycle scripts. Each one is imported by path so the bundle carries
 * only the three dozen listed here and none of the other eight hundred and seventy. The
 * monochrome variants are used rather than the colour ones: half the houses have no colour
 * variant at all, and a dropdown of full-colour logos fights a deliberately quiet palette.
 * Every file paints with `currentColor`, so each mark takes the vendor's hue below and the
 * column reads as one set rather than a sticker sheet.
 *
 * Not every vendor on OpenRouter is a brand — a good third of the catalogue is fine-tuners
 * publishing under a handle. Those keep the lettermark, which is why it stays as the
 * fallback rather than being replaced. Two houses that do have a mark are left to it as
 * well: NousResearch and AionLabs draw theirs with enough path data to weigh as much as the
 * other thirty put together, which is not a trade eight of four hundred models can justify.
 *
 * The colours are the vendors' own, read out of the package's `-color` variants rather than
 * recalled: the hex beside each entry is the fill that file paints the mark with. Converted
 * to OKLCH, they keep their hue and as much chroma as sRGB reaches, but their lightness is
 * lifted into a band that stays legible on a dark chip — brand palettes are drawn for white
 * backgrounds, and Baidu's blue or Tencent's would otherwise be a hole rather than a mark.
 *
 * A house whose mark is monochrome by design gets no colour, because it has none: OpenAI,
 * xAI and IBM are black on white, and white on dark is the faithful reading, not a fallback.
 * A vendor with no brand at all — the fine-tuners — keeps the muted arbitrary hue, which also
 * makes "unbranded handle" visibly different from "brand we know".
 *
 * These are identity colours drawn from the data, the one reason a component may name a
 * colour outside the token set; keeping them here leaves a theme a single map to replace.
 */

/** For a vendor we have no colour for: the arbitrary hue is muted so it cannot pose as brand. */
const UNBRANDED_LIGHTNESS = 0.78;
const UNBRANDED_CHROMA = 0.11;

/** OKLCH lightness, chroma and hue, from the hex the package's own -color variant uses. */
const COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  amazon: [0.77, 0.174, 65], // #ff9900
  anthropic: [0.72, 0.131, 39], // #d97757
  "arcee-ai": [0.72, 0.099, 195], // #008c8c
  baidu: [0.72, 0.2, 269], // #2932e1
  bytedance: [0.72, 0.188, 258], // #3c8cff
  "bytedance-seed": [0.72, 0.188, 258], // #3c8cff
  cohere: [0.72, 0.172, 34], // #ff7759
  deepseek: [0.72, 0.2, 270], // #4d6bfe
  google: [0.72, 0.18, 260], // #4285f4
  kwaipilot: [0.79, 0.059, 247], // #9ec0e0
  meituan: [0.8, 0.2, 146], // #29e154
  meta: [0.72, 0.2, 255], // #0082fb
  "meta-llama": [0.72, 0.2, 255], // #0082fb
  microsoft: [0.72, 0.156, 240], // #00a4ef
  minimax: [0.72, 0.2, 34], // #fe603c
  mistralai: [0.72, 0.2, 37], // #fa500f
  moonshotai: [0.72, 0.2, 256], // #1783ff, from Kimi, the same house
  morph: [0.8, 0.197, 128], // #99d52a
  nvidia: [0.72, 0.187, 132], // #74b71b
  openrouter: [0.88, 0.2, 124], // #c8ff00
  perplexity: [0.72, 0.119, 210], // #22b8cd
  poolside: [0.72, 0.2, 273], // #4137ff
  qwen: [0.72, 0.2, 280], // #6f69f7
  stepfun: [0.72, 0.169, 243], // #01a9ff
  tencent: [0.72, 0.2, 261], // #0052d9
  upstage: [0.72, 0.2, 288], // #805dfa
  "z-ai": [0.72, 0.2, 268], // #3859ff, from Zhipu, the same house
};

/** Black-on-white brands, read as white on dark. The hue is the app's own, so it sits warm. */
const MONOCHROME: readonly [number, number, number] = [0.92, 0.01, 85];

/** Houses whose mark carries no brand colour anywhere in the package. */
const MONOCHROME_VENDORS = new Set([
  "openai",
  "x-ai",
  "ibm-granite",
  "liquid",
  "inception",
  "relace",
  "xiaomi",
]);

/** OpenRouter's vendor slug to the mark that stands for it. */
const LOGOS: Readonly<Record<string, string>> = {
  amazon: aws,
  // The Claude burst, not the corporate A: every anthropic/* model is a Claude, and the
  // burst is the mark people know. Same house, sourced the same way as Kimi and Zhipu.
  anthropic: claude,
  "arcee-ai": arcee,
  baidu,
  bytedance,
  "bytedance-seed": bytedance,
  cohere,
  deepseek,
  google,
  "ibm-granite": ibm,
  inception,
  kwaipilot,
  liquid,
  meituan: longcat,
  meta,
  "meta-llama": meta,
  microsoft,
  minimax,
  mistralai: mistral,
  moonshotai: moonshot,
  morph,
  nvidia,
  openai,
  openrouter,
  perplexity,
  poolside,
  qwen,
  relace,
  stepfun,
  tencent,
  upstage,
  "x-ai": xai,
  xiaomi: xiaomimimo,
  "z-ai": zai,
};

export type VendorMark = {
  /** The slug before the slash, without the `~` that marks a floating "latest" alias. */
  vendor: string;
  letter: string;
  /** The vendor's mark as inline SVG, or null when the house has none and the letter stands in. */
  logo: string | null;
  /** Opaque, for the mark itself. */
  color: string;
  /** The same hue at low alpha, for the chip behind it. */
  tint: string;
};

export function vendorMark(id: string): VendorMark {
  const slug = id.includes("/") ? id.slice(0, id.indexOf("/")) : id;
  const vendor = slug.startsWith("~") ? slug.slice(1) : slug;
  const [lightness, chroma, hue] = resolveColor(vendor);
  return {
    vendor,
    letter: (vendor[0] ?? "?").toUpperCase(),
    logo: LOGOS[vendor] ?? null,
    color: `oklch(${lightness} ${chroma} ${hue})`,
    tint: `oklch(${lightness} ${chroma} ${hue} / 0.16)`,
  };
}

function resolveColor(vendor: string): readonly [number, number, number] {
  const brand = COLORS[vendor];
  if (brand) return brand;
  if (MONOCHROME_VENDORS.has(vendor)) return MONOCHROME;
  return [UNBRANDED_LIGHTNESS, UNBRANDED_CHROMA, hashHue(vendor)];
}

/** FNV-1a, so an unlisted vendor keeps the same hue between renders and between sessions. */
function hashHue(vendor: string): number {
  let hash = 2166136261;
  for (let index = 0; index < vendor.length; index += 1) {
    hash ^= vendor.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}
