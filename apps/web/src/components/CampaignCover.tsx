import { createMemo, createUniqueId, For, Show } from "solid-js";

/**
 * A campaign's picture, wherever one is shown: the cards in the left sidebar and the cover in
 * the campaign's own sidebar. One component so those never drift — a campaign looks the same
 * in the list you pick it from and in the campaign you picked.
 *
 * It fills whatever box it is given and crops to it, so the caller owns the shape. Today every
 * box is a square — the card in the left rail, the cover atop the right one — but the
 * placeholder is composed 16:9, the cover's natural shape, so a wider box can come later
 * without the picture changing.
 */
export function CampaignCover(props: {
  src?: string | undefined;
  /** Identifies the campaign. Picks the placeholder's colour and composition; nothing else reads it. */
  seed: string;
  class?: string | undefined;
}) {
  return (
    <Show when={props.src} fallback={<CoverPlaceholder seed={props.seed} class={props.class} />}>
      {(src) => (
        // Decorative: every cover sits inside a control that already carries the campaign's name.
        <img src={src()} alt="" class={`h-full w-full object-cover ${props.class ?? ""}`} />
      )}
    </Show>
  );
}

/**
 * The frame the placeholder is composed in. 16:9, the cover's largest shape; the square card
 * takes the centre of it, so both places show the same picture rather than two compositions.
 */
const WIDTH = 320;
const HEIGHT = 180;

/**
 * How far each shape is blurred, in frame units. Enough that four ellipses stop being four
 * ellipses and become one wash of colour with soft regions in it; less and the edges show.
 */
const BLUR = 22;

/**
 * The shapes, back to front. Each takes one point on the ramp and a size; where it lands is
 * the seed's to decide. The lightest shape is second so the darkest can cut into it, which is
 * what keeps a cover from reading as one pale cloud.
 */
const SHAPES = [
  { step: 0.7, rx: 130, ry: 75, opacity: 1 },
  { step: 1.0, rx: 95, ry: 55, opacity: 0.95 },
  { step: 0.0, rx: 110, ry: 60, opacity: 0.85 },
  { step: 0.45, rx: 80, ry: 45, opacity: 0.9 },
] as const;

/**
 * Where a shape may be centred: one cell per shape, a 2×2 grid over the frame. Each shape is
 * dealt a cell and jittered inside it. Left to land anywhere, some seeds put all four in one
 * corner and the rest of the cover is bare ground; dealt a cell each, every seed spreads.
 */
const CELLS = [
  { x: 80, y: 45 },
  { x: 240, y: 45 },
  { x: 80, y: 135 },
  { x: 240, y: 135 },
];
const JITTER = { x: 50, y: 30 };

type Shape = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number;
  fill: string;
  opacity: number;
};

/**
 * Stands in for a campaign that has chosen no image: a marble in the campaign's own colour.
 *
 * The hue comes from a hash of the seed, so a campaign keeps its colour for as long as it
 * exists, on every device, with nothing stored — and two campaigns side by side are told apart
 * by colour before either name is read.
 *
 * The ramp is hue-shifted rather than a single hue made lighter: the dark end turns one way
 * around the wheel and the light end the other, with chroma peaking in the middle and falling
 * off at both ends. That is how a painted ramp behaves and why it reads as a picture; a ramp
 * that only changes lightness reads as a tint of one colour.
 *
 * The seed also picks the ramp's register: how dark its dark end goes, how light its light
 * end, how much chroma it carries, and how far round the wheel it travels. So one campaign is
 * deep and saturated, the next pastel, the next a hard contrast between the two. The one rule
 * is a floor on the distance between the ends, so no campaign lands on a flat tint; and chroma
 * is capped as lightness rises, so the pastel end stays a pastel and not a clipped neon.
 *
 * The picture is four soft shapes in the ramp's colours, blurred into one another over a
 * ground of the same ramp. It is plain SVG — no noise, no canvas — so the aspect-ratio morph
 * in the campaign sidebar rescales it rather than re-drawing it, and the same drawing serves
 * the 40px rail card and the 240px cover.
 */
export function CoverPlaceholder(props: { seed: string; class?: string | undefined }) {
  const id = createUniqueId();
  const scene = createMemo(() => composeMarble(props.seed));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      class={`block h-full w-full ${props.class ?? ""}`}
      aria-hidden="true"
    >
      <defs>
        {/* The region is widened so a shape blurred near the edge is not clipped to a hard line. */}
        <filter id={id} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={BLUR} />
        </filter>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill={scene().ground} />
      <For each={scene().shapes}>
        {(shape) => (
          <ellipse
            cx={shape.cx}
            cy={shape.cy}
            rx={shape.rx}
            ry={shape.ry}
            fill={shape.fill}
            opacity={shape.opacity}
            transform={`rotate(${shape.rotate} ${shape.cx} ${shape.cy})`}
            filter={`url(#${id})`}
          />
        )}
      </For>
    </svg>
  );
}

function composeMarble(seed: string): { ground: string; shapes: Shape[] } {
  const hash = hashOf(seed);
  const hue = hash % 360;
  // Which way round the wheel the ramp travels. Two campaigns on the same base hue read as
  // two colours rather than one repeated.
  const direction = (hash >>> 9) % 2 === 0 ? 1 : -1;
  const random = mulberry32(hash);
  const register = drawRegister(random);
  const colour = (step: number): string => {
    const lightness = register.low + (register.high - register.low) * step;
    // Peaks at the middle of the ramp and eases off at the ends. The ceiling is what sRGB can
    // hold: it has little room for chroma near white, and a pastel pushed past it clips to neon.
    const ceiling = 0.05 + 0.3 * (1 - lightness);
    const chroma = Math.min(register.chroma, ceiling) * (0.7 + 0.3 * Math.sin(Math.PI * step));
    const shifted = hue + direction * register.spread * (step - 0.5);
    return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${shifted.toFixed(1)})`;
  };

  const cells = shuffle(CELLS, random);
  const shapes = SHAPES.map((shape, index) => {
    const cell = cells[index] ?? { x: WIDTH / 2, y: HEIGHT / 2 };
    const cx = cell.x + (random() * 2 - 1) * JITTER.x;
    const cy = cell.y + (random() * 2 - 1) * JITTER.y;
    return {
      cx: round(cx),
      cy: round(cy),
      rx: shape.rx,
      ry: shape.ry,
      rotate: round(random() * 180),
      fill: colour(shape.step),
      opacity: shape.opacity,
    };
  });

  return { ground: colour(0.15), shapes };
}

/**
 * The ramp's register: the lightness of its dark end and its light end, its peak chroma, and
 * how far round the wheel the hue travels between the ends. Drawn from the seed so campaigns
 * differ in tone, not only in hue: a dark end anywhere from deep to mid, a light end from mid
 * to pastel, chroma from quiet to rich.
 *
 * The ends are held at least `MINIMUM_CONTRAST` apart. Without that, a mid dark end and a mid
 * light end could meet, and the cover would be one flat tint with nothing in it to see.
 */
type Register = { low: number; high: number; chroma: number; spread: number };

const MINIMUM_CONTRAST = 0.36;

function drawRegister(random: () => number): Register {
  const low = 0.2 + random() * 0.32;
  const high = Math.min(0.9, Math.max(0.62 + random() * 0.28, low + MINIMUM_CONTRAST));
  const chroma = 0.09 + random() * 0.09;
  const spread = 100 + random() * 70;
  return { low, high, chroma, spread };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

/** FNV-1a. Any stable spread over the seed would do; this one is short and has no state. */
function hashOf(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A small seeded generator. The hash alone gives one number; the composition needs a dozen,
 * all fixed by the seed, and this turns the one into as many as are asked for.
 */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
