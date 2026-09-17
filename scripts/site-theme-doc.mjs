#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Generates the site theme reference from the contract file itself.
 *
 *   node scripts/site-theme-doc.mjs           write the page
 *   node scripts/site-theme-doc.mjs --check   fail if the page is out of date
 *
 * The contract of a dial is its name, its default, and the sentences that say
 * what it moves and what it accepts. The name and the default are already in
 * `site-theme.css` as a declaration, and the sentences are already in the
 * comment above it, so a hand-written table would be a second copy of both and
 * would drift the first time a default changed. This reads them instead, which
 * is why `--check` runs in `validate`.
 *
 * The defaults are not transcribed from the comment: the `default:` field is
 * compared against the declared value and a mismatch fails, so a comment
 * cannot describe a dial the file does not set. A declaration with no block,
 * or a block naming a property the file does not declare, fails the same way.
 *
 * The worked examples stay in the docs app: they need the parts rendered, and
 * a second theme is a thing a site has rather than a thing the package ships.
 */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import prettier from 'prettier';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTRACT_PATH = join(PACKAGE_ROOT, 'site-theme.css');
const OUT_PATH = join(
  PACKAGE_ROOT,
  'docs/src/content/docs/foundations/site-theme.mdx',
);

/** Every field a dial block must carry. `default` may repeat; the rest may not. */
const FIELDS = ['dial', 'changes', 'values', 'default', 'reads'];

const failures = [];

/* ------------------------------------------------------------------ parsing */

/** The `/** ... *\/` blocks, in file order. Plain `/* *\/` comments are prose. */
function dialBlocks(source) {
  return [...source.matchAll(/\/\*\*([\s\S]*?)\*\//g)].map((match) =>
    match[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim(),
  );
}

/*
 * A field runs from its `name:` line to the next one, so a sentence can wrap
 * on to as many indented lines as it needs and still arrive as one cell.
 */
function parseFields(text) {
  const fields = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    const start = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (start && FIELDS.includes(start[1])) {
      current = start[1];
      if (!fields.has(current)) fields.set(current, []);
      fields.get(current).push(start[2]);
      continue;
    }
    if (!current) continue;
    const values = fields.get(current);
    values[values.length - 1] = `${values[values.length - 1]} ${line.trim()}`;
  }
  for (const [key, values] of fields) {
    fields.set(
      key,
      values.map((value) => value.replace(/\s+/g, ' ').trim()),
    );
  }
  return fields;
}

/** The declarations in the file's one `:root` block, in order. */
function rootDeclarations(source) {
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(source);
  if (!block) {
    failures.push('site-theme.css: no :root block.');
    return new Map();
  }
  const declarations = new Map();
  for (const match of block[1].matchAll(/^\s{2}(--[\w-]+):\s*([\s\S]*?);$/gm)) {
    declarations.set(match[1], match[2].replace(/\s+/g, ' ').trim());
  }
  return declarations;
}

function readDials(source) {
  const declarations = rootDeclarations(source);
  const claimed = new Set();
  const dials = [];

  for (const block of dialBlocks(source)) {
    const fields = parseFields(block);
    const label = fields.get('dial')?.[0] ?? '(unnamed)';

    for (const field of FIELDS) {
      if (!fields.has(field))
        failures.push(`${label}: no \`${field}:\` field.`);
    }
    for (const field of FIELDS) {
      if (field !== 'default' && (fields.get(field)?.length ?? 0) > 1) {
        failures.push(`${label}: \`${field}:\` given more than once.`);
      }
    }
    if (FIELDS.some((field) => !fields.has(field))) continue;

    const names = fields
      .get('dial')[0]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const defaults = fields.get('default');
    if (names.length !== defaults.length) {
      failures.push(
        `${label}: ${names.length} name${names.length === 1 ? '' : 's'} but ${defaults.length} \`default:\` field${defaults.length === 1 ? '' : 's'}.`,
      );
      continue;
    }

    names.forEach((name, index) => {
      if (!name.startsWith('--')) {
        /* The density dial is an attribute, so there is nothing to compare. */
        if (declarations.has(name)) {
          failures.push(
            `${name}: declared in :root but documented as an attribute.`,
          );
        }
        return;
      }
      claimed.add(name);
      if (!declarations.has(name)) {
        failures.push(`${name}: a dial block with no declaration in :root.`);
        return;
      }
      if (declarations.get(name) !== defaults[index]) {
        failures.push(
          `${name}: \`default: ${defaults[index]}\` but the file declares \`${declarations.get(name)}\`.`,
        );
      }
    });

    dials.push({
      names,
      defaults,
      changes: fields.get('changes')[0],
      values: fields.get('values')[0],
      reads: fields.get('reads')[0],
    });
  }

  for (const name of declarations.keys()) {
    if (!claimed.has(name)) {
      failures.push(`${name}: declared in :root with no dial block above it.`);
    }
  }

  return dials;
}

/* ----------------------------------------------------------------- rendering */

/** A bare `<tag>` outside a code span is JSX to MDX, so it has to be escaped. */
function mdxSafe(text) {
  return text
    .split(/(`+[^`]*`+)/)
    .map((chunk, index) => (index % 2 ? chunk : chunk.replace(/</g, '&lt;')))
    .join('');
}

function cell(text) {
  return mdxSafe(text).replace(/\|/g, '\\|');
}

function code(text) {
  return `\`${text}\``;
}

function table(dials) {
  /* A paired dial is two rows of code spans in one cell; the names and the
     values are their own vocabulary, so nothing in them needs escaping. */
  const rows = dials.map((dial) => {
    const names = dial.names.map((name) => code(name)).join('<br />');
    const defaults = dial.defaults.map((value) => code(value)).join('<br />');
    return `| ${names} | ${cell(dial.changes)} | ${cell(dial.values)} | ${defaults} | ${cell(dial.reads)} |`;
  });
  return [
    '| Dial | What it changes | Accepts | Default | Read by |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function render(dials) {
  return [
    '---',
    'title: Site theme',
    'description: The dials a HELIA site may set for itself, what each one moves, and what reads it.',
    '---',
    '',
    '{/* Generated by scripts/site-theme-doc.mjs. Edit site-theme.css, not this file. */}',
    '',
    "import SiteThemeExamples from '../../../components/SiteThemeExamples.astro';",
    '',
    'Flair lives in these dials and nowhere else. A site copies',
    '`@ambiqai/helia-ui/site-theme.css` to `src/styles/site-theme.css`, loads it',
    'from `customCss` immediately after the package sheets, and sets the values',
    'below; everything else it might want to look different about is a package',
    'change, not a site one. A site that needs a rule outside this contract opens',
    'a component request against',
    '[AmbiqAI/helia-ui](https://github.com/AmbiqAI/helia-ui/issues/new), so that',
    'every consumer gets the same answer rather than ten sites each solving it in',
    'their own stylesheet.',
    '',
    '## The dials',
    '',
    'Read out of `site-theme.css` itself: the declaration is the default and the',
    'comment above it is the description, so a dial that moves without this page',
    'moving fails `validate`.',
    '',
    table(dials),
    '',
    'Every default is the package default restated, so a copy with nothing changed',
    'renders exactly what the package renders, and a site owns its flair as a diff',
    'against one file.',
    '',
    '## Where a dial may be set',
    '',
    '`:root` is the ordinary answer, and a site that sets them there needs nothing',
    'else. A section that wants its own treatment sets them on a wrapper instead,',
    'and the wrapper has to carry `data-helia-theme`:',
    '',
    '```html',
    '<div data-helia-theme="warm" style="--helia-radius-scale: 1.6">',
    '  <!-- every surface under here is rounder -->',
    '</div>',
    '```',
    '',
    'The attribute is a hook, not a value: the package never reads what it is set',
    'to. `.helia-theme-scope` does the same job where the markup cannot take an',
    'attribute. Either one is needed because a dial is not a token but the input',
    'to several. CSS substitutes a custom property at the element that declares',
    'it, so `--helia-radius-md` composed once on `:root` is a finished length by',
    'the time it inherits, and a scale set further down the tree would move',
    'nothing. `semantic.css` repeats those compositions on the two hooks, which is',
    'what lets a dial mean the same thing wherever it is set. It does not repeat',
    'them on `*`: that would charge every element on every page for a feature most',
    'pages never use.',
    '',
    'Density is the exception and needs no hook. It is an attribute the package',
    'selects on rather than a value it substitutes, so it has always worked on any',
    'wrapper.',
    '',
    '## Two sites, one system',
    '',
    'The same three cards and the same section header, under the hub’s theme and',
    'under a warmer one. Nothing below is a component variant: the difference is',
    'the values in a `site-theme.css`, set here on a wrapper so both can sit on one',
    'page.',
    '',
    '<SiteThemeExamples />',
    '',
    'The second theme lives in this site as a scoped example rather than in the',
    'package. A second theme is a thing a site has. Each panel is a',
    '`site-theme.css` with its selector changed from `:root` to a class, which is',
    'the only edit between these and the file a site would ship, and each carries',
    '`data-helia-theme` so the compositions re-derive inside it.',
    '',
  ].join('\n');
}

/* --------------------------------------------------------------------- main */

const source = readFileSync(CONTRACT_PATH, 'utf8');
const dials = readDials(source);

if (dials.length === 0) failures.push('site-theme.css: no dial blocks.');

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} site theme contract problem${failures.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

const config = await prettier.resolveConfig(OUT_PATH);
const output = await prettier.format(render(dials), {
  ...config,
  filepath: OUT_PATH,
  parser: 'mdx',
});

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUT_PATH, 'utf8');
  } catch {
    current = '';
  }
  if (current !== output) {
    const scratch = join(
      mkdtempSync(join(tmpdir(), 'helia-site-theme-')),
      'site-theme.mdx',
    );
    writeFileSync(scratch, output);
    console.error(
      `${OUT_PATH} is out of date.\nGenerated form: ${scratch}\nRun: node scripts/site-theme-doc.mjs`,
    );
    process.exit(1);
  }
  console.log(`site-theme-doc: ${dials.length} dials, reference up to date.`);
} else {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, output);
  console.log(`site-theme-doc: ${dials.length} dials written to ${OUT_PATH}.`);
}
