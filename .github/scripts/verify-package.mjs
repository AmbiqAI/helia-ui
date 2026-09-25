#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Checks a consumer's installed copy of this package rather than the
 * repository, because the two differ: `files` decides what leaves the tree,
 * and a helper left out of it is present in git, present on every developer's
 * machine, and missing only for the consumer. That has broken a site before.
 *
 * Run against a scratch project outside the repository that has already
 * installed the packed tarball:
 *
 *   node .github/scripts/verify-package.mjs --consumer /tmp/consumer
 *
 * Three questions, all asked of the installed tree alone:
 *   - does every `exports` target resolve to a file that shipped;
 *   - does every `bin` entry start under node without a resolution error,
 *     whatever it then makes of its arguments;
 *   - does every relative import in every shipped source file land on a file
 *     that also shipped.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { consumer: { type: 'string' } },
});

if (!values.consumer) {
  console.error('verify-package: --consumer <dir> is required.');
  process.exit(2);
}

const PACKAGE_NAME = '@ambiqai/helia-ui';
const INSTALLED = resolve(values.consumer, 'node_modules', PACKAGE_NAME);

if (!existsSync(join(INSTALLED, 'package.json'))) {
  console.error(
    `verify-package: ${PACKAGE_NAME} is not installed under ${values.consumer}.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(join(INSTALLED, 'package.json'), 'utf8'),
);
const failures = [];
const fail = (message) => failures.push(message);

/* The installed tree, so that a wildcard export can be answered by what is
 * there rather than by what the repository would have offered. */
const SCANNED = new Set(['.astro', '.mjs', '.ts', '.tsx']);
const shipped = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else shipped.push(relative(INSTALLED, full).split('\\').join('/'));
  }
};

walk(INSTALLED);

/* `exports` targets. A wildcard is satisfied by one file that matches it,
 * which is the difference between a directory that shipped empty and one that
 * shipped. */
const exportTargets = (value, from) => {
  if (typeof value === 'string') return [[from, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      exportTargets(nested, `${from} (${key})`),
    );
  }
  return [];
};

for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
  for (const [label, target] of exportTargets(value, subpath)) {
    const clean = target.replace(/^\.\//, '');
    if (clean.includes('*')) {
      const [prefix, suffix] = clean.split('*');
      const matched = shipped.some(
        (file) => file.startsWith(prefix) && file.endsWith(suffix),
      );
      if (!matched) {
        fail(`exports "${label}" matches nothing in the installed tree.`);
      }
    } else if (!existsSync(join(INSTALLED, clean))) {
      fail(`exports "${label}" points at ${clean}, which did not ship.`);
    }
  }
}

/* Wildcards alone cannot prove that a consumer's named entry point shipped. */
const consumerRequire = createRequire(
  join(resolve(values.consumer), 'package.json'),
);
for (const subpath of [
  'astro/ReferenceBrowser',
  'react/reference-browser',
  'astro/Landing',
]) {
  try {
    consumerRequire.resolve(`${PACKAGE_NAME}/${subpath}`);
  } catch {
    fail(`Required consumer entry point "${subpath}" did not ship.`);
  }
}

/* `bin` entries. The exit status is not the assertion: several of these refuse
 * their arguments by design. A module the tarball omitted is the assertion. */
const RESOLUTION_ERROR =
  /ERR_MODULE_NOT_FOUND|ERR_UNSUPPORTED_DIR_IMPORT|Cannot find module|Cannot find package/;

for (const [name, target] of Object.entries(manifest.bin ?? {})) {
  const clean = target.replace(/^\.\//, '');
  const full = join(INSTALLED, clean);

  if (!existsSync(full)) {
    fail(`bin "${name}" points at ${clean}, which did not ship.`);
    continue;
  }

  const run = spawnSync(process.execPath, [full, '--help'], {
    cwd: values.consumer,
    encoding: 'utf8',
    timeout: 60_000,
  });

  if (run.error) {
    fail(`bin "${name}" could not be started: ${run.error.message}`);
  } else if (RESOLUTION_ERROR.test(`${run.stdout}${run.stderr}`)) {
    fail(
      `bin "${name}" failed to resolve a module from the installed tree:\n${run.stderr.trim()}`,
    );
  }
}

/* Relative imports across every shipped source file. This is the check that
 * catches the omitted helper: the import is valid in the repository and
 * unresolvable here. */
const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*['"](\.[^'"]*)['"]/g;
const SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.astro',
  '/index.ts',
  '/index.tsx',
  '/index.mjs',
];

const resolves = (from, specifier) => {
  const base = resolve(dirname(from), specifier.split('?')[0]);
  return SUFFIXES.some((suffix) => {
    const candidate = `${base}${suffix}`;
    return existsSync(candidate) && statSync(candidate).isFile();
  });
};

for (const file of shipped) {
  if (![...SCANNED].some((ext) => file.endsWith(ext))) continue;
  const full = join(INSTALLED, file);
  const source = readFileSync(full, 'utf8');
  for (const [, specifier] of source.matchAll(SPECIFIER)) {
    if (!resolves(full, specifier)) {
      fail(`${file} imports "${specifier}", which did not ship.`);
    }
  }
}

const fixture = mkdtempSync(join(resolve(values.consumer), 'discoverability-'));
try {
  const dist = join(fixture, 'dist');
  mkdirSync(dist);
  writeFileSync(
    join(dist, 'content-index.json'),
    JSON.stringify({
      base: '/',
      routes: [{ route: '/', markdown: '/index.md' }],
    }),
  );
  writeFileSync(
    join(dist, 'index.html'),
    '<title>Fixture</title><link rel="canonical" href="https://example.com/"><meta name="description" content="Fixture"><meta property="og:title" content="Fixture"><meta property="og:description" content="Fixture"><meta property="og:image" content="https://example.com/image.svg">',
  );
  writeFileSync(join(dist, 'index.md'), '# Fixture');
  for (const name of [
    'llms.txt',
    'llms-full.txt',
    'sitemap-index.xml',
    'robots.txt',
  ]) {
    writeFileSync(join(dist, name), '/index.md');
  }
  const command = join(
    resolve(values.consumer),
    'node_modules/.bin/helia-ui-check-discoverability',
  );
  const run = () =>
    spawnSync(process.execPath, [command, '--root', fixture], {
      cwd: values.consumer,
      encoding: 'utf8',
      timeout: 60000,
    });
  const valid = run();
  if (valid.status !== 0)
    fail(
      `Installed discoverability command rejected a valid fixture: ${valid.stderr}`,
    );
  rmSync(join(dist, 'robots.txt'));
  const invalid = run();
  if (
    invalid.status === 0 ||
    !invalid.stderr.includes('robots.txt is missing')
  ) {
    fail(
      'Installed discoverability command did not reject a missing artifact.',
    );
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(
    `verify-package: ${PACKAGE_NAME}@${manifest.version} is incomplete as installed.\n`,
  );
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\nEvery one of these is a path `files` in package.json does not carry.',
  );
  process.exit(1);
}

console.log(
  `verify-package: ${PACKAGE_NAME}@${manifest.version} installs complete (${shipped.length} files, ${Object.keys(manifest.bin ?? {}).length} bins).`,
);
