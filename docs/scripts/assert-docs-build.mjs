#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Two claims about the built docs site that nothing else checks.
 *
 * 1. Every route the sidebar offers exists. A Starlight sidebar entry naming a
 *    slug that no page resolves is a build error, but a page that quietly
 *    stops being emitted -- renamed, moved, or dropped from the collection --
 *    is not, and the sidebar would follow it out of the build.
 *
 * 2. React reaches only the React-components section. The site documents three
 *    lanes and the whole point of the Astro lane is that it costs no
 *    JavaScript, so a hydrated component on a page outside `react/` means a
 *    part was documented through an island that did not need to be one.
 *    `<astro-island>` is the marker: Astro emits one per hydrated component
 *    and nothing else on these pages produces it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import process from 'node:process';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

/* Mirrors the sidebar in astro.config.mjs. Kept by hand on purpose: the point
 * is to state the expected shape independently of the config that produces
 * it. */
const ASTRO_LANE = [
  '',
  'foundations',
  'foundations/site-theme',
  /* The gallery is the busiest Astro-lane page there is; if anything on it
     needed an island the lane's whole premise would be in question. */
  'gallery',
  'starlight-plugin',
  'migrating-from-mkdocs',
  'python-api-reference',
  'primitives',
  'cards',
  'media',
  'code',
  'callouts',
  'disclosure',
  'timeline',
  /* Diagrams belongs here rather than anywhere else: build-time mermaid is
     only worth the browser it costs if the page ships no island. */
  'diagrams',
  'layout',
  'reference/astro-parts',
];

/* Prose about the starters. They document an app lane that does hydrate, but
 * these pages are docs and must not. */
const TEMPLATE_LANE = ['templates/docs-sites', 'templates/web-apps'];

const REACT_LANE = [
  'react/inputs',
  'react/form-depth',
  'react/overlays',
  'react/feedback',
  'react/data-display',
  'react/navigation',
  'react/versioning',
];

const failures = [];

if (!existsSync(dist)) {
  throw new Error('dist/ does not exist. Run npm run build first.');
}

const ISLAND = /<astro-island\b/;

for (const route of [...ASTRO_LANE, ...TEMPLATE_LANE, ...REACT_LANE]) {
  const path = join(dist, route, 'index.html');
  if (!existsSync(path)) {
    failures.push(`/${route} was not emitted (${path} is missing).`);
    continue;
  }

  const html = readFileSync(path, 'utf8');
  const hydrated = ISLAND.test(html);
  const expected = REACT_LANE.includes(route);

  if (hydrated && !expected) {
    failures.push(
      `/${route} hydrates a React component. Only the React-components section may.`,
    );
  }
  if (!hydrated && expected) {
    failures.push(
      `/${route} is in the React-components section but hydrates nothing.`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} docs build assertion${failures.length === 1 ? '' : 's'} failed.`,
  );
  process.exit(1);
}

console.log(
  `assert: ${ASTRO_LANE.length + TEMPLATE_LANE.length + REACT_LANE.length} routes emitted, React confined to ${REACT_LANE.length}.`,
);
