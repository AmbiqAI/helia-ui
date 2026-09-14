#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Turns a griffe JSON dump into Starlight Markdown, so a product site that
 * publishes a Python API reference keeps it without MkDocs and mkdocstrings.
 *
 *   griffe dump helia_aot --docstyle google -f > griffe.json
 *   helia-ui-pyref --input griffe.json --out src/content/docs/reference/api \
 *                  --base /helia-aot/ --sidebar src/generated/api-sidebar.json
 *
 * Developed against griffe 1.7.3. The dump is not a versioned format, so the
 * reader pins the shape it understands and refuses anything else rather than
 * emitting plausible-looking pages from a tree it misread.
 *
 * `--check` regenerates into a temporary directory and diffs, which is the CI
 * gate against a reference that has drifted from the source it documents.
 *
 * No dependencies: this runs from a product repository's CI with nothing
 * installed but the package itself.
 */

import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  DEFAULTS,
  GRIFFE_VERSION,
  PyrefSchemaError,
  buildSidebar,
  parseDump,
  renderAll,
} from './lib/pyref-render.mjs';

const USAGE = `helia-ui-pyref --input <griffe.json> --out <dir> --base <site base path>

  --input <file>        griffe dump JSON (griffe ${GRIFFE_VERSION})
  --out <dir>           directory to write <module path>/index.md into
  --base <path>         site base path, for cross-reference URLs (default /)
  --package <name>      which package in the dump to render
  --sidebar <file>      write a Starlight sidebar fragment as JSON
  --check               regenerate into a temp directory and exit 1 on drift
  --quiet               suppress the per-warning report

mkdocstrings options, defaulting to the HELIA product-site settings:

  --docstring-style <s>         default ${DEFAULTS.docstringStyle}
  --show-root-heading           default ${DEFAULTS.showRootHeading}
  --heading-level <n>           default ${DEFAULTS.headingLevel}
  --no-merge-init-into-class    default merge_init_into_class ${DEFAULTS.mergeInitIntoClass}
  --members-order <source|alphabetical>  default ${DEFAULTS.membersOrder}
  --filter <pattern>            repeatable; default ${DEFAULTS.filters.join(' ')}
  --no-separate-signature       default separate_signature ${DEFAULTS.separateSignature}
  --no-show-signature           default show_signature ${DEFAULTS.showSignature}
  --no-signature-annotations    default show_signature_annotations ${DEFAULTS.showSignatureAnnotations}
  --route-prefix <path>         default ${DEFAULTS.routePrefix}
`;

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    out: { type: 'string' },
    base: { type: 'string' },
    package: { type: 'string' },
    sidebar: { type: 'string' },
    check: { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
    'docstring-style': { type: 'string' },
    'show-root-heading': { type: 'boolean' },
    'heading-level': { type: 'string' },
    'no-merge-init-into-class': { type: 'boolean' },
    'members-order': { type: 'string' },
    filter: { type: 'string', multiple: true },
    'no-separate-signature': { type: 'boolean' },
    'no-show-signature': { type: 'boolean' },
    'no-signature-annotations': { type: 'boolean' },
    'route-prefix': { type: 'string' },
  },
  allowPositionals: false,
});

const die = (message) => {
  console.error(message);
  process.exit(1);
};

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!values.input || !values.out)
  die(`--input and --out are required.\n\n${USAGE}`);

/** A base path is always absolute and always ends in a slash. */
const normaliseBase = (base) => {
  if (!base || base === '/') return '/';
  const withLead = base.startsWith('/') ? base : `/${base}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
};

const headingLevel = Number(values['heading-level'] ?? DEFAULTS.headingLevel);
if (!Number.isInteger(headingLevel) || headingLevel < 1 || headingLevel > 4) {
  die('--heading-level must be an integer between 1 and 4.');
}
const membersOrder = values['members-order'] ?? DEFAULTS.membersOrder;
if (!['source', 'alphabetical'].includes(membersOrder)) {
  die('--members-order must be "source" or "alphabetical".');
}

const options = {
  docstringStyle: values['docstring-style'] ?? DEFAULTS.docstringStyle,
  showRootHeading: values['show-root-heading'] ?? DEFAULTS.showRootHeading,
  headingLevel,
  mergeInitIntoClass: !values['no-merge-init-into-class'],
  membersOrder,
  filters: values.filter ?? DEFAULTS.filters,
  separateSignature: !values['no-separate-signature'],
  showSignature: !values['no-show-signature'],
  showSignatureAnnotations: !values['no-signature-annotations'],
  routePrefix: (values['route-prefix'] ?? DEFAULTS.routePrefix).replace(
    /^\/|\/$/g,
    '',
  ),
  base: normaliseBase(values.base),
};

if (options.docstringStyle !== 'google') {
  die(
    `--docstring-style ${options.docstringStyle} is not supported: the dump is already parsed, so re-dump with "griffe dump <package> --docstyle ${options.docstringStyle} -f" and the sections will follow.`,
  );
}

const inputPath = resolve(values.input);
let dump;
try {
  dump = JSON.parse(await readFile(inputPath, 'utf8'));
} catch (error) {
  die(`Could not read ${inputPath} as JSON: ${error.message}`);
}

let root;
try {
  ({ root } = parseDump(dump, values.package));
} catch (error) {
  if (error instanceof PyrefSchemaError) die(error.message);
  throw error;
}

const { pages, warnings } = renderAll(root, options);

/** Write the pages under `dir`, replacing whatever was there. */
async function emit(dir) {
  await rm(dir, { recursive: true, force: true });
  for (const page of pages) {
    const target = join(dir, page.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, page.markdown, 'utf8');
  }
}

async function walk(dir, prefix = '') {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const [key, value] of await walk(join(dir, entry.name), rel))
        out.set(key, value);
    } else {
      out.set(rel, await readFile(join(dir, entry.name), 'utf8'));
    }
  }
  return out;
}

const outDir = resolve(values.out);
const sidebar = buildSidebar(root, options);

/* A path outside the working directory reads better absolute than as a stack
 * of `..` segments, and CI logs are the main reader here. */
const show = (path) => {
  const rel = relative(process.cwd(), path);
  return rel.startsWith('..') ? path : rel;
};

if (values.check) {
  const temp = await mkdtemp(join(tmpdir(), 'helia-ui-pyref-'));
  try {
    await emit(temp);
    const [fresh, current] = [await walk(temp), await walk(outDir)];
    const drift = [];
    for (const [path, markdown] of fresh) {
      if (!current.has(path)) drift.push(`missing:  ${path}`);
      else if (current.get(path) !== markdown) drift.push(`stale:    ${path}`);
    }
    for (const path of current.keys()) {
      if (!fresh.has(path)) drift.push(`orphaned: ${path}`);
    }
    if (drift.length > 0) {
      console.error(`${show(outDir)} has drifted from ${show(inputPath)}:\n`);
      for (const line of drift.slice(0, 50)) console.error(`  ${line}`);
      if (drift.length > 50)
        console.error(`  ... and ${drift.length - 50} more`);
      console.error('\nRe-run helia-ui-pyref without --check and commit.');
      process.exit(1);
    }
    console.log(`pyref: ${pages.length} pages up to date.`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
} else {
  await emit(outDir);
  if (values.sidebar) {
    const target = resolve(values.sidebar);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(sidebar, null, 2)}\n`, 'utf8');
  }
  console.log(`pyref: ${pages.length} pages written to ${show(outDir)}.`);
}

if (warnings.length > 0) {
  const shown = values.quiet ? [] : warnings;
  for (const warning of shown) console.warn(`pyref warning: ${warning}`);
  console.warn(`pyref: ${warnings.length} warnings.`);
}
