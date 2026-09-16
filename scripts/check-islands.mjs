#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Fences the React layer, which has two boundaries that nothing else enforces.
 *
 * 1. React context does not cross Astro's MDX component boundary. Astro gives
 *    each component in an `.mdx` file its own React root and passes children
 *    through as serialized HTML, so a compound shadcn component assembled in a
 *    page -- Tabs, Dialog, Select, Accordion, Command, Popover, DropdownMenu --
 *    throws at build with "must be used within". The rule is therefore that
 *    `.mdx` and `.astro` never import the React components, by package
 *    specifier or by path: every interactive use is an island in
 *    src/components/islands. See docs/spike-shadcn.md, corner case 5b. The one
 *    exception is a part under the package's astro/ that mounts a whole
 *    component as a leaf island -- a `client:` directive and no children -- for
 *    which see `mountsLeafIsland` below.
 *
 * 2. packages/helia-ui/react is the `/react` export of the package, and
 *    src/components/islands is what composes it. Neither may reach into
 *    src/data: a component that knows what a demo or a product is cannot
 *    leave this repo. That is the same contract check:boundaries applies to
 *    the Astro parts, applied to the React ones.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { ROOT, WORKSPACE, isUnder, pkg } from './lib/scope.mjs';

const UI_DIR = pkg('react');
const PARTS_DIR = pkg('astro');
/* The hub's own islands, and the data they must not reach for, are in scope
 * only when the hub is the scan root. */
const ISLAND_DIR = WORKSPACE ? 'src/components/islands' : null;
const SITE_DATA_DIR = WORKSPACE ? 'src/data' : null;
/* The package's own docs site is a second consumer with the same two
 * boundaries: its pages are .mdx and its islands live beside them. */
const DOCS_DIR = pkg('docs/src');
const DOCS_ISLAND_DIR = `${DOCS_DIR}/islands`;
/* The same directory seen from outside the workspace, which is how the hub
 * addresses it now that the components ship from the package. */
const UI_SPECIFIER = '@ambiqai/helia-ui/react/';

/* Same specifier patterns as check:boundaries, for the same reason. */
const FROM_SPECIFIER = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
const BARE_SPECIFIER = /\bimport\s*['"]([^'"]+)['"]/g;
const DYNAMIC_SPECIFIER = /\bimport\s*\(\s*['"]([^'"]+)['"]/g;
const GLOB_SPECIFIER = /\bimport\.meta\.glob\s*\(\s*['"]([^'"]+)['"]/g;

const failures = [];

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/*
 * Blanks the body of every fenced code block, keeping the line count so the
 * reported line numbers still point at the source.
 *
 * A page that documents the React layer has to be able to show the import it
 * is telling the reader to write. A fence is inert -- nothing in it is
 * compiled or executed -- so an import inside one is prose, not a boundary
 * crossing. The closing fence has to be at least as long as the opening one,
 * which is what lets a fence contain a shorter fence.
 */
function stripFences(source) {
  const lines = source.split('\n');
  let fence = null;
  return lines
    .map((line) => {
      const match = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fence === null) {
        if (!match) return line;
        fence = match[1];
        return '';
      }
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length)
        fence = null;
      return '';
    })
    .join('\n');
}

function specifiers(source) {
  const found = [];
  for (const pattern of [
    FROM_SPECIFIER,
    BARE_SPECIFIER,
    DYNAMIC_SPECIFIER,
    GLOB_SPECIFIER,
  ]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      found.push({ specifier: match[1], line: lineOf(source, match.index) });
    }
  }
  return found;
}

function collect(dir, extensions) {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  const files = [];
  for (const entry of fs
    .readdirSync(absolute, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...collect(rel, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext)))
      files.push(rel);
  }
  return files;
}

/** Where a specifier points, as a repo-relative path, or null if it is a package. */
function resolveLocal(rel, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path
    .relative(ROOT, path.resolve(path.dirname(path.join(ROOT, rel)), specifier))
    .split(path.sep)
    .join('/');
}

/** True for either way of naming the React layer: the package export or a path. */
function reachesUi(rel, specifier) {
  if (specifier.startsWith(UI_SPECIFIER)) return true;
  const target = resolveLocal(rel, specifier);
  return target !== null && isUnder(target, UI_DIR);
}

/*
 * The one exception, and the shape of it: a part under the package's astro/
 * that mounts a whole React component as a leaf island.
 *
 * What the rule above protects is composition across the boundary. Astro gives
 * each component in an `.mdx` file its own React root and serializes the
 * children, so a compound component assembled in a page loses its context. A
 * part that renders one component with a `client:` directive and no children
 * hands Astro a single root with props and nothing to serialize -- that is
 * what an island is, and the part is its wrapper, which is how a page gets a
 * filtered index by writing one tag. Children, or a use without the directive,
 * is the failure the rule exists for and still fails.
 */
const bindingsOf = (source, specifier) => {
  const pattern = new RegExp(
    `\\bimport\\s+([^;]*?)\\s+from\\s*['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
  );
  const match = pattern.exec(source);
  if (!match) return [];
  return match[1]
    .replace(/[{}]/g, ' ')
    .split(',')
    .map((part) =>
      part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        .trim(),
    )
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
};

/** The text of the tag that opens at `start`, brace-aware so a prop may hold an object. */
function tagText(source, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return source.slice(start, index);
  }
  return null;
}

function mountsLeafIsland(source, specifier) {
  const names = bindingsOf(source, specifier);
  if (names.length === 0) return false;
  return names.every((name) => {
    const opens = [...source.matchAll(new RegExp(`<${name}(?![\\w$])`, 'g'))];
    if (opens.length === 0) return false;
    if (new RegExp(`</${name}\\s*>`).test(source)) return false;
    return opens.every((open) => {
      const text = tagText(source, open.index);
      return text !== null && text.includes('client:') && text.endsWith('/');
    });
  });
}

/* Rule 1: no page assembles the React layer inline. */
const pages = [
  ...(WORKSPACE
    ? [
        ...collect('src/content', ['.mdx']),
        ...collect('src/components', ['.astro']),
        ...collect('src/pages', ['.astro', '.mdx']),
      ]
    : []),
  ...collect(pkg('astro'), ['.astro']),
  ...collect(pkg('starlight'), ['.astro']),
  ...collect(`${DOCS_DIR}/content`, ['.mdx']),
  ...collect(`${DOCS_DIR}/components`, ['.astro']),
];

for (const rel of pages) {
  const home =
    ISLAND_DIR && !isUnder(rel, DOCS_DIR) ? ISLAND_DIR : DOCS_ISLAND_DIR;
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const source = rel.endsWith('.mdx') ? stripFences(raw) : raw;
  for (const { specifier, line } of specifiers(source)) {
    if (reachesUi(rel, specifier)) {
      if (isUnder(rel, PARTS_DIR) && mountsLeafIsland(source, specifier))
        continue;
      failures.push(
        `${rel}:${line} island: imports ${specifier}. React context does not cross the MDX boundary; ` +
          `compose it in an island under ${home}/ and import that instead.`,
      );
    }
  }
}

/* Rule 2: the React layer takes its data through props. */
const reactLayer = [
  ...collect(UI_DIR, ['.ts', '.tsx']),
  ...(ISLAND_DIR ? collect(ISLAND_DIR, ['.ts', '.tsx']) : []),
  ...collect(DOCS_ISLAND_DIR, ['.ts', '.tsx']),
];

for (const rel of reactLayer) {
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const { specifier, line } of specifiers(source)) {
    const target = resolveLocal(rel, specifier);
    if (SITE_DATA_DIR && target && isUnder(target, SITE_DATA_DIR)) {
      failures.push(
        `${rel}:${line} data: imports ${specifier}; the React layer takes data through props`,
      );
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} island boundary violation${failures.length === 1 ? '' : 's'}. See docs/design-system.md, "React layer".`,
  );
  process.exit(1);
}

console.log(
  `check:islands: ${pages.length} pages and ${reactLayer.length} React files, no violations.`,
);
