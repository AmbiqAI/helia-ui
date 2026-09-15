#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Two copies of a browser peer in one page is the failure this guards.
 *
 * Standalone, the package and this site install as two trees: the package's
 * devDependencies under the repo root, this site's dependencies under docs/.
 * Where the two ranges resolve differently, the linked package imports its
 * copy and the site imports its own, and a React part composed across that
 * seam holds a provider from one copy and a consumer from the other. The
 * consumer reads the default instead of the provided value: no error, no
 * warning, just an empty frame. See AmbiqAI/helia-ui#53 and #54.
 *
 * The Vite `resolve.dedupe` list in astro.config.mjs is the fix; this is the
 * proof it still holds, from two directions:
 *
 * 1. The build. For every page, walk the chunk graph out from its islands and
 *    count the chunks carrying each peer's marker. A peer lives in one module,
 *    that module lands in one chunk, so two chunks means two copies.
 * 2. The trees. The two lockfiles must resolve every deduped peer to the same
 *    version, and where both trees are installed `npm ls` must agree.
 *
 * Runs from the docs build's assert step, where dist/ exists, and from the
 * package's validate chain, where it does not; each arm reports itself skipped
 * rather than passing quietly when its input is missing.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const docsRoot = fileURLToPath(new URL('../', import.meta.url));
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(docsRoot, 'dist');

/*
 * The peers pinned by `resolve.dedupe`, each with a string literal that
 * identifies one copy of it in a minified chunk. The literal has to come from
 * a single module of the library, not from its public name: `recharts` appears
 * wherever a chunk imports it, while `recharts-wrapper` is emitted by the one
 * module that renders the wrapper element.
 *
 * A null marker means the library ships no literal that survives minification.
 * Those peers are covered by the tree arm only, which is why that arm is not
 * optional.
 */
const PEERS = [
  { name: 'react', marker: 'react.memo_cache_sentinel' },
  { name: 'react-dom', marker: 'onRecoverableError' },
  { name: 'recharts', marker: 'recharts-wrapper' },
  { name: 'sonner', marker: 'data-sonner-toaster' },
  { name: 'radix-ui', marker: 'RovingFocusGroup' },
  { name: 'cmdk', marker: 'cmdk-root' },
  { name: 'lucide-react', marker: 'lucide' },
  { name: '@tanstack/react-table', marker: null },
  { name: 'class-variance-authority', marker: 'compoundVariants' },
  { name: 'cn', marker: null },
  { name: 'echarts', marker: 'ECharts' },
];

const failures = [];

/* ---------------------------------------------------------------- build arm */

const SPECIFIER =
  /(?:\bfrom\s*|(?:^|[^.\w$])import\s*|(?:^|[^.\w$])import\s*\(\s*)["']([^"']+)["']/g;

const sources = new Map();

function chunkSource(chunk) {
  if (sources.has(chunk)) return sources.get(chunk);
  let source = null;
  try {
    if (statSync(join(dist, chunk)).isFile())
      source = readFileSync(join(dist, chunk), 'utf8');
  } catch {
    source = null;
  }
  sources.set(chunk, source);
  return source;
}

/* The base path is part of the URL in the HTML and not part of the path on
   disk. Which base is in force depends on the config, so try the URL both
   ways rather than naming the base here. */
function toChunkPath(url) {
  const bare = url.replace(/^\//, '');
  if (chunkSource(bare) !== null) return bare;
  const debased = bare.split('/').slice(1).join('/');
  return chunkSource(debased) !== null ? debased : bare;
}

/** Every chunk reachable from an entry, by relative path under dist. */
function closure(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (seen.has(current)) continue;
    const source = chunkSource(current);
    if (source === null) continue;
    seen.add(current);
    for (const [, specifier] of source.matchAll(SPECIFIER)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
      const from = specifier.startsWith('/')
        ? toChunkPath(specifier)
        : resolve('/', dirname(current), specifier).replace(/^\//, '');
      queue.push(from);
    }
  }
  return seen;
}

function* htmlPages(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlPages(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

function entryUrls(html) {
  const urls = [];
  for (const [, componentUrl, rendererUrl] of html.matchAll(
    /<astro-island\b[^>]*?component-url="([^"]+)"[^>]*?renderer-url="([^"]+)"/g,
  ))
    urls.push(componentUrl, rendererUrl);
  for (const [, src] of html.matchAll(
    /<script\b[^>]*?\btype="module"[^>]*?\bsrc="([^"]+)"/g,
  ))
    if (!/^https?:/.test(src)) urls.push(src);
  return urls;
}

function checkBuild() {
  if (!existsSync(dist)) {
    console.log('peers: build arm skipped, dist/ does not exist.');
    return;
  }

  /* Marker membership is a property of the chunk, not of the page, so it is
     computed once and intersected with each page's closure. */
  const chunks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js'))
        chunks.push(relative(dist, path).split(sep).join('/'));
    }
  };
  walk(dist);

  const carriers = new Map(PEERS.map((peer) => [peer.name, new Set()]));
  for (const chunk of chunks) {
    const source = chunkSource(chunk);
    if (source === null) continue;
    for (const peer of PEERS)
      if (peer.marker !== null && source.includes(peer.marker))
        carriers.get(peer.name).add(chunk);
  }

  let pages = 0;
  let loaded = 0;
  for (const page of htmlPages(dist)) {
    pages += 1;
    const urls = entryUrls(readFileSync(page, 'utf8'));
    if (urls.length === 0) continue;
    const reached = new Set();
    for (const url of urls)
      for (const chunk of closure(toChunkPath(url))) reached.add(chunk);
    if (reached.size === 0) continue;
    loaded += 1;

    const route = `/${relative(dist, page).split(sep).slice(0, -1).join('/')}`;
    for (const peer of PEERS) {
      const copies = [...carriers.get(peer.name)].filter((chunk) =>
        reached.has(chunk),
      );
      if (copies.length > 1)
        failures.push(
          `${route} bundles ${peer.name} ${copies.length} times: ${copies.join(', ')}. ` +
            'Add it to resolve.dedupe in astro.config.mjs, or align the pins so both trees resolve one version.',
        );
    }
  }

  const scanned = PEERS.filter((peer) => peer.marker !== null);
  console.log(
    `peers: ${scanned.length} of ${PEERS.length} scanned across ${loaded} of ${pages} pages that load a module, ${chunks.length} chunks.`,
  );
}

/* ----------------------------------------------------------------- tree arm */

function lockVersions(lockPath) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const versions = new Map();
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const at = path.lastIndexOf('node_modules/');
    if (at === -1 || !entry.version) continue;
    const name = path.slice(at + 'node_modules/'.length);
    if (!versions.has(name)) versions.set(name, new Set());
    versions.get(name).add(entry.version);
  }
  return versions;
}

/** Every version of `name` npm reports in the tree rooted at `cwd`. */
function installedVersions(cwd, name) {
  let output;
  try {
    output = execFileSync('npm', ['ls', name, '--all', '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    /* `npm ls` exits non-zero on any tree complaint, including ones that have
       nothing to do with this peer, but still prints the tree. */
    output = error.stdout;
  }
  const found = new Set();
  const visit = (node) => {
    for (const [child, value] of Object.entries(node.dependencies ?? {})) {
      if (child === name && value.version) found.add(value.version);
      visit(value);
    }
  };
  if (output) visit(JSON.parse(output));
  return found;
}

function checkTrees() {
  const packageLock = join(packageRoot, 'package-lock.json');
  const docsLock = join(docsRoot, 'package-lock.json');
  if (!existsSync(packageLock) || !existsSync(docsLock)) {
    console.log('peers: tree arm skipped, one of the lockfiles is missing.');
    return;
  }

  const before = failures.length;
  const inPackage = lockVersions(packageLock);
  const inDocs = lockVersions(docsLock);
  for (const { name } of PEERS) {
    const here = inDocs.get(name);
    const there = inPackage.get(name);
    if (!here || !there) continue;
    const union = new Set([...here, ...there]);
    if (union.size > 1)
      failures.push(
        `${name} resolves to ${[...union].sort().join(' and ')}: ` +
          `package-lock.json has ${[...there].sort().join(', ')}, docs/package-lock.json has ${[...here].sort().join(', ')}. ` +
          "Standalone these install as two trees, so the site bundles both. Align docs/package.json with the package's range.",
      );
  }

  if (!existsSync(join(docsRoot, 'node_modules'))) {
    if (failures.length === before)
      console.log(
        'peers: lockfiles agree; npm ls skipped, docs dependencies are not installed.',
      );
    return;
  }

  for (const { name } of PEERS) {
    const versions = installedVersions(docsRoot, name);
    if (versions.size > 1)
      failures.push(
        `npm ls ${name} reports ${[...versions].sort().join(' and ')} in the docs tree. ` +
          'One of them came in through the linked package; the site would bundle both.',
      );
  }
  if (failures.length === before)
    console.log('peers: lockfiles agree and npm ls reports one version each.');
}

/* -------------------------------------------------------------------------- */

checkBuild();
checkTrees();

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} peer duplication check${failures.length === 1 ? '' : 's'} failed.`,
  );
  process.exit(1);
}
