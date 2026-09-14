#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Mechanical MkDocs Material -> Starlight MDX conversion, so a product repo
 * moving its docs off MkDocs does the same conversion every other one did.
 *
 *   helia-ui-mkdocs-convert --docs docs --out website/src/content/docs \
 *                           --base /helia-aot --public website/public \
 *                           --sidebar website/src/generated/docs-sidebar.json
 *
 * The MkDocs tree stays the source of truth until the deploy switch, so this
 * runs repeatedly and must be idempotent: it rewrites `--out` from scratch on
 * every run, keeping only the entries named by `--keep`.
 *
 * What it cannot do by hand-waving is listed in the report it prints: raw HTML
 * blocks, charts and unmapped icons need a human pass.
 *
 * No dependencies: this runs from a product repository's CI with nothing
 * installed but the package itself.
 */

import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  SnippetError,
  buildSidebar,
  convertPage,
  createState,
  navPaths,
  normaliseBase,
  parseNav,
} from './lib/mkdocs-convert-render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/*
 * The landing page is authored, not converted: a MkDocs `index.md` is
 * typically a bespoke HTML hero built against Material's stylesheet, and it
 * carries status copy that has to be re-approved rather than machine
 * translated.
 */
const DEFAULT_SKIP = ['index.md'];

/* Directories MkDocs serves as theme assets, not content. */
const SKIP_DIRS = new Set(['css', 'js', 'overrides']);

/* Not ours to delete when the output tree is rebuilt: the hand-authored
 * landing and the API reference `helia-ui-pyref` generates beside it. */
const DEFAULT_KEEP = ['index.mdx', 'api'];

const USAGE = `helia-ui-mkdocs-convert --docs <dir> --out <dir> --base <path> [options]

  --docs <dir>        MkDocs docs_dir to read
  --out <dir>         Starlight content collection directory to write
  --base <path>       site base path, e.g. /helia-aot
  --config <file>     mkdocs.yml; default: mkdocs.yml or mkdocs.yaml beside --docs
  --icons <file>      JSON map of :material-NAME: to Font Awesome solid names,
                      merged over the built-in map
  --public <dir>      copy linked images and docs/assets/** here
  --sidebar <file>    write the mkdocs nav as a Starlight sidebar JSON fragment
  --skip <path>       docs-relative page to leave alone; repeatable,
                      default ${DEFAULT_SKIP.join(' ')}
  --keep <name>       entry in --out not to delete; repeatable,
                      default ${DEFAULT_KEEP.join(' ')}
  --dry-run           convert and report, write nothing
  --report            print per-rewrite counts and the hand-pass list
`;

const { values } = parseArgs({
  options: {
    docs: { type: 'string' },
    out: { type: 'string' },
    base: { type: 'string' },
    config: { type: 'string' },
    icons: { type: 'string' },
    public: { type: 'string' },
    sidebar: { type: 'string' },
    skip: { type: 'string', multiple: true },
    keep: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    report: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

const die = (message) => {
  console.error(`mkdocs-convert: ${message}`);
  process.exit(1);
};

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!values.docs || !values.out)
  die(`--docs and --out are required.\n\n${USAGE}`);

const SRC = resolve(values.docs);
const OUT = resolve(values.out);
const PUBLIC = values.public ? resolve(values.public) : null;
const base = normaliseBase(values.base ?? '');
const dryRun = values['dry-run'];
const skip = new Set(values.skip ?? DEFAULT_SKIP);
const keep = new Set(values.keep ?? DEFAULT_KEEP);

async function loadIcons() {
  const builtin = JSON.parse(
    await readFile(join(HERE, 'lib/material-icons.json'), 'utf8'),
  );
  if (!values.icons) return builtin;
  const extra = JSON.parse(await readFile(resolve(values.icons), 'utf8'));
  return { ...builtin, ...extra };
}

/** mkdocs.yml beside the docs tree, unless one was named. */
function configPath() {
  if (values.config) return resolve(values.config);
  for (const name of ['mkdocs.yml', 'mkdocs.yaml']) {
    const candidate = join(dirname(SRC), name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function walk(dir, rootRelative = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = rootRelative ? `${rootRelative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(rel)) continue;
      out.push(...(await walk(join(dir, entry.name), rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}

async function main() {
  if (!existsSync(SRC)) die(`no docs tree at ${SRC}`);
  const icons = await loadIcons();
  const state = createState();
  const files = await walk(SRC);
  const pages = files.filter((f) => f.endsWith('.md') && !skip.has(f));

  /* Idempotence: the generated tree is a pure function of the docs tree, so it
   * is rebuilt rather than merged. */
  if (!dryRun) {
    for (const entry of await readdir(OUT, { withFileTypes: true }).catch(
      () => [],
    )) {
      if (keep.has(entry.name)) continue;
      await rm(join(OUT, entry.name), { recursive: true, force: true });
    }
  }

  const copied = new Set();
  const titles = {};
  for (const relPath of pages) {
    const raw = await readFile(join(SRC, relPath), 'utf8');
    const page = convertPage(raw, relPath, { state, icons, base });
    titles[relPath] = page.title;

    if (!dryRun) {
      const dest = join(OUT, relPath.replace(/\.md$/, '.mdx'));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, page.text);
    }

    for (const img of page.images) {
      if (!files.includes(img) || copied.has(img)) continue;
      copied.add(img);
      state.counts.imagesCopied += 1;
      if (dryRun || !PUBLIC) continue;
      const to = join(PUBLIC, img);
      await mkdir(dirname(to), { recursive: true });
      await copyFile(join(SRC, img), to);
    }
    for (const item of page.handPass)
      state.handPass.push(`${relPath}: ${item}`);
  }

  /* Non-markdown assets MkDocs served that a converted page links to are
   * copied above; the theme's own images are copied wholesale so a
   * hand-authored landing can use them. */
  if (PUBLIC && !dryRun) {
    for (const asset of files.filter((f) =>
      /^assets\/.*\.(png|jpe?g|svg|webp)$/.test(f),
    )) {
      const to = join(PUBLIC, asset);
      await mkdir(dirname(to), { recursive: true });
      await copyFile(join(SRC, asset), to);
    }
  }

  const config = configPath();
  let nav = [];
  if (config) nav = parseNav(await readFile(config, 'utf8'));

  if (values.sidebar) {
    if (!config)
      die('--sidebar needs a mkdocs config; none found, pass --config.');
    if (nav.length === 0) die(`--sidebar found no nav: block in ${config}.`);
    const fragment = `${JSON.stringify(buildSidebar(nav, titles), null, 2)}\n`;
    if (!dryRun) {
      await mkdir(dirname(resolve(values.sidebar)), { recursive: true });
      await writeFile(resolve(values.sidebar), fragment);
    }
  }

  /* A nav entry with no page behind it is a 404 after the switch, which is the
   * one failure a reader sees before anyone else does. */
  const missing = navPaths(nav).filter(
    (p) =>
      !files.includes(p) ||
      (skip.has(p) && !existsSync(join(OUT, p.replace(/\.md$/, '.mdx')))),
  );
  for (const p of missing)
    state.handPass.push(`${p}: named in the mkdocs nav, no page written`);

  console.log(
    `mkdocs-convert: ${state.counts.pages} page(s) ${dryRun ? 'read from' : 'written from'} ${SRC}` +
      `${dryRun ? '' : ` -> ${OUT}`}`,
  );

  if (values.report) {
    for (const [k, v] of Object.entries(state.counts))
      console.log(`  ${k.padEnd(24)} ${v}`);
    if (skip.size)
      console.log(`  skipped (hand-authored)  ${[...skip].join(', ')}`);
    if (nav.length)
      console.log(`  nav entries              ${navPaths(nav).length}`);

    if (state.unmapped.size) {
      console.log(
        '\nUnmapped Material icons (emitted as [unmapped icon: ...] markers):',
      );
      for (const [name, n] of [...state.unmapped].sort())
        console.log(`  :material-${name}: x${n}`);
    }
    if (state.missingTitle.length) {
      console.log('\nPages with no H1 (title derived from the filename):');
      for (const p of state.missingTitle) console.log(`  ${p}`);
    }
    if (state.handPass.length) {
      console.log('\nHand pass needed:');
      for (const item of state.handPass) console.log(`  ${item}`);
    }
  } else if (state.unmapped.size || state.handPass.length) {
    console.log(
      `  ${state.unmapped.size} unmapped icon name(s), ${state.handPass.length} hand-pass item(s); run with --report`,
    );
  }
}

main().catch((err) => {
  if (err instanceof SnippetError) die(err.message);
  console.error(`mkdocs-convert: ${err.stack ?? err.message}`);
  process.exit(1);
});
