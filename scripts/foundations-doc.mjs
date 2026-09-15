#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Generates the color reference from the token files themselves.
 *
 *   node scripts/foundations-doc.mjs           write the page
 *   node scripts/foundations-doc.mjs --check   fail if the page is out of date
 *
 * A color token's name is in `tokens.css` or `semantic.css`, its value is
 * there twice -- once per theme -- and the contrast it reaches on a surface
 * follows from both. Transcribing any of that onto a page produces a second
 * copy that is wrong the first time a hue moves, so this reads the files and
 * `--check` runs in `validate`: a palette that changes without the page
 * changing is a failed build rather than a stale page.
 *
 * Values are resolved the way the cascade resolves them, so a token defined as
 * a `var()` chain or a `color-mix()` arrives as the color a visitor sees.
 * Inks that read a `--sl-color-*` variable land on the fallback `tokens.css`
 * declares, which restates Starlight's own value; a site that customizes the
 * Starlight ramp moves those inks and the ratios with them.
 *
 * Every `--helia-` token that resolves to a color must land in a group. An
 * unclassified one fails rather than being dropped, so a new color cannot be
 * added without deciding what it is for.
 */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import prettier from 'prettier';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCES = ['tokens.css', 'semantic.css'];
const OUT_PATH = join(
  PACKAGE_ROOT,
  'docs/src/content/docs/foundations/tokens.mdx',
);

/** The docs site's base path. Its own `astro.config.mjs` sets the same value. */
const DOCS_BASE = '/helia-ui';

/** The two grounds a body of text is drawn on, so a ratio is one a page reaches. */
const CONTRAST_SURFACES = ['--helia-surface-canvas', '--helia-surface-card'];

/**
 * Inks for a backdrop that does not follow the theme -- the terminal tone, the
 * brand panels -- so a ratio against the themed canvas would describe a pairing
 * nothing draws.
 */
const FIXED_BACKDROP_INKS = new Set([
  '--helia-ink-black',
  '--helia-ink-adaptive',
]);

/** WCAG AA for body text. */
const AA = 4.5;

const failures = [];

/* ------------------------------------------------------------------ parsing */

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Split on a separator that sits outside every bracket. */
function splitTop(text, separator) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * The custom properties each top-level rule declares, keyed by its selector
 * list. At-rules are skipped whole: `@font-face` declares no token, and the
 * reduced-motion block is the visitor's preference rather than a theme.
 */
function rules(source) {
  const text = stripComments(source);
  const found = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('{', index);
    if (open === -1) break;
    const selector = text.slice(index, open).trim();
    let depth = 0;
    let close = open;
    for (; close < text.length; close += 1) {
      if (text[close] === '{') depth += 1;
      if (text[close] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = text.slice(open + 1, close);
    index = close + 1;
    if (selector.startsWith('@')) continue;
    const declarations = [];
    for (const statement of splitTop(body, ';')) {
      const match = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(statement);
      if (match) declarations.push([match[1], match[2].replace(/\s+/g, ' ')]);
    }
    found.push({ selector, declarations });
  }
  return found;
}

/** `:root` is the dark theme; the light attribute selector is the flip. */
const BASE_SELECTOR = /^(:root|\[data-helia-theme\]|\.helia-theme-scope)$/;
const LIGHT_SELECTOR = /^:root\[data-theme='light'\]$/;

function readThemes() {
  const base = new Map();
  const light = new Map();
  const order = [];
  const origin = new Map();

  for (const file of SOURCES) {
    const source = readFileSync(join(PACKAGE_ROOT, file), 'utf8');
    for (const rule of rules(source)) {
      const parts = splitTop(rule.selector, ',');
      const isBase = parts.some((part) => BASE_SELECTOR.test(part));
      const isLight = parts.some((part) => LIGHT_SELECTOR.test(part));
      if (!isBase && !isLight) continue;
      for (const [name, value] of rule.declarations) {
        if (isBase) {
          if (!base.has(name)) {
            order.push(name);
            origin.set(name, file);
          }
          base.set(name, value);
        } else {
          light.set(name, value);
        }
      }
    }
  }

  return {
    order,
    origin,
    dark: base,
    light: new Map([...base, ...light]),
  };
}

/* --------------------------------------------------------------- resolution */

/** Substitutes every `var()`, taking the fallback when the name is unset. */
function resolve(value, map, seen = new Set()) {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf('var(', index);
    if (start === -1) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, start);
    let depth = 0;
    let end = start + 3;
    for (; end < value.length; end += 1) {
      if (value[end] === '(') depth += 1;
      if (value[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const inner = value.slice(start + 4, end);
    const [name, ...rest] = splitTop(inner, ',');
    const fallback = rest.join(', ');
    if (map.has(name) && !seen.has(name)) {
      out += resolve(map.get(name), map, new Set([...seen, name]));
    } else {
      out += fallback ? resolve(fallback, map, seen) : '';
    }
    index = end + 1;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------- color */

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function hueToChannel(p, q, t) {
  let shifted = t;
  if (shifted < 0) shifted += 1;
  if (shifted > 1) shifted -= 1;
  if (shifted < 1 / 6) return p + (q - p) * 6 * shifted;
  if (shifted < 1 / 2) return q;
  if (shifted < 2 / 3) return p + (q - p) * (2 / 3 - shifted) * 6;
  return p;
}

/** sRGB channels 0-255 and an alpha, or null when the value is not a color. */
function parseColor(value) {
  const text = value.trim();
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = /^#([0-9a-fA-F]{3,8})$/.exec(text);
  if (hex) {
    const digits = hex[1];
    const expand = (pair) => parseInt(pair, 16);
    if (digits.length === 3 || digits.length === 4) {
      const channels = [...digits].map((digit) => expand(digit + digit));
      return {
        r: channels[0],
        g: channels[1],
        b: channels[2],
        a: channels[3] === undefined ? 1 : channels[3] / 255,
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      const channels = digits.match(/../g).map(expand);
      return {
        r: channels[0],
        g: channels[1],
        b: channels[2],
        a: channels[3] === undefined ? 1 : channels[3] / 255,
      };
    }
    return null;
  }

  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(text);
  if (!fn) return null;
  const args = fn[2]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  const alpha = (raw) => {
    if (raw === undefined) return 1;
    return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
  };

  if (fn[1].startsWith('rgb')) {
    const [r, g, b, a] = args;
    const channel = (raw) =>
      raw.endsWith('%') ? (parseFloat(raw) / 100) * 255 : parseFloat(raw);
    return { r: channel(r), g: channel(g), b: channel(b), a: alpha(a) };
  }

  const [h, s, l, a] = args;
  const hue = (parseFloat(h) % 360) / 360;
  const saturation = parseFloat(s) / 100;
  const lightness = parseFloat(l) / 100;
  if (saturation === 0) {
    const gray = lightness * 255;
    return { r: gray, g: gray, b: gray, a: alpha(a) };
  }
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: hueToChannel(p, q, hue + 1 / 3) * 255,
    g: hueToChannel(p, q, hue) * 255,
    b: hueToChannel(p, q, hue - 1 / 3) * 255,
    a: alpha(a),
  };
}

/** `color-mix(in srgb, a p%, b q%)`, premultiplied as the spec mixes it. */
function parseMix(value) {
  const match = /^color-mix\(\s*in\s+srgb\s*,([\s\S]*)\)$/.exec(value.trim());
  if (!match) return null;
  const operands = splitTop(match[1], ',');
  if (operands.length !== 2) return null;

  const read = (operand) => {
    const percent = /\s(-?[\d.]+)%$/.exec(operand);
    const colorText = percent
      ? operand.slice(0, percent.index).trim()
      : operand.trim();
    const color = toColor(colorText);
    return color
      ? { color, weight: percent ? parseFloat(percent[1]) : null }
      : null;
  };

  const parts = operands.map(read);
  if (parts.some((part) => part === null)) return null;

  const given = parts.filter((part) => part.weight !== null);
  if (given.length === 0) {
    parts[0].weight = 50;
    parts[1].weight = 50;
  } else if (given.length === 1) {
    const other = parts.find((part) => part.weight === null);
    other.weight = 100 - given[0].weight;
  }

  const total = parts[0].weight + parts[1].weight;
  if (total === 0) return null;
  const w0 = parts[0].weight / total;
  const w1 = parts[1].weight / total;
  const a = parts[0].color.a * w0 + parts[1].color.a * w1;
  const channel = (key) => {
    if (a === 0) return 0;
    return (
      (parts[0].color[key] * parts[0].color.a * w0 +
        parts[1].color[key] * parts[1].color.a * w1) /
      a
    );
  };
  return { r: channel('r'), g: channel('g'), b: channel('b'), a };
}

function toColor(value) {
  return parseMix(value) ?? parseColor(value);
}

function hex({ r, g, b, a }) {
  const pair = (channel) =>
    Math.round(clamp(channel, 0, 255))
      .toString(16)
      .padStart(2, '0');
  const alpha = a < 1 ? pair(a * 255) : '';
  return `#${pair(r)}${pair(g)}${pair(b)}${alpha}`;
}

/**
 * The value as written wherever the file already writes a color, so the page
 * reads like the declaration; a `var()` chain or a mix is rendered as the hex
 * it computes to, alpha included, since the alpha is half of what a shadow ink
 * is.
 */
function swatchValue(value, color) {
  const text = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return text.toLowerCase();
  if (/^(rgba?|hsla?)\([^)]*\)$/.test(text)) return text;
  return hex(color);
}

function luminance({ r, g, b }) {
  const channel = (raw) => {
    const srgb = clamp(raw, 0, 255) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function over(color, backdrop) {
  if (color.a === 1) return color;
  const blend = (key) => color[key] * color.a + backdrop[key] * (1 - color.a);
  return { r: blend('r'), g: blend('g'), b: blend('b'), a: 1 };
}

function contrast(ink, surface) {
  const drawn = over(ink, surface);
  const a = luminance(drawn);
  const b = luminance(surface);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/* ----------------------------------------------------------- classification */

/**
 * What each color is for. The order is the order of the page, and the first
 * matching rule wins, so a name that reads two ways -- an accent that is also
 * an ink -- lands where it is used rather than where it sorts.
 */
const GROUPS = [
  {
    id: 'primitives',
    title: 'Primitives',
    blurb:
      'The shared layer in `tokens.css`. Every other color resolves to one of these or sits beside them, and the theme flip moves them rather than moving what reads them.',
    matches: (name, file) => file === 'tokens.css',
  },
  {
    id: 'surfaces',
    title: 'Surfaces',
    blurb:
      'The grounds a page draws on, from the canvas behind everything to the muted card. A site tints the whole set through `--helia-surface-tint`, so a product surface stays on the scale.',
    matches: (name) =>
      /^--helia-surface-/.test(name) || name === '--helia-paper-white',
  },
  {
    id: 'inks',
    title: 'Inks',
    blurb:
      'Text color by role rather than by hue. Primary carries titles and values, secondary carries description, muted carries metadata.',
    matches: (name) => /^--helia-ink-/.test(name),
  },
  {
    id: 'status',
    title: 'Status inks',
    blurb:
      'The advisory meanings chosen as text. Anything that sets a status color on a word takes one of these; the fills below are for an icon, a rim, or an edge.',
    matches: (name) => /^--helia-tone-[\w-]+-ink$/.test(name),
  },
  {
    id: 'accents',
    title: 'Accents',
    blurb:
      'The whole color vocabulary a part is handed. A part never learns a subject name: a composition maps its own subjects onto an accent and passes it as `--accent`.',
    matches: (name) => /^--helia-(accent|product-accent|brand-)/.test(name),
  },
  {
    id: 'tones',
    title: 'Advisory tones',
    blurb:
      'One fill per callout and badge variant, plus the theme-aware set a chip rim reads. These are strokes and fills, not text.',
    matches: (name) => /^--helia-tone-/.test(name),
  },
  {
    id: 'charts',
    title: 'Chart palette',
    blurb:
      'Six series colors off the accent scale, plus the gridline and the tick ink. The order is the order a chart uses them, so the first two are the pair that has to separate at a glance; a chart that needs a seventh hue is a chart that needs splitting.',
    matches: (name) => /^--helia-chart-/.test(name),
  },
  {
    id: 'elevation',
    title: 'Shadow inks',
    blurb:
      'The three shadow colors the elevation steps are built from. Each one is a black at a low alpha, so a shadow darkens whatever it falls on rather than tinting it.',
    matches: (name) => /^--helia-shadow-color/.test(name),
  },
  {
    id: 'art',
    title: 'Generative art',
    blurb:
      'Surfaces, strokes, and planes for the abstract media treatments. They are a palette for artwork rather than for interface, which is why they sit apart from the accents.',
    matches: (name) => /^--helia-(field-|media-)/.test(name),
  },
];

/* ---------------------------------------------------------------- gathering */

function gather() {
  const { order, origin, dark, light } = readThemes();
  const groups = new Map(GROUPS.map((group) => [group.id, []]));
  const colors = new Map();

  for (const name of order) {
    if (!name.startsWith('--helia-')) continue;
    const rawDark = resolve(dark.get(name), dark);
    const rawLight = resolve(light.get(name), light);
    const darkColor = toColor(rawDark);
    const lightColor = toColor(rawLight);
    if (!darkColor || !lightColor) continue;
    /* A dial that names no color of its own, such as the surface tint. */
    if (darkColor.a === 0 && lightColor.a === 0) continue;

    const group = GROUPS.find((candidate) =>
      candidate.matches(name, origin.get(name)),
    );
    if (!group) {
      failures.push(`${name}: resolves to a color and belongs to no group.`);
      continue;
    }

    const entry = {
      name,
      file: origin.get(name),
      light: swatchValue(rawLight, lightColor),
      dark: swatchValue(rawDark, darkColor),
      lightColor,
      darkColor,
    };
    groups.get(group.id).push(entry);
    colors.set(name, entry);
  }

  return { groups, colors };
}

function contrastRows(groups, colors) {
  const inks = [
    ...groups.get('inks').filter((ink) => !FIXED_BACKDROP_INKS.has(ink.name)),
    ...groups.get('status'),
  ];

  return inks.map((ink) => ({
    name: ink.name,
    cells: CONTRAST_SURFACES.flatMap((surfaceName) => {
      const surface = colors.get(surfaceName);
      if (!surface) {
        failures.push(`${surfaceName}: no color for the contrast table.`);
        return [];
      }
      return ['light', 'dark'].map((theme) => {
        const inkColor = theme === 'light' ? ink.lightColor : ink.darkColor;
        const surfaceColor =
          theme === 'light' ? surface.lightColor : surface.darkColor;
        const ratio = contrast(inkColor, surfaceColor);
        return {
          theme,
          surface: surfaceName,
          ink: theme === 'light' ? ink.light : ink.dark,
          background: theme === 'light' ? surface.light : surface.dark,
          ratio,
          passes: ratio >= AA,
        };
      });
    }),
  }));
}

/* ----------------------------------------------------------------- rendering */

function data(value) {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join('\n');
}

function section(group, entries) {
  return [
    `## ${group.title}`,
    '',
    group.blurb,
    '',
    `<TokenSwatchGrid group="${group.id}" tokens={${data(
      entries.map(({ name, light, dark, file }) => ({
        name,
        light,
        dark,
        file,
      })),
    )}} />`,
    '',
  ].join('\n');
}

function render({ groups, rows }) {
  const lines = [
    '---',
    'title: Color tokens',
    'description: Every HELIA color token with its value in both themes and the contrast each ink reaches on a surface.',
    '---',
    '',
    '{/* Generated by scripts/foundations-doc.mjs. Edit the token files, not this file. */}',
    '',
    "import TokenSwatchGrid from '../../../components/TokenSwatchGrid.astro';",
    "import TokenContrast from '../../../components/TokenContrast.astro';",
    '',
    'Every `--helia-` token that resolves to a color, read out of `tokens.css`',
    'and `semantic.css`: the name, the value each theme gives it, and the ratio',
    'each ink reaches on the two grounds a page draws text on. A palette that',
    'moves without this page moving fails `validate`, so what is here is what the',
    'package ships.',
    '',
    `The [overview](${DOCS_BASE}/foundations/) says what the layers are for and`,
    'shows the rest of the scales. A value written as a `var()` chain or a',
    '`color-mix()` is resolved here to the color it computes to, and an ink that',
    'reads a Starlight variable resolves through the fallback `tokens.css`',
    "declares, which restates Starlight's own value.",
    '',
  ];

  for (const group of GROUPS) {
    const entries = groups.get(group.id);
    if (entries.length === 0) continue;
    lines.push(section(group, entries));
  }

  lines.push(
    '## Ink on surface',
    '',
    `Each ink drawn on the canvas and on the card, in both themes, with the`,
    'contrast ratio computed from the two resolved values. `AA` marks a pair at',
    `or above ${AA}:1, which is the WCAG AA threshold for body text.`,
    '',
    `<TokenContrast rows={${data(rows)}} />`,
    '',
  );

  return lines.join('\n');
}

/* --------------------------------------------------------------------- main */

const { groups, colors } = gather();
const rows = contrastRows(groups, colors);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} color token problem${failures.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

const config = await prettier.resolveConfig(OUT_PATH);
const output = await prettier.format(render({ groups, rows }), {
  ...config,
  filepath: OUT_PATH,
  parser: 'mdx',
});

const total = [...groups.values()].reduce(
  (count, entries) => count + entries.length,
  0,
);

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT_PATH, 'utf8');
  } catch {
    current = '';
  }
  if (current !== output) {
    const scratch = join(
      mkdtempSync(join(tmpdir(), 'helia-foundations-doc-')),
      'tokens.mdx',
    );
    writeFileSync(scratch, output);
    console.error(
      `${OUT_PATH} is out of date.\nGenerated form: ${scratch}\nRun: node packages/helia-ui/scripts/foundations-doc.mjs`,
    );
    process.exit(1);
  }
  console.log(
    `foundations-doc: ${total} color tokens, ${rows.length} inks, reference up to date.`,
  );
} else {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, output);
  console.log(
    `foundations-doc: ${total} color tokens, ${rows.length} inks written to ${OUT_PATH}.`,
  );
}
