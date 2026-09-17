#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Reads the discoverability contract back off the built site.
 *
 * The plugin emits the tags and the artifacts; nothing else proves they
 * survived to the output. A page that loses its description, an override that
 * displaces the head component, a route added after llms.txt was last thought
 * about -- each is silent in a build log and each costs the page its search
 * result or its agent rendition.
 *
 * The built HTML is the only input. Tags are matched with a scan rather than a
 * parse so this stays dependency-free and runs in the package, the hub, and
 * the docs app alike, all three of which have different trees.
 *
 * Usage: check-discoverability.mjs [--root <dir>] [--allow-missing]
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: process.cwd() },
    'allow-missing': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(
    'Usage: helia-ui-check-discoverability [--root <site>] [--allow-missing]',
  );
  process.exit(0);
}
const root = resolve(values.root);
const allowMissing = values['allow-missing'];

const dist = join(root, 'dist');
const indexPath = join(dist, 'content-index.json');

if (!existsSync(indexPath)) {
  const where = relative(process.cwd(), indexPath) || indexPath;
  if (allowMissing) {
    console.log(`check:discoverability skipped: no build at ${where}.`);
    process.exit(0);
  }
  console.error(
    `check:discoverability: ${where} is missing. Run the site build first; the ` +
      'plugin writes the index on astro:build:done.',
  );
  process.exit(1);
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const base = index.base ?? '/';
const failures = [];

const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

/* Between the tag name and the closing bracket, attributes in either order. */
const attribute = (html, name, value, wanted) =>
  new RegExp(
    `<meta[^>]*\\b${name}=["']${value}["'][^>]*\\b${wanted}=["']([^"']*)["']`,
    'i',
  ).exec(html)?.[1] ??
  new RegExp(
    `<meta[^>]*\\b${wanted}=["']([^"']*)["'][^>]*\\b${name}=["']${value}["']`,
    'i',
  ).exec(html)?.[1];

const REQUIRED = [
  ['description', (html) => attribute(html, 'name', 'description', 'content')],
  ['og:title', (html) => attribute(html, 'property', 'og:title', 'content')],
  [
    'og:description',
    (html) => attribute(html, 'property', 'og:description', 'content'),
  ],
  ['og:image', (html) => attribute(html, 'property', 'og:image', 'content')],
];

const htmlFiles = walk(dist).filter((path) => path.endsWith('.html'));

/*
 * Astro's own 404 is not a content route: it has no source page, so no
 * description, no rendition, and no line in llms.txt. Nor is a redirect stub,
 * which Astro emits already carrying `noindex` and a canonical link to the
 * route it forwards to.
 */
const REDIRECT = /<meta[^>]*\bhttp-equiv=["']refresh["']/i;
const routeFiles = htmlFiles.filter(
  (path) =>
    relative(dist, path) !== '404.html' &&
    !REDIRECT.test(readFileSync(path, 'utf8')),
);

let renditions = 0;

for (const path of routeFiles) {
  const route = `/${relative(dist, path)}`;
  const html = readFileSync(path, 'utf8');

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  if (!title) failures.push(`${route}: no <title>.`);

  const canonical = /<link[^>]*\brel=["']canonical["'][^>]*>/i.test(html);
  if (!canonical) failures.push(`${route}: no <link rel="canonical">.`);

  for (const [name, read] of REQUIRED) {
    if (!read(html)) failures.push(`${route}: no ${name}.`);
  }

  const markdown = join(path.replace(/index\.html$/, ''), 'index.md');
  if (existsSync(markdown) && statSync(markdown).isFile()) renditions += 1;
  else failures.push(`${route}: no markdown rendition beside it.`);
}

const llmsPath = join(dist, 'llms.txt');
if (!existsSync(llmsPath)) {
  failures.push('llms.txt is missing.');
} else {
  const llms = readFileSync(llmsPath, 'utf8');
  for (const entry of index.routes) {
    if (!llms.includes(entry.markdown)) {
      failures.push(`llms.txt does not list ${entry.route}.`);
    }
  }
}

for (const artifact of ['llms-full.txt', 'sitemap-index.xml', 'robots.txt']) {
  if (!existsSync(join(dist, artifact)))
    failures.push(`${artifact} is missing.`);
}

if (failures.length > 0) {
  console.error('Discoverability assertions failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(
    `\n${failures.length} discoverability assertion${failures.length === 1 ? '' : 's'} failed.`,
  );
  process.exit(1);
}

console.log(
  `Discoverability verified across ${routeFiles.length} HTML routes under ${base}: ` +
    `${renditions} markdown renditions, ${index.routes.length} routes in llms.txt.`,
);
