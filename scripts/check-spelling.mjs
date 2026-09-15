// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Prose is American English, in content, in comments and in the strings the
 * generators write.
 *
 *   npm run check:spelling          report the British forms
 *   npm run check:spelling -- --fix rewrite them
 *
 * The scan covers the file types a reader's words end up in. JSON and YAML are
 * left out on purpose: `!cancelled()` is a GitHub Actions function and a
 * dependency's name is its own.
 *
 * A British form that has to stay -- an upstream file name, a third-party
 * title, an identifier another file reads -- takes `spelling: allow` in a
 * comment on the same line.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

import { IGNORED_DIRS, ROOT, pkg } from './lib/scope.mjs';

const EXTENSIONS = ['.astro', '.css', '.md', '.mdx', '.mjs', '.ts', '.tsx'];

/** British form to American form. Matching is case-insensitive. */
const AMERICAN = {
  amongst: 'among',
  analyse: 'analyze',
  analysed: 'analyzed',
  analyser: 'analyzer',
  analysers: 'analyzers',
  analysing: 'analyzing',
  artefact: 'artifact',
  artefacts: 'artifacts',
  behaviour: 'behavior',
  behavioural: 'behavioral',
  behaviours: 'behaviors',
  cancelled: 'canceled',
  cancelling: 'canceling',
  catalogue: 'catalog',
  catalogued: 'cataloged',
  catalogues: 'catalogs',
  centre: 'center',
  centred: 'centered',
  centres: 'centers',
  centring: 'centering',
  colour: 'color',
  coloured: 'colored',
  colourful: 'colorful',
  colouring: 'coloring',
  colours: 'colors',
  customisation: 'customization',
  customise: 'customize',
  customised: 'customized',
  customises: 'customizes',
  customising: 'customizing',
  defence: 'defense',
  defences: 'defenses',
  emphasise: 'emphasize',
  emphasised: 'emphasized',
  emphasises: 'emphasizes',
  emphasising: 'emphasizing',
  enrol: 'enroll',
  enrolment: 'enrollment',
  enrols: 'enrolls',
  favour: 'favor',
  favoured: 'favored',
  favourite: 'favorite',
  favourites: 'favorites',
  favours: 'favors',
  fulfil: 'fulfill',
  fulfilment: 'fulfillment',
  fulfils: 'fulfills',
  grey: 'gray',
  greys: 'grays',
  greyscale: 'grayscale',
  honour: 'honor',
  honoured: 'honored',
  honours: 'honors',
  humour: 'humor',
  initialisation: 'initialization',
  initialise: 'initialize',
  initialised: 'initialized',
  initialiser: 'initializer',
  initialisers: 'initializers',
  initialises: 'initializes',
  initialising: 'initializing',
  judgement: 'judgment',
  judgements: 'judgments',
  kerb: 'curb',
  labelled: 'labeled',
  labelling: 'labeling',
  licence: 'license',
  licences: 'licenses',
  maximise: 'maximize',
  maximised: 'maximized',
  maximises: 'maximizes',
  maximising: 'maximizing',
  minimise: 'minimize',
  minimised: 'minimized',
  minimises: 'minimizes',
  minimising: 'minimizing',
  modelled: 'modeled',
  modelling: 'modeling',
  neighbour: 'neighbor',
  neighbours: 'neighbors',
  normalisation: 'normalization',
  normalise: 'normalize',
  normalised: 'normalized',
  normaliser: 'normalizer',
  normalisers: 'normalizers',
  normalises: 'normalizes',
  normalising: 'normalizing',
  optimisation: 'optimization',
  optimisations: 'optimizations',
  optimise: 'optimize',
  optimised: 'optimized',
  optimiser: 'optimizer',
  optimisers: 'optimizers',
  optimises: 'optimizes',
  optimising: 'optimizing',
  organisation: 'organization',
  organisations: 'organizations',
  organise: 'organize',
  organised: 'organized',
  organiser: 'organizer',
  organisers: 'organizers',
  organises: 'organizes',
  organising: 'organizing',
  practise: 'practice',
  practised: 'practiced',
  practises: 'practices',
  practising: 'practicing',
  programme: 'program',
  programmes: 'programs',
  prioritise: 'prioritize',
  prioritised: 'prioritized',
  prioritises: 'prioritizes',
  prioritising: 'prioritizing',
  recognise: 'recognize',
  recognised: 'recognized',
  recognises: 'recognizes',
  recognising: 'recognizing',
  recolour: 'recolor',
  recoloured: 'recolored',
  recolouring: 'recoloring',
  recolours: 'recolors',
  rumour: 'rumor',
  rumours: 'rumors',
  serialisation: 'serialization',
  serialise: 'serialize',
  serialised: 'serialized',
  serialiser: 'serializer',
  serialisers: 'serializers',
  serialises: 'serializes',
  serialising: 'serializing',
  specialise: 'specialize',
  specialised: 'specialized',
  specialises: 'specializes',
  specialising: 'specializing',
  standardise: 'standardize',
  standardised: 'standardized',
  summarise: 'summarize',
  summarised: 'summarized',
  summarises: 'summarizes',
  summarising: 'summarizing',
  synchronise: 'synchronize',
  synchronised: 'synchronized',
  synchronises: 'synchronizes',
  synchronising: 'synchronizing',
  tokenisation: 'tokenization',
  tokenise: 'tokenize',
  tokenised: 'tokenized',
  tokeniser: 'tokenizer',
  tokenisers: 'tokenizers',
  tokenises: 'tokenizes',
  tokenising: 'tokenizing',
  towards: 'toward',
  travelled: 'traveled',
  travelling: 'traveling',
  tyre: 'tire',
  tyres: 'tires',
  utilise: 'utilize',
  utilised: 'utilized',
  vigour: 'vigor',
  visualisation: 'visualization',
  visualisations: 'visualizations',
  visualise: 'visualize',
  visualised: 'visualized',
  visualiser: 'visualizer',
  visualisers: 'visualizers',
  visualises: 'visualizes',
  visualising: 'visualizing',
  whilst: 'while',
};

/**
 * Longest first, so `colours` is one match rather than `colour` and a stray
 * `s` that the word boundary would then reject.
 */
const PATTERN = new RegExp(
  `\\b(${Object.keys(AMERICAN)
    .sort((a, b) => b.length - a.length)
    .join('|')})\\b`,
  'gi',
);

/**
 * Spans that carry a name rather than prose: an SPDX expression, an upstream
 * file name, a dependency. The word inside one of these is not ours to spell.
 */
const NAMES = [
  /SPDX-License-Identifier:.*/g,
  /@img\/colour\b/g,
  /\bLICENCE(?:\.\w+)?\b/g,
  /\bMIT Expat Licence\b/g,
];

const ESCAPE = 'spelling: allow';

/**
 * Generated from upstream package metadata and quoting upstream terms
 * verbatim, so its spellings are the dependencies' own.
 */
const GENERATED = ['THIRD-PARTY-NOTICES.md', pkg('THIRD-PARTY-NOTICES.md')];

/**
 * The running handoff is swept by whoever owns it.
 * TODO(AmbiqAI/helia-ui#37): drop this once that work lands.
 */
const PENDING = ['docs/handoff.md'];

/** This file is the word list, so every British form in it is deliberate. */
const SELF = pkg('scripts/check-spelling.mjs');

const SKIPPED = new Set([SELF, ...GENERATED, ...PENDING]);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) yield* walk(full);
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      yield relative(ROOT, full);
    }
  }
}

/** Character offsets covered by a name, so a match inside one is left alone. */
function nameSpans(line) {
  const spans = [];
  for (const pattern of NAMES) {
    pattern.lastIndex = 0;
    for (const match of line.matchAll(pattern)) {
      spans.push([match.index, match.index + match[0].length]);
    }
  }
  return spans;
}

/** The American form wearing the British form's capitals. */
function inCase(word) {
  const american = AMERICAN[word.toLowerCase()];
  if (word === word.toUpperCase()) return american.toUpperCase();
  if (word[0] === word[0].toUpperCase()) {
    return american[0].toUpperCase() + american.slice(1);
  }
  return american;
}

const fix = process.argv.includes('--fix');
const files = [];
for await (const rel of walk(ROOT)) {
  if (!SKIPPED.has(rel)) files.push(rel);
}
files.sort();

const failures = [];

for (const rel of files) {
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
  let touched = false;
  lines.forEach((line, index) => {
    if (line.includes(ESCAPE)) return;
    const spans = nameSpans(line);
    const keep = (start, end) =>
      spans.some(([from, to]) => start >= from && end <= to);
    if (fix) {
      const rewritten = line.replace(PATTERN, (word, _group, offset) =>
        keep(offset, offset + word.length) ? word : inCase(word),
      );
      if (rewritten !== line) {
        lines[index] = rewritten;
        touched = true;
      }
      return;
    }
    for (const match of line.matchAll(PATTERN)) {
      const start = match.index;
      if (keep(start, start + match[0].length)) continue;
      failures.push(`${rel}:${index + 1} ${match[0]} -> ${inCase(match[0])}`);
    }
  });
  if (touched) writeFileSync(join(ROOT, rel), lines.join('\n'));
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} British spelling${failures.length === 1 ? '' : 's'}. ` +
      `Use the American form, or mark the line \`${ESCAPE}\` when the word is a name.`,
  );
  process.exit(1);
}

console.log(
  fix
    ? `check:spelling: American forms written across ${files.length} files`
    : `check:spelling: ${files.length} files, American English throughout.`,
);
