#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Turns a Doxygen XML directory into a published C or C++ API reference: MDX
 * pages that compose the package's `Ref*` parts, the model as JSON, and the
 * text artifacts an agent reads instead of the pages.
 *
 *   doxygen Doxyfile            # GENERATE_XML = YES, XML_PROGRAMLISTING = NO
 *   helia-ui-doxyref --xml build/xml --out src/content/docs/reference/api \
 *                    --public public --base /helia-sdk/ \
 *                    --sidebar src/generated/api-sidebar.json
 *
 * Two steps, not one. `doxyref-extract.mjs` maps the XML onto the reference
 * model and is the only file here that knows C; `reference-render.mjs` turns a
 * model into pages and artifacts and is the same renderer the Python reference
 * goes through. The model is the source of truth and the pages are a view of
 * it, which is why the JSON is published rather than kept in a build directory.
 *
 * `--check` renders in memory and compares against what is on disk, which is
 * the CI gate against a reference that has drifted from the headers it
 * documents.
 *
 * No dependencies: this runs from a product repository's CI with nothing
 * installed but the package itself, and the XML reader is part of it.
 */

import { mkdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  DEFAULTS,
  DOXYGEN_VERSION,
  DoxyrefSchemaError,
  extractModel,
  readDoxygenXml,
} from './lib/doxyref-extract.mjs';
import {
  REFERENCE_MODEL_SCHEMA,
  RENDER_DEFAULTS,
  buildSidebar,
  renderReference,
} from './lib/reference-render.mjs';

/**
 * The record of what the last run wrote, so a run removes what it made and
 * nothing else. A directory with no manifest is treated as never generated,
 * which is what lets an existing tree be adopted without deleting a thing.
 */
const MANIFEST = '.doxyref-manifest.json';
const MANIFEST_VERSION = 1;

const ALL_DEFAULTS = { ...DEFAULTS, ...RENDER_DEFAULTS };

const USAGE = `helia-ui-doxyref --xml <dir> --out <dir> --base <site base path>

  --xml <dir>           Doxygen XML output directory (doxygen ${DOXYGEN_VERSION})
  --out <dir>           directory to write <module path>/index.mdx into
  --public <dir>        directory to write the JSON and text artifacts into (default public)
  --base <path>         site base path, for cross-reference URLs (default /)
  --site <origin>       origin for the absolute URLs in llms.txt
  --name <library>      the library the reference documents (default PROJECT_NAME)
  --language <c|cpp>    override the language read from the dump
  --sidebar <file>      write a Starlight sidebar fragment as JSON
  --source-root <dir>   strip this prefix from source paths in the model
  --source-url <tmpl>   link template for source, with {path} and {line}
  --commit <sha>        commit of the documented source, recorded in the model
  --check               compare against what is on disk and exit 1 on drift
  --quiet               suppress the per-warning report

Rendering options, shared with helia-ui-pyref:

  --show-root-heading           default ${ALL_DEFAULTS.showRootHeading}
  --heading-level <n>           default ${ALL_DEFAULTS.headingLevel}
  --no-separate-signature       default separate_signature ${ALL_DEFAULTS.separateSignature}
  --no-show-signature           default show_signature ${ALL_DEFAULTS.showSignature}
  --route-prefix <path>         default ${ALL_DEFAULTS.routePrefix}
`;

const { values } = parseArgs({
  options: {
    xml: { type: 'string' },
    out: { type: 'string' },
    public: { type: 'string' },
    base: { type: 'string' },
    site: { type: 'string' },
    name: { type: 'string' },
    language: { type: 'string' },
    sidebar: { type: 'string' },
    'source-root': { type: 'string' },
    'source-url': { type: 'string' },
    commit: { type: 'string' },
    check: { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
    'show-root-heading': { type: 'boolean' },
    'heading-level': { type: 'string' },
    'no-separate-signature': { type: 'boolean' },
    'no-show-signature': { type: 'boolean' },
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
if (!values.xml || !values.out)
  die(`--xml and --out are required.\n\n${USAGE}`);

const headingLevel = Number(
  values['heading-level'] ?? RENDER_DEFAULTS.headingLevel,
);
if (!Number.isInteger(headingLevel) || headingLevel < 1 || headingLevel > 4) {
  die('--heading-level must be an integer between 1 and 4.');
}
if (values.language && !['c', 'cpp'].includes(values.language)) {
  die('--language must be "c" or "cpp".');
}

const extractOptions = {
  language: values.language ?? DEFAULTS.language,
  name: values.name ?? DEFAULTS.name,
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

const xmlDir = resolve(values.xml);
let dump;
try {
  dump = await readDoxygenXml(xmlDir);
} catch (error) {
  if (error instanceof DoxyrefSchemaError) die(error.message);
  throw error;
}

const { model, warnings: extractWarnings } = extractModel(
  dump,
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
    console.error(`${show(outDir)} has drifted from ${show(xmlDir)}:\n`);
    for (const line of drift.slice(0, 50)) console.error(`  ${line}`);
    if (drift.length > 50) console.error(`  ... and ${drift.length - 50} more`);
    console.error('\nRe-run helia-ui-doxyref without --check and commit.');
    process.exit(1);
  }
  console.log(
    `doxyref: ${pages.length} pages and ${artifacts.length} artifacts up to date.`,
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
    `doxyref: ${pages.length} pages written to ${show(outDir)}, ${artifacts.length} artifacts to ${show(publicDir)}.`,
  );
}

if (warnings.length > 0) {
  const shown = values.quiet ? [] : warnings;
  for (const warning of shown) console.warn(`doxyref warning: ${warning}`);
  console.warn(`doxyref: ${warnings.length} warnings.`);
}
