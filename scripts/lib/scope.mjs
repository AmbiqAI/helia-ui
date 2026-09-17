// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The scan scope the package checks share, so that one copy of each check runs
 * from two roots.
 *
 * Without `--root` the root is this package, which is what it is once the
 * package is the root of its own repository. With `--root <dir>` the root is
 * the workspace that contains the package -- the hub passes `--root .` -- and
 * the same check covers the hub's own tree as well.
 *
 * Every path a check reports is relative to `ROOT`, and the package sits at
 * `PACKAGE_DIR` inside it. That is the empty string when the package is the
 * root, so joins go through `joinRel` and containment through `isUnder`
 * rather than through string concatenation, which would produce a leading
 * slash and a path that matches nothing.
 */

import path from 'node:path';
import process from 'node:process';

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..', '..');

const argv = process.argv.slice(2);
const flag = argv.indexOf('--root');
const given = flag === -1 ? null : argv[flag + 1];

export const ROOT = given ? path.resolve(given) : PACKAGE_ROOT;

export const PACKAGE_DIR = path
  .relative(ROOT, PACKAGE_ROOT)
  .split(path.sep)
  .join('/');

if (PACKAGE_DIR.startsWith('..')) {
  console.error(
    `--root ${given} does not contain ${PACKAGE_ROOT}; the checks scan the package and, optionally, the workspace around it.`,
  );
  process.exit(1);
}

/** True when the root is a workspace around the package rather than the package. */
export const WORKSPACE = PACKAGE_DIR !== '';

/** Build output and installed dependencies live under the walked roots. */
export const IGNORED_DIRS = new Set([
  '.astro',
  // Agent tooling puts task worktrees under .claude/worktrees, which are whole
  // checkouts of this repository. Walking into one reports every finding again
  // against a path the committing developer does not own.
  '.claude',
  '.git',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);

export const joinRel = (dir, name) => (dir === '' ? name : `${dir}/${name}`);

/** A path inside the package, relative to ROOT. */
export const pkg = (sub) => joinRel(PACKAGE_DIR, sub);

export const isUnder = (target, dir) =>
  dir === ''
    ? !target.startsWith('..')
    : target === dir || target.startsWith(`${dir}/`);
