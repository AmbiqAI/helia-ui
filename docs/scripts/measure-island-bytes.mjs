#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * What each charting island costs the comparison page, measured rather than
 * estimated.
 *
 * The figure in the facts table has to mean one thing, so it is defined here:
 * every built chunk reachable from the island's entry module, minus every
 * chunk reachable from the React client renderer, which the page loads once
 * whichever library wins. Minified, not compressed -- these four differ in
 * parse cost more than they differ in transfer.
 *
 * Reads the built site, so run it after `npm run build`. It prints; it does
 * not write. The numbers go into src/lib/chart-candidates.ts by hand, next to
 * the version they were taken from.
 */

import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const page = join(dist, 'react/charts-candidates/index.html');

const html = readFileSync(page, 'utf8');

/* Astro writes one <astro-island> per hydrated component, carrying the entry
   module and the renderer that hydrates it. */
const islands = [
  ...html.matchAll(
    /<astro-island\b[^>]*?component-url="([^"]+)"[^>]*?component-export="([^"]*)"[^>]*?renderer-url="([^"]+)"/g,
  ),
].map(([, componentUrl, , rendererUrl]) => ({ componentUrl, rendererUrl }));

if (islands.length === 0) {
  console.error('no islands found on the comparison page');
  process.exit(1);
}

const SPECIFIER =
  /(?:\bfrom\s*|(?:^|[^.\w$])import\s*|(?:^|[^.\w$])import\s*\(\s*)["']([^"']+)["']/g;

const sizes = new Map();

/** Every chunk reachable from an entry, by relative path under dist. */
function closure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    let source;
    try {
      source = readFileSync(join(dist, current), 'utf8');
    } catch {
      seen.delete(current);
      continue;
    }
    if (!sizes.has(current))
      sizes.set(current, statSync(join(dist, current)).size);
    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
      const from = specifier.startsWith('/')
        ? specifier.replace(/^\//, '')
        : resolve('/', dirname(current), specifier).replace(/^\//, '');
      queue.push(from);
    }
  }
  return seen;
}

/* The base path is part of the URL in the HTML and not part of the path on
   disk, so it comes off before anything is opened. */
const strip = (url) => url.replace(/^\/helia-ui\//, '').replace(/^\//, '');

const shared = closure(strip(islands[0].rendererUrl));
const total = (set) =>
  [...set].reduce((sum, chunk) => sum + (sizes.get(chunk) ?? 0), 0);

console.log(`shared React runtime: ${total(shared)} bytes`);
for (const island of islands) {
  const entry = strip(island.componentUrl);
  const own = [...closure(entry)].filter((chunk) => !shared.has(chunk));
  console.log(
    `${entry}: ${total(new Set(own))} bytes over ${own.length} chunks`,
  );
}
