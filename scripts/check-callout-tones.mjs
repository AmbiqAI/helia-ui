#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Fails when a page asks a `Callout` for a tone that does not exist.
 *
 * MDX hands props through unchecked, so `tone="caution"` is not a type error
 * anywhere: it renders as the fallback tone with a class no rule matches, and
 * the page looks subtly wrong rather than failing. The component falls back at
 * runtime because a consumer's content must not take a build down; this repo's
 * own pages and the starter templates it ships are held to the real list.
 *
 * Scope is the gallery and the templates, which is where this package writes
 * Callouts. A consuming site's content is its own to check.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { IGNORED_DIRS, ROOT, joinRel, pkg } from './lib/scope.mjs';
import { CALLOUT_ICONS } from '../callout-tones.ts';

const TONES = new Set(Object.keys(CALLOUT_ICONS));
const SEARCH_DIRS = [pkg('docs/src'), pkg('templates')];
const CONTENT = /\.(astro|mdx?|tsx?)$/;

/* The opening tag of a Callout, up to the first `>` that is not inside a
   quoted attribute value. A self-closing tag ends the same way. */
const CALLOUT_TAG = /<Callout\b(?:"[^"]*"|'[^']*'|[^>])*>/g;
const TONE_ATTRIBUTE = /\btone\s*=\s*["']([^"']*)["']/;

const failures = [];

function walk(dir) {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return;
  for (const entry of fs
    .readdirSync(absolute, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = joinRel(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(rel);
    } else if (CONTENT.test(entry.name)) {
      check(rel);
    }
  }
}

let checked = 0;

function check(rel) {
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const match of source.matchAll(CALLOUT_TAG)) {
    const tone = TONE_ATTRIBUTE.exec(match[0])?.[1];
    checked += 1;
    /* No tone is the default tone, which is always a real one. */
    if (tone === undefined) continue;
    if (!TONES.has(tone)) {
      const line = source.slice(0, match.index).split('\n').length;
      failures.push(
        `${rel}:${line} tone="${tone}" is not a callout tone. One of: ${[...TONES].join(', ')}.`,
      );
    }
  }
}

for (const dir of SEARCH_DIRS) walk(dir);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} unknown callout tone${failures.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log(
  `check:callout-tones: ${checked} callouts, ${TONES.size} tones, no unknown tone.`,
);
