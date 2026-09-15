// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The shipped series palette and the three that were weighed against it, with
 * the arithmetic that says how far apart their steps are.
 *
 * `--helia-chart-1..6` used to alias the advisory tones, so a chart reused the
 * colors a callout uses to mean success, information and warning and the first
 * two series landed on green and blue. The first entry below is what
 * semantic.css resolves to now, restated so a block can draw both grounds at
 * once; it is the sheet's value and not a proposal, and the smoke suite reads
 * it back against the document so the two cannot drift. The other three stay
 * as the record of what else was on the table.
 *
 * Every step is derived from the brand scale in the package sheets rather than
 * invented. The slate ramp takes the OKLCH hue and chroma of
 * `--helia-accent-slate` (#667085) and steps the lightness; the chromatic
 * steps take the hue and chroma of `--helia-accent-cyan` (#00a7b5),
 * `--helia-accent-orange` (#e17827), `--helia-accent-purple` (#6e5ae6) and
 * `--helia-accent-pink` (#d34c80) at whatever lightness the ground calls for,
 * with chroma reduced until the result is inside sRGB. Slate also sheds chroma
 * as it climbs, or the top of the ramp reads as pale blue. Nothing here is a
 * tone: an advisory color has a meaning, and a series does not.
 *
 * The two grounds are the card surfaces, #0d1017 and #ffffff, so a step is
 * chosen against the surface it is drawn on. The shipped palette clears 3:1 on
 * both, which is the graphic-object threshold a line or a bar is held to. The
 * three candidates were drawn to 2.5:1, and the neutral-heavy ones sit at that
 * floor -- part of why the palette that shipped is not one of them.
 */

export type PaletteGround = 'dark' | 'light';

export interface PaletteStep {
  /** What the step is for, in the order a chart takes them. */
  role: string;
  dark: string;
  light: string;
}

export interface ChartPaletteCandidate {
  id: string;
  /** What the page labels it with: a letter, or `Shipped`. */
  label: string;
  name: string;
  /** The rule the palette follows, in one sentence. */
  premise: string;
  /** What it costs, stated next to what it buys. */
  tradeoff: string;
  steps: PaletteStep[];
}

/*
 * The page ink is the only step that is not on a ramp: it is the color the
 * surrounding prose is set in, which is what makes an ink-led palette read as
 * part of the page rather than as a chart dropped onto it.
 */
const INK = { dark: '#f0f1f2', light: '#111318' };

export const chartPalettes: ChartPaletteCandidate[] = [
  {
    id: 'shipped',
    label: 'Shipped',
    name: 'Blue and ink',
    premise:
      'A light modern blue against the page ink, and a slate ramp at decreasing weight behind them.',
    tradeoff:
      'The first two series separate on lightness as well as hue, which is the widest separation six steps can offer, and nothing in it carries an advisory meaning. The four slate steps are a ramp and nothing else, so a chart that uses all six leans on order rather than on color.',
    /*
     * Not a candidate: this is what `--helia-chart-1..6` resolve to in
     * semantic.css today, restated here so the block can draw both grounds on
     * a page that is only ever in one. `--helia-chart-2` is
     * `--helia-ink-primary`, which Starlight resolves to these two values.
     * The smoke suite reads the shipped dark block back against the document's
     * own properties, so a drift between this list and the sheet fails.
     */
    steps: [
      { role: 'Blue', dark: '#7fb0ff', light: '#4f8ff7' },
      { role: 'Page ink', dark: '#ffffff', light: '#17181c' },
      { role: 'Slate 1', dark: '#9ba5ba', light: '#4e586c' },
      { role: 'Slate 2', dark: '#828ca2', light: '#656f84' },
      { role: 'Slate 3', dark: '#6a758a', light: '#768096' },
      { role: 'Slate 4', dark: '#596378', light: '#8892a8' },
    ],
  },
  {
    id: 'a',
    label: 'A',
    name: 'Ink-led',
    premise:
      'The page ink leads, the product accent answers it, and color arrives only at the fifth and sixth series.',
    tradeoff:
      'Two series read as type and figure rather than as two hues, which is the calmest of the three. Four of the six steps are neutral, so the palette is the hardest to tell apart once a chart uses all of it.',
    steps: [
      { role: 'Page ink', ...INK },
      { role: 'Product accent', dark: '#a1abc0', light: '#687287' },
      { role: 'Slate mid', dark: '#768096', light: '#394255' },
      { role: 'Slate far', dark: '#4e586c', light: '#949fb4' },
      { role: 'Amber', dark: '#fd9146', light: '#c46101' },
      { role: 'Violet', dark: '#8e84ff', light: '#624bd6' },
    ],
  },
  {
    id: 'b',
    label: 'B',
    name: 'Accent-led',
    premise:
      'Five brand hues at one OKLCH lightness, so no series is louder than another, with the page ink as the sixth.',
    tradeoff:
      'The most distinguishable of the three and the only one that holds six series honestly. It is also the most color on a page that has very little, and five hues at one lightness is a palette a reader has to learn.',
    steps: [
      { role: 'Product accent', dark: '#8892a8', light: '#687287' },
      { role: 'Teal', dark: '#02a5b3', light: '#01818c' },
      { role: 'Amber', dark: '#da721e', light: '#ae5500' },
      { role: 'Violet', dark: '#887cff', light: '#6a55e1' },
      { role: 'Rose', dark: '#e35b8e', light: '#bd376e' },
      { role: 'Page ink', ...INK },
    ],
  },
  {
    id: 'c',
    label: 'C',
    name: 'Monochrome plus one',
    premise:
      'One highlighted series in amber and five slate steps behind it, so the chart says which series the sentence is about.',
    tradeoff:
      'Unmistakable when one series is the point. The five neutrals are a lightness ramp and nothing else, so they separate worst of the three and a six-series chart in this palette is a legend lookup.',
    steps: [
      { role: 'Highlight', dark: '#fd9146', light: '#c46101' },
      { role: 'Slate 1', dark: '#d5def0', light: '#131a2b' },
      { role: 'Slate 2', dark: '#aeb8cc', light: '#2f384a' },
      { role: 'Slate 3', dark: '#8892a8', light: '#4e586c' },
      { role: 'Slate 4', dark: '#687287', light: '#707a90' },
      { role: 'Slate 5', dark: '#4c5569', light: '#949fb4' },
    ],
  },
];

/** The same four, by their label, so a page can name one. */
export const paletteById: Record<string, ChartPaletteCandidate> =
  Object.fromEntries(chartPalettes.map((palette) => [palette.id, palette]));

/**
 * The ground a palette block is drawn on, so both themes can stand side by
 * side on a page that is only ever in one of them.
 *
 * The values are the package's own: the card surface and hairline from
 * tokens.css, and the ink ramp from the Starlight fallbacks the same file
 * restates. A block sets them on its wrapper and everything under it -- the
 * figure, its type, its gridlines -- resolves against the block rather than
 * against the page.
 */
export const paletteGrounds: Record<
  PaletteGround,
  {
    label: string;
    surface: string;
    hairline: string;
    inkPrimary: string;
    inkSecondary: string;
    inkMuted: string;
  }
> = {
  dark: {
    label: 'Dark',
    surface: '#0d1017',
    hairline: '#242936',
    inkPrimary: 'hsl(0, 0%, 100%)',
    inkSecondary: 'hsl(224, 6%, 77%)',
    inkMuted: 'hsl(224, 6%, 56%)',
  },
  light: {
    label: 'Light',
    surface: '#ffffff',
    hairline: '#dfe3e8',
    inkPrimary: 'hsl(224, 10%, 10%)',
    inkSecondary: 'hsl(224, 10%, 23%)',
    inkMuted: 'hsl(224, 7%, 36%)',
  },
};

function toLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function toLab(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) =>
    toLinear(parseInt(value.slice(offset, offset + 2), 16) / 255),
  ) as [number, number, number];
  /* sRGB to CIEXYZ under D65, then XYZ to Lab against the D65 white point. */
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29;
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function hueOf(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const angle = Math.atan2(b, a) * DEG;
  return angle < 0 ? angle + 360 : angle;
}

/**
 * CIEDE2000, the full formula, on two sRGB hex colors.
 *
 * A palette is only distinguishable if its closest pair is, and "closest" has
 * to be measured perceptually: two slate steps eight sRGB units apart and two
 * hues eight units apart are not the same problem. The scale is the usual one
 * -- around 1 is the just-noticeable difference for two adjacent patches, and
 * two marks separated across a chart need considerably more than that.
 */
export function deltaE00(first: string, second: string): number {
  const [l1, a1, b1] = toLab(first);
  const [l2, a2, b2] = toLab(second);
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const meanC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));
  const ap1 = (1 + g) * a1;
  const ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1);
  const cp2 = Math.hypot(ap2, b2);
  const hp1 = hueOf(ap1, b1);
  const hp2 = hueOf(ap2, b2);

  const deltaL = l2 - l1;
  const deltaC = cp2 - cp1;
  let deltah = 0;
  if (cp1 * cp2 !== 0) {
    deltah = hp2 - hp1;
    if (deltah > 180) deltah -= 360;
    else if (deltah < -180) deltah += 360;
  }
  const deltaH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((deltah * RAD) / 2);

  const meanL = (l1 + l2) / 2;
  const meanCp = (cp1 + cp2) / 2;
  let meanHp: number;
  if (cp1 * cp2 === 0) meanHp = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) <= 180) meanHp = (hp1 + hp2) / 2;
  else meanHp = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos((meanHp - 30) * RAD) +
    0.24 * Math.cos(2 * meanHp * RAD) +
    0.32 * Math.cos((3 * meanHp + 6) * RAD) -
    0.2 * Math.cos((4 * meanHp - 63) * RAD);
  const rotation = 30 * Math.exp(-(((meanHp - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7));
  const sl =
    1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
  const sc = 1 + 0.045 * meanCp;
  const sh = 1 + 0.015 * meanCp * t;
  const rt = -Math.sin(2 * rotation * RAD) * rc;

  return Math.sqrt(
    (deltaL / sl) ** 2 +
      (deltaC / sc) ** 2 +
      (deltaH / sh) ** 2 +
      rt * (deltaC / sc) * (deltaH / sh),
  );
}

export interface Separation {
  /** The smallest CIEDE2000 distance in the set. */
  delta: number;
  /** The two steps that are that close, numbered as a chart takes them. */
  between: [number, number];
}

/** The closest pair in a palette, which is the pair that decides it. */
export function minimumSeparation(colors: readonly string[]): Separation {
  let delta = Infinity;
  let between: [number, number] = [1, 2];
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      const candidate = deltaE00(colors[i]!, colors[j]!);
      if (candidate < delta) {
        delta = candidate;
        between = [i + 1, j + 1];
      }
    }
  }
  return { delta, between };
}

/** The six steps of a palette on one ground, in chart order. */
export function paletteColours(
  palette: ChartPaletteCandidate,
  ground: PaletteGround,
): string[] {
  return palette.steps.map((step) => step[ground]);
}
