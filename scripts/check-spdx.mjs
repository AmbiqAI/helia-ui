#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Enforces the ADR-0005 Tier 1 SPDX headers on Ambiq-authored source.
 *
 *   npm run check:spdx          report files missing the header
 *   npm run check:spdx -- --fix insert the header where it is missing
 *
 * The roots follow the scan scope: the package alone, or the package plus the
 * workspace around it when the caller passes `--root`.
 *
 * The header goes inside Astro frontmatter, never in template markup: a
 * comment in the template is emitted into the rendered HTML, which would put
 * the notice in front of every visitor on every page.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

import {
  IGNORED_DIRS,
  ROOT as repoRoot,
  WORKSPACE,
  pkg,
} from './lib/scope.mjs';
import { INSTALLED, SITE } from './lib/site-config.mjs';

/*
 * Tier 1 is first-party source, so the scan roots are whatever holds it. A
 * site that keeps its source somewhere other than the whole tree says so under
 * `spdx.roots`; a package vendored inside a workspace scans that workspace's
 * source and itself, and anything else scans everything the walk does not
 * ignore. A declared root that does not exist is skipped, because a site
 * shares one config across checks that do not all want the same directories.
 */
const ROOTS =
  SITE.spdx.roots.length > 0
    ? SITE.spdx.roots
    : WORKSPACE && !INSTALLED
      ? ['src', 'scripts', pkg('')]
      : ['.'];
const EXTENSIONS = ['.astro', '.css', '.mjs', '.ts', '.tsx'];

/**
 * Vendored files reproduced from upstream without Ambiq authorship. Their
 * upstream headers stay untouched and their terms are recorded in
 * THIRD-PARTY-NOTICES.md instead. Paths are relative to the scan root.
 */
const VENDORED = [];

const LICENSE_ID = 'BSD-3-Clause';
const SPDX_LINE = `SPDX-License-Identifier: ${LICENSE_ID}`;
const COPYRIGHT_LINE = `Copyright (c) ${new Date().getUTCFullYear()}, Ambiq`;
const SPDX_PATTERN = new RegExp(`SPDX-License-Identifier:\\s*${LICENSE_ID}\\b`);
const COPYRIGHT_PATTERN = /Copyright \(c\) \d{4}, Ambiq\b/;

/** A directive prologue has to keep its place, so the header goes below it. */
const DIRECTIVE_PATTERN = /^\s*(['"])use [a-z]+\1;?\s*$/;

async function* walk(dir) {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

async function collect() {
  const files = [];
  const vendored = new Set(VENDORED);
  for (const root of ROOTS) {
    for await (const file of walk(join(repoRoot, root))) {
      const rel = relative(repoRoot, file);
      if (!vendored.has(rel)) files.push(rel);
    }
  }
  return files.sort();
}

/**
 * Frontmatter is the only part of an Astro file that is not template output,
 * so a header outside it is a defect even when the strings are present.
 */
function astroHeaderRegion(source) {
  if (!source.startsWith('---\n')) return null;
  const end = source.indexOf('\n---', 3);
  return end === -1 ? null : source.slice(0, end);
}

function hasHeader(rel, source) {
  const region = rel.endsWith('.astro')
    ? astroHeaderRegion(source)
    : source.slice(0, 1024);
  if (region === null) return false;
  return SPDX_PATTERN.test(region) && COPYRIGHT_PATTERN.test(region);
}

function withHeader(rel, source) {
  const slash = `// ${SPDX_LINE}\n// ${COPYRIGHT_LINE}\n`;
  if (rel.endsWith('.css')) {
    return `/* ${SPDX_LINE} */\n/* ${COPYRIGHT_LINE} */\n${source}`;
  }
  if (rel.endsWith('.astro')) {
    if (!source.startsWith('---\n')) return `---\n${slash}---\n\n${source}`;
    return `---\n${slash}${source.slice(4)}`;
  }
  const lines = source.split('\n');
  let insertAt = 0;
  if (lines[0]?.startsWith('#!')) insertAt = 1;
  while (DIRECTIVE_PATTERN.test(lines[insertAt] ?? '')) insertAt += 1;
  lines.splice(insertAt, 0, `// ${SPDX_LINE}`, `// ${COPYRIGHT_LINE}`);
  return lines.join('\n');
}

const fix = process.argv.includes('--fix');
const files = await collect();
const missing = [];

for (const rel of files) {
  const source = readFileSync(join(repoRoot, rel), 'utf8');
  if (hasHeader(rel, source)) continue;
  if (fix) {
    writeFileSync(join(repoRoot, rel), withHeader(rel, source));
    continue;
  }
  missing.push(rel);
}

if (missing.length > 0) {
  console.error(`SPDX header missing from ${missing.length} file(s):`);
  for (const rel of missing) console.error(`  ${rel}`);
  console.error('\nRun `npm run check:spdx -- --fix` to insert it.');
  process.exit(1);
}

console.log(
  fix
    ? `check:spdx: header applied where missing across ${files.length} files`
    : `check:spdx: ${files.length} files carry the ${LICENSE_ID} header`,
);
