#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Serves `dist/` under the site's base path for the route tests.
 *
 * `astro preview` is the obvious thing to point Playwright's `webServer` at,
 * and it is what a human should use. It is not what CI uses: preview can
 * detach from the runner, and Playwright then fails the whole suite with
 * "Process from config.webServer exited early" rather than a test result. This
 * is a plain static server in the test runner's own process tree, with no
 * dependency and nothing to detach from.
 *
 * The build is a separate step: this serves what is already in `dist/` and
 * says so rather than serving a stale tree silently.
 *
 *   node scripts/serve-dist.mjs --port 4325 --base /PRODUCT-REPO-NAME
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '4325' },
    base: { type: 'string', default: '/' },
    dist: { type: 'string', default: 'dist' },
  },
});

const DIST = resolve(values.dist);
const BASE = values.base === '/' ? '' : values.base.replace(/\/+$/, '');
const PORT = Number(values.port);

if (!existsSync(DIST)) {
  console.error(
    `serve-dist: no build at ${DIST}. Run \`npm run build\` first.`,
  );
  process.exit(1);
}

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/** The file a URL path names, or null if it escapes `dist/` or is missing. */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  if (BASE && !(decoded === BASE || decoded.startsWith(`${BASE}/`)))
    return null;
  const withoutBase = BASE ? decoded.slice(BASE.length) : decoded;
  const clean = normalize(withoutBase).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(DIST, clean);
  if (!candidate.startsWith(DIST)) return null;

  for (const file of [
    candidate,
    join(candidate, 'index.html'),
    `${candidate}.html`,
  ]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer((req, res) => {
  const file = resolveFile(req.url ?? '/');
  if (!file) {
    const notFound = join(DIST, '404.html');
    const body = existsSync(notFound) ? createReadStream(notFound) : null;
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    if (body) body.pipe(res);
    else res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`serve-dist: ${DIST} on http://127.0.0.1:${PORT}${BASE}/`);
});
