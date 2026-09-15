#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Turns a griffe JSON dump into a published Python API reference: MDX pages
 * that compose the package's `Ref*` parts, the model as JSON, and the text
 * artifacts an agent reads instead of the pages.
 *
 *   griffe dump helia_aot --docstyle google -f > griffe.json
 *   helia-ui-pyref --input griffe.json --out src/content/docs/reference/api \
 *                  --public public --base /helia-aot/ \
 *                  --sidebar src/generated/api-sidebar.json
 *
 * Two steps, not one. `pyref-extract.mjs` maps the dump onto the reference
 * model and is the only file here that knows Python; `reference-render.mjs`
 * turns a model into pages and artifacts and would do the same for a C or
 * TypeScript extractor. The model is the source of truth and the pages are a
 * view of it, which is why the JSON is published rather than kept in a build
 * directory.
 *
 * Developed against griffe 1.7.3. The dump is not a versioned format, so the
 * reader pins the shape it understands and refuses anything else rather than
 * emitting plausible-looking pages from a tree it misread.
 *
 * `--check` renders in memory and compares against what is on disk, which is
 * the CI gate against a reference that has drifted from the source it
 * documents.
 *
 * No dependencies: this runs from a product repository's CI with nothing
 * installed but the package itself.
 */

import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  DEFAULTS,
  GRIFFE_VERSION,
  PyrefSchemaError,
  extractModel,
  parseDump,
} from './lib/pyref-extract.mjs';
import {
  REFERENCE_MODEL_SCHEMA,
  RENDER_DEFAULTS,
  buildSidebar,
  renderReference,
} from './lib/reference-render.mjs';

/**
 * The record of what the last run wrote.
 *
 * `--out` used to be emptied before every run, which quietly deleted anything
 * a repository kept in the same directory -- a hand-written index page, a
 * partial in `_`. The manifest means a run removes what it made and nothing
 * else. A directory with no manifest is treated as never generated, so the
 * first run after this change adopts it without deleting a thing.
 */
const MANIFEST = '.pyref-manifest.json';
const MANIFEST_VERSION = 1;

const ALL_DEFAULTS = { ...DEFAULTS, ...RENDER_DEFAULTS };

const USAGE = `helia-ui-pyref --input <griffe.json> --out <dir> --base <site base path>

  --input <file>        griffe dump JSON (griffe ${GRIFFE_VERSION})
  --out <dir>           directory to write <module path>/index.mdx into
  --public <dir>        directory to write the JSON and text artifacts into (default public)
  --base <path>         site base path, for cross-reference URLs (default /)
  --site <origin>       origin for the absolute URLs in llms.txt
  --package <name>      which package in the dump to render
  --sidebar <file>      write a Starlight sidebar fragment as JSON
  --source-root <dir>   strip this prefix from source paths in the model
  --source-url <tmpl>   link template for source, with {path} and {line}
  --commit <sha>        commit of the documented source, recorded in the model
  --check               compare against what is on disk and exit 1 on drift
  --quiet               suppress the per-warning report

mkdocstrings options, defaulting to the HELIA product-site settings:

  --docstring-style <s>         default ${ALL_DEFAULTS.docstringStyle}
  --show-root-heading           default ${ALL_DEFAULTS.showRootHeading}
  --heading-level <n>           default ${ALL_DEFAULTS.headingLevel}
  --no-merge-init-into-class    default merge_init_into_class ${ALL_DEFAULTS.mergeInitIntoClass}
  --members-order <source|alphabetical>  default ${ALL_DEFAULTS.membersOrder}
  --filter <pattern>            repeatable; default ${ALL_DEFAULTS.filters.join(' ')}
  --no-separate-signature       default separate_signature ${ALL_DEFAULTS.separateSignature}
  --no-show-signature           default show_signature ${ALL_DEFAULTS.showSignature}
  --no-signature-annotations    default show_signature_annotations ${ALL_DEFAULTS.showSignatureAnnotations}
  --route-prefix <path>         default ${ALL_DEFAULTS.routePrefix}
`;

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    out: { type: 'string' },
    public: { type: 'string' },
    base: { type: 'string' },
    site: { type: 'string' },
    package: { type: 'string' },
    sidebar: { type: 'string' },
    'source-root': { type: 'string' },
    'source-url': { type: 'string' },
    commit: { type: 'string' },
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

const headingLevel = Number(
  values['heading-level'] ?? RENDER_DEFAULTS.headingLevel,
);
if (!Number.isInteger(headingLevel) || headingLevel < 1 || headingLevel > 4) {
  die('--heading-level must be an integer between 1 and 4.');
}
const membersOrder = values['members-order'] ?? DEFAULTS.membersOrder;
if (!['source', 'alphabetical'].includes(membersOrder)) {
  die('--members-order must be "source" or "alphabetical".');
}

const extractOptions = {
  docstringStyle: values['docstring-style'] ?? DEFAULTS.docstringStyle,
  mergeInitIntoClass: !values['no-merge-init-into-class'],
  membersOrder,
  filters: values.filter ?? DEFAULTS.filters,
  showSignatureAnnotations: !values['no-signature-annotations'],
  sourceRoot: values['source-root'] ? resolve(values['source-root']) : '',
  sourceUrl: values['source-url'] ?? '',
};

const renderOptions = {
  base: values.base ?? RENDER_DEFAULTS.base,
  site: values.site ?? RENDER_DEFAULTS.site,
  routePrefix: values['route-prefix'] ?? RENDER_DEFAULTS.routePrefix,
  headingLevel,
  showRootHeading:
    values['show-root-heading'] ?? RENDER_DEFAULTS.showRootHeading,
  separateSignature: !values['no-separate-signature'],
  showSignature: !values['no-show-signature'],
};

if (extractOptions.docstringStyle !== 'google') {
  die(
    `--docstring-style ${extractOptions.docstringStyle} is not supported: the dump is already parsed, so re-dump with "griffe dump <package> --docstyle ${extractOptions.docstringStyle} -f" and the sections will follow.`,
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

const { model, warnings: extractWarnings } = extractModel(
  root,
  extractOptions,
  {
    schema: REFERENCE_MODEL_SCHEMA,
    sourceCommit: values.commit,
  },
);
const {
  pages,
  artifacts,
  options: resolvedOptions,
  warnings: renderWarnings,
} = renderReference(model, renderOptions);
const warnings = [...extractWarnings, ...renderWarnings];

const outDir = resolve(values.out);
const publicDir = resolve(values.public ?? 'public');

/** The files a run produces, keyed by the root they are written under. */
const generated = {
  out: new Map(pages.map((page) => [page.path, page.mdx])),
  public: new Map(
    artifacts.map((artifact) => [artifact.path, artifact.contents]),
  ),
};

async function readManifest(dir) {
  try {
    const raw = JSON.parse(await readFile(join(dir, MANIFEST), 'utf8'));
    if (raw?.version !== MANIFEST_VERSION) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Remove a file the last run wrote, then any directories it emptied. */
async function removeGenerated(root_, relPath) {
  const target = join(root_, relPath);
  await rm(target, { force: true });
  let dir = dirname(target);
  while (dir.startsWith(root_) && dir !== root_) {
    try {
      await rmdir(dir);
    } catch {
      return;
    }
    dir = dirname(dir);
  }
}

async function emit(outRoot, publicRoot) {
  const previous = await readManifest(outRoot);
  if (previous) {
    for (const relPath of previous.out ?? []) {
      if (!generated.out.has(relPath)) await removeGenerated(outRoot, relPath);
    }
    for (const relPath of previous.public ?? []) {
      if (!generated.public.has(relPath))
        await removeGenerated(publicRoot, relPath);
    }
  }

  for (const [root_, files] of [
    [outRoot, generated.out],
    [publicRoot, generated.public],
  ]) {
    for (const [relPath, contents] of files) {
      const target = join(root_, relPath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents, 'utf8');
    }
  }

  await mkdir(outRoot, { recursive: true });
  await writeFile(
    join(outRoot, MANIFEST),
    `${JSON.stringify(
      {
        version: MANIFEST_VERSION,
        out: [...generated.out.keys()].sort(),
        public: [...generated.public.keys()].sort(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

/* A path outside the working directory reads better absolute than as a stack
 * of `..` segments, and CI logs are the main reader here. */
const show = (path) => {
  const rel = relative(process.cwd(), path);
  return rel.startsWith('..') ? path : rel;
};

async function drifted(root_, files) {
  const out = [];
  for (const [relPath, contents] of files) {
    const target = join(root_, relPath);
    if (!existsSync(target)) out.push(`missing:  ${relPath}`);
    else if ((await readFile(target, 'utf8')) !== contents)
      out.push(`stale:    ${relPath}`);
  }
  return out;
}

if (values.check) {
  const previous = await readManifest(outDir);
  const drift = [
    ...(await drifted(outDir, generated.out)),
    ...(await drifted(publicDir, generated.public)),
  ];
  for (const relPath of previous?.out ?? []) {
    if (!generated.out.has(relPath)) drift.push(`orphaned: ${relPath}`);
  }
  for (const relPath of previous?.public ?? []) {
    if (!generated.public.has(relPath)) drift.push(`orphaned: ${relPath}`);
  }
  if (previous === null) drift.push(`missing:  ${MANIFEST}`);

  if (drift.length > 0) {
    console.error(`${show(outDir)} has drifted from ${show(inputPath)}:\n`);
    for (const line of drift.slice(0, 50)) console.error(`  ${line}`);
    if (drift.length > 50) console.error(`  ... and ${drift.length - 50} more`);
    console.error('\nRe-run helia-ui-pyref without --check and commit.');
    process.exit(1);
  }
  console.log(
    `pyref: ${pages.length} pages and ${artifacts.length} artifacts up to date.`,
  );
} else {
  await emit(outDir, publicDir);
  if (values.sidebar) {
    const target = resolve(values.sidebar);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(
      target,
      `${JSON.stringify(buildSidebar(model, resolvedOptions), null, 2)}\n`,
      'utf8',
    );
  }
  console.log(
    `pyref: ${pages.length} pages written to ${show(outDir)}, ${artifacts.length} artifacts to ${show(publicDir)}.`,
  );
}

if (warnings.length > 0) {
  const shown = values.quiet ? [] : warnings;
  for (const warning of shown) console.warn(`pyref warning: ${warning}`);
  console.warn(`pyref: ${warnings.length} warnings.`);
}
