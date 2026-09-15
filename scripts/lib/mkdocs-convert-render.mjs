// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The MkDocs Material -> Starlight MDX rewrites, as pure functions over text.
 *
 * Kept apart from the CLI so the contract can be tested without a filesystem:
 * every rewrite here is exercised from `scripts/mkdocs-convert.test.mjs`
 * against a fixture small enough to read.
 *
 * Counts, unmapped icons and the hand-pass list live in a state object passed
 * in by the caller rather than in module scope, so one process can convert
 * several trees (or a test can run twice) without the tallies bleeding.
 */

import { posix } from 'node:path';

/* Material has twelve admonition types, Starlight's Aside has four. The
 * collapsing is the mapping table in the package's migration guide.
 *
 * `Aside` is what the converter emits because it is the built-in: themed,
 * translated, no import. Starlight validates the type against a fixed four and
 * throws on anything else, so `success` cannot be an `Aside` and lands on
 * `tip`. Where a page needs the distinction, the hand pass swaps in the
 * package's `Callout`, whose tone column in the migration table is wider than
 * this one: `important`, `warning`, `critical` and `success`. */
export const ASIDE = {
  note: 'note',
  abstract: 'note',
  summary: 'note',
  tldr: 'note',
  info: 'note',
  question: 'note',
  help: 'note',
  faq: 'note',
  example: 'note',
  quote: 'note',
  cite: 'note',
  tip: 'tip',
  hint: 'tip',
  important: 'tip',
  success: 'tip',
  check: 'tip',
  done: 'tip',
  warning: 'caution',
  caution: 'caution',
  attention: 'caution',
  failure: 'caution',
  fail: 'caution',
  missing: 'caution',
  danger: 'danger',
  error: 'danger',
  bug: 'danger',
};

/* The migration table sends these to a blockquote rather than an Aside; the
 * Aside above is the mechanical stand-in and the hand pass decides. */
const BLOCKQUOTE_PREFERRED = new Set(['quote', 'cite']);

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export const COUNT_KEYS = [
  'pages',
  'admonitions',
  'collapsibleAdmonitions',
  'tabGroups',
  'tabItems',
  'icons',
  'unmappedIcons',
  'mathExpressions',
  'links',
  'baseRelativeLinks',
  'images',
  'imagesCopied',
  'rawHtmlBlocks',
  'mdInHtmlAttrs',
  'attrListsStripped',
  'htmlComments',
  'terminals',
  'charts',
  'mermaidBlocks',
  'tableReaderMacros',
  'voidTagsClosed',
];

export function createState() {
  return {
    counts: Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])),
    unmapped: new Map(),
    handPass: [],
    missingTitle: [],
  };
}

/** A base path is always absolute and never carries a trailing slash. */
export function normaliseBase(base) {
  if (!base || base === '/') return '';
  const withLead = base.startsWith('/') ? base : `/${base}`;
  return withLead.endsWith('/') ? withLead.slice(0, -1) : withLead;
}

export class SnippetError extends Error {}

/* ---------- helpers ---------- */

const indentOf = (line) => line.match(/^\s*/)[0].length;

function dedent(lines, n) {
  return lines.map((l) =>
    l.length >= n && l.slice(0, n).trim() === '' ? l.slice(n) : l.trimStart(),
  );
}

function trimBlank(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a].trim() === '') a += 1;
  while (b > a && lines[b - 1].trim() === '') b -= 1;
  return lines.slice(a, b);
}

const isFence = (line) => /^\s*(```+|~~~+)/.test(line);
const fenceToken = (line) => line.match(/^\s*(`{3,}|~{3,})/)?.[1] ?? '';

/* ---------- link and image rewriting ---------- */

/*
 * MkDocs rewrites relative links against the source tree at build time; Astro
 * does not, so a link has to be re-expressed against the *route* it will be
 * read from. `a/b.md` is read at `a/b/`, one level deeper than its source
 * directory, which is why a naive copy of `../reference/` lands in the wrong
 * place.
 */
export function routeDirFor(relPath) {
  const parts = relPath.replace(/\.md$/, '').split('/');
  if (parts[parts.length - 1] === 'index') parts.pop();
  return parts.join('/');
}

function rewriteTarget(target, ctx) {
  const [rawPath, hash = ''] = target.split('#');
  if (!rawPath) return target;
  const resolved = posix.normalize(
    posix.join(posix.dirname(ctx.relPath), rawPath),
  );
  const isMarkdown = /\.md$/.test(rawPath);
  const dest = isMarkdown ? routeDirFor(resolved) : resolved;
  let rel = posix.relative(ctx.routeDir, dest);
  if (rel === '') rel = './';
  if (isMarkdown && !rel.endsWith('/')) rel += '/';
  if (!isMarkdown && !rel.startsWith('.') && !rel.startsWith('/'))
    rel = `./${rel}`;
  return hash ? `${rel}#${hash}` : rel;
}

/*
 * A root-relative link meant the site root, which under a base path is no
 * longer `/`. MkDocs had no base to honor; Astro serves the whole tree below
 * one, so the link has to carry it or it leaves the site.
 */
function applyBase(target, ctx) {
  if (!ctx.base) return target;
  if (target === ctx.base || target.startsWith(`${ctx.base}/`)) return target;
  return `${ctx.base}${target}`;
}

function rewriteLinks(text, ctx) {
  return text.replace(
    /(!?)\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (m, bang, label, target, title) => {
      if (/^(https?:|mailto:|#)/.test(target)) return m;
      if (target.startsWith('/')) {
        const based = applyBase(target, ctx);
        if (based === target) return m;
        ctx.state.counts.baseRelativeLinks += 1;
        return `${bang}[${label}](${based}${title ?? ''})`;
      }
      if (bang === '!') {
        ctx.state.counts.images += 1;
        ctx.images.add(
          posix.normalize(posix.join(posix.dirname(ctx.relPath), target)),
        );
        return `![${label}](${rewriteTarget(target, ctx)}${title ?? ''})`;
      }
      if (
        !/\.md($|#)/.test(target) &&
        !/\.(png|jpe?g|svg|gif|webp|csv)$/.test(target)
      )
        return m;
      ctx.state.counts.links += 1;
      return `[${label}](${rewriteTarget(target, ctx)}${title ?? ''})`;
    },
  );
}

/* ---------- inline text ---------- */

function replaceIcons(text, ctx) {
  return text.replace(/:material-([a-z0-9-]+):/g, (_m, name) => {
    const fa = ctx.icons[name];
    if (!fa) {
      ctx.state.counts.unmappedIcons += 1;
      ctx.state.unmapped.set(name, (ctx.state.unmapped.get(name) ?? 0) + 1);
      return `[unmapped icon: ${name}]`;
    }
    ctx.state.counts.icons += 1;
    ctx.needs.icon = true;
    return `<Icon name="${fa}" />`;
  });
}

/*
 * MDX reads `{` as an expression and `<` as a tag, so any prose that meant
 * them literally has to be escaped or the page will not compile. Code spans
 * are exempt: MDX does not read inside them.
 */
function escapeMdx(text) {
  return text
    .replace(/[{}]/g, (c) => `\\${c}`)
    .replace(/<(\/?)([A-Za-z][\w.-]*)?/g, (m, slash, name) =>
      name && isElementName(name) ? m : `&lt;${slash}${name ?? ''}`,
    );
}

function mapOutsideCode(text, fn) {
  return text
    .split(/(`+[^`]*`+)/g)
    .map((part) => (part.startsWith('`') ? part : fn(part)))
    .join('');
}

/*
 * A `<` only means a tag if what follows it names one. Prose in these pages
 * writes things like `<prefix>` and `<N>` meaning "substitute a value here",
 * and MDX would read those as components that are never closed.
 */
const HTML_TAGS = new Set([
  'a',
  'abbr',
  'aside',
  'b',
  'blockquote',
  'br',
  'button',
  'canvas',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figure',
  'figcaption',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'iframe',
  'img',
  'input',
  'kbd',
  'label',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'p',
  'picture',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'select',
  'small',
  'source',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'video',
]);

const isElementName = (name) =>
  HTML_TAGS.has(name.toLowerCase()) || /^[A-Z]/.test(name);

const hasTag = (line) => {
  for (const m of line.matchAll(/<\/?([A-Za-z][\w.-]*)/g)) {
    if (isElementName(m[1])) return true;
  }
  return /<!--/.test(line);
};

function fixVoidTags(line, ctx) {
  return line.replace(
    /<([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)>/g,
    (m, tag, attrs) => {
      if (!VOID_TAGS.has(tag.toLowerCase())) return m;
      if (/\/\s*$/.test(attrs)) return m;
      ctx.state.counts.voidTagsClosed += 1;
      return `<${tag}${attrs} />`;
    },
  );
}

function stripMarkdownAttr(line, ctx) {
  return line.replace(
    /(<[a-zA-Z][\w-]*[^<>]*?)\s+markdown(=["']1["'])?(\s*\/?>)/g,
    (_m, head, _eq, tail) => {
      ctx.state.counts.mdInHtmlAttrs += 1;
      return `${head}${tail}`;
    },
  );
}

function stripAttrList(text, ctx) {
  return text.replace(/\{\s*[.#][^}\n]*\}/g, () => {
    ctx.state.counts.attrListsStripped += 1;
    return '';
  });
}

function inlineTransform(line, ctx) {
  let out = line;

  out = mapOutsideCode(out, (t) => stripAttrList(t, ctx));
  out = rewriteLinks(out, ctx);
  out = mapOutsideCode(out, (t) => replaceIcons(t, ctx));

  out = out.replace(/\{\{\s*read_csv\(([^)]*)\)\s*\}\}/g, (_m, arg) => {
    ctx.state.counts.tableReaderMacros += 1;
    ctx.handPass.add(
      `table-reader macro read_csv(${arg.trim()}) needs a DataTable island`,
    );
    return `[table-reader: read_csv(${arg.trim()})]`;
  });

  /* Math moves across untouched — remark-math is on the Astro config — so it
   * is only counted, to prove none of it was mangled on the way. */
  mapOutsideCode(out, (t) => {
    ctx.state.counts.mathExpressions += (
      t.match(/\$\$?[^$\n]+\$\$?/g) ?? []
    ).length;
    return t;
  });

  if (hasTag(out)) {
    out = stripMarkdownAttr(out, ctx);
    out = fixVoidTags(out, ctx);
    out = out.replace(/<!--([\s\S]*?)-->/g, (_m, body) => {
      ctx.state.counts.htmlComments += 1;
      return `{/*${body}*/}`;
    });
    return out;
  }

  return mapOutsideCode(out, escapeMdx);
}

/* ---------- block conversion ---------- */

const TERMY = /^\s*<div[^>]*class=["'][^"']*\btermy\b/;

/*
 * A transcript line's kind is what Termynal took from the prompt: `$` is a
 * command, `#` is a comment, anything else is output the command printed.
 */
function transcript(raw) {
  return raw.map((text) => {
    const command = text.match(/^\s*\$\s?(.*)$/);
    if (command) return { text: command[1], kind: 'command' };
    if (/^\s*#/.test(text)) return { text: text.trim(), kind: 'muted' };
    return { text, kind: 'output' };
  });
}

function collectTermy(lines, start) {
  let i = start + 1;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (i >= lines.length || !isFence(lines[i])) return [null, start];
  const fence = fenceToken(lines[i]);
  i += 1;
  const body = [];
  while (i < lines.length && !fenceToken(lines[i]).startsWith(fence)) {
    body.push(lines[i]);
    i += 1;
  }
  i += 1;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (i < lines.length && /^\s*<\/div>/.test(lines[i])) i += 1;
  return [transcript(trimBlank(body)), i];
}

const ADMONITION =
  /^(\s*)(!!!|\?\?\?\+?)\s+([a-z][a-z-]*)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*$/;
const TAB = /^(\s*)===\s*\+?\s*"([^"]*)"\s*$/;

function collectIndented(lines, i, indent) {
  const body = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      body.push('');
      i += 1;
      continue;
    }
    if (indentOf(line) < indent + 4) break;
    body.push(line);
    i += 1;
  }
  return [trimBlank(body), i];
}

function convertBlocks(lines, ctx) {
  const out = [];
  let i = 0;
  let fence = null;

  while (i < lines.length) {
    const line = lines[i];

    if (fence) {
      out.push(line);
      if (fenceToken(line).startsWith(fence)) fence = null;
      i += 1;
      continue;
    }

    if (isFence(line)) {
      fence = fenceToken(line);
      if (/^\s*(```+|~~~+)\s*mermaid/.test(line))
        ctx.state.counts.mermaidBlocks += 1;
      out.push(line);
      i += 1;
      continue;
    }

    /* MDX has no HTML comment: `<!--` is a parse error, not a comment, so one
     * has to become a JSX expression comment before anything else reads it. */
    if (line.includes('<!--')) {
      const body = [];
      let j = i;
      while (j < lines.length) {
        body.push(lines[j]);
        if (lines[j].includes('-->')) break;
        j += 1;
      }
      ctx.state.counts.htmlComments += 1;
      const inner = body
        .join('\n')
        .replace(/<!--/, '')
        .replace(/-->(?![\s\S]*-->)/, '')
        .replace(/\*\//g, '*​/');
      out.push(`{/*${inner}*/}`);
      i = j + 1;
      continue;
    }

    /*
     * Termynal is driven by a `.termy` wrapper around a fenced block, not by
     * the fence language, so that wrapper is what identifies a terminal rather
     * than ```console on its own.
     */
    if (TERMY.test(line)) {
      const [block, next] = collectTermy(lines, i);
      if (block) {
        ctx.state.counts.terminals += 1;
        ctx.needs.terminal = true;
        out.push('');
        out.push('<AsciiTerminal');
        out.push(`  lines={${JSON.stringify(block)}}`);
        out.push('/>');
        out.push('');
        i = next;
        continue;
      }
    }

    const adm = line.match(ADMONITION);
    if (adm) {
      const [, indent, marker, type, dq, sq] = adm;
      const title = dq ?? sq ?? null;
      const [body, next] = collectIndented(lines, i + 1, indent.length);
      const kind = ASIDE[type];
      ctx.state.counts.admonitions += 1;
      if (marker.startsWith('???'))
        ctx.state.counts.collapsibleAdmonitions += 1;
      if (!kind) {
        ctx.handPass.add(`unknown admonition type "${type}"`);
      }
      if (BLOCKQUOTE_PREFERRED.has(type)) {
        ctx.handPass.add(
          `"${type}" admonition kept as a note aside; the migration table prefers a blockquote`,
        );
      }
      const aside = kind ?? 'note';
      out.push('');
      out.push(title ? `:::${aside}[${title}]` : `:::${aside}`);
      out.push(...convertBlocks(dedent(body, indent.length + 4), ctx));
      out.push(':::');
      out.push('');
      i = next;
      continue;
    }

    const tab = line.match(TAB);
    if (tab) {
      const indent = tab[1].length;
      const items = [];
      let j = i;
      while (j < lines.length) {
        const m = lines[j].match(TAB);
        if (!m || m[1].length !== indent) break;
        const [body, next] = collectIndented(lines, j + 1, indent);
        items.push([m[2], dedent(body, indent + 4)]);
        j = next;
        while (
          j < lines.length &&
          lines[j].trim() === '' &&
          lines[j + 1] &&
          TAB.test(lines[j + 1])
        )
          j += 1;
      }
      ctx.state.counts.tabGroups += 1;
      ctx.state.counts.tabItems += items.length;
      ctx.needs.tabs = true;
      out.push('');
      out.push('<Tabs>');
      for (const [label, body] of items) {
        out.push(`<TabItem label=${JSON.stringify(label)}>`);
        out.push('');
        out.push(...convertBlocks(body, ctx));
        out.push('');
        out.push('</TabItem>');
      }
      out.push('</Tabs>');
      out.push('');
      i = j;
      continue;
    }

    out.push(inlineTransform(line, ctx));
    i += 1;
  }

  return out;
}

/* ---------- front matter ---------- */

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return [null, text];
  const end = text.indexOf('\n---', 4);
  if (end === -1) return [null, text];
  return [text.slice(4, end), text.slice(end + 4).replace(/^\n/, '')];
}

const plain = (s) =>
  s
    .replace(/:material-[a-z0-9-]+:/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function extractTitle(lines, relPath, state) {
  const idx = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (idx === -1) {
    state.missingTitle.push(relPath);
    const base = relPath.replace(/\.md$/, '').split('/').pop();
    /* Title case, so a derived title reads like the nav label beside it. */
    const derived = base
      .split(/[-_]/)
      .map((w) => w.replace(/^\w/, (c) => c.toUpperCase()))
      .join(' ');
    return [derived, lines];
  }
  const title = plain(lines[idx].replace(/^#\s+/, ''));
  const rest = [...lines.slice(0, idx), ...lines.slice(idx + 1)];
  return [title, rest];
}

/*
 * The lead paragraph, which is what MkDocs Material showed under the title in
 * search results. Anything that is structure rather than prose — a fence, an
 * admonition and its indented body, a list, a table, raw HTML — is skipped
 * rather than sampled, or the description ends up quoting markup.
 */
function extractDescription(lines) {
  let fence = null;
  let skipIndentUntilOutdent = false;
  const buf = [];
  for (const line of lines) {
    if (fence) {
      if (fenceToken(line).startsWith(fence)) fence = null;
      continue;
    }
    if (isFence(line)) {
      fence = fenceToken(line);
      continue;
    }
    const t = line.trim();
    if (skipIndentUntilOutdent) {
      if (t === '' || indentOf(line) >= 4) continue;
      skipIndentUntilOutdent = false;
    }
    if (buf.length === 0) {
      if (ADMONITION.test(line) || TAB.test(line)) {
        skipIndentUntilOutdent = true;
        continue;
      }
      if (t === '' || indentOf(line) >= 4) continue;
      if (t.startsWith('#') || t.startsWith('<') || t.startsWith('|')) continue;
      if (/^([-*+]|\d+[.)])\s/.test(t)) continue;
      buf.push(t.replace(/^>\s?/, ''));
      continue;
    }
    if (t === '') break;
    buf.push(t.replace(/^>\s?/, ''));
  }
  if (buf.length === 0) return '';
  let text = plain(buf.join(' '));
  if (text.length > 160) {
    text = text.slice(0, 160);
    text = `${text.slice(0, text.lastIndexOf(' '))}…`;
  }
  return text;
}

/* ---------- page ---------- */

/**
 * Convert one MkDocs page.
 *
 * @param raw      the page source, front matter and all
 * @param relPath  its path relative to `docs_dir`, e.g. `how-to/build.md`
 * @param options  `{ state, icons, base }`; `base` is the site base path
 * @returns `{ text, images, handPass, title, description }` — `images` are
 *          paths relative to `docs_dir` the page links to.
 * @throws  {SnippetError} on a pymdownx `--8<--` snippet, which has no
 *          mechanical equivalent and must not be dropped silently.
 */
export function convertPage(raw, relPath, options) {
  const { state, icons = {}, base = '' } = options;
  if (raw.includes('--8<--')) {
    throw new SnippetError(
      `${relPath}: pymdownx snippet (--8<--) found; no conversion exists for it.`,
    );
  }

  const [, body] = stripFrontmatter(raw);
  const ctx = {
    relPath,
    routeDir: routeDirFor(relPath),
    needs: {},
    images: new Set(),
    handPass: new Set(),
    icons,
    base: normaliseBase(base),
    state,
  };

  let lines = body.split('\n');
  const [title, withoutTitle] = extractTitle(lines, relPath, state);
  const description = extractDescription(withoutTitle);
  lines = convertBlocks(withoutTitle, ctx);

  const htmlBlocks = lines.filter((l) =>
    /^\s*<(div|section|aside|figure|canvas|header|table)\b/.test(l),
  ).length;
  state.counts.rawHtmlBlocks += htmlBlocks;
  if (htmlBlocks > 0)
    ctx.handPass.add(`${htmlBlocks} raw HTML block(s) kept verbatim`);
  const charts = lines.filter((l) =>
    /data-chart-config|Plotly\./.test(l),
  ).length;
  state.counts.charts += charts;
  if (charts > 0)
    ctx.handPass.add(
      `${charts} Chart.js canvas element(s) to rebuild as islands`,
    );

  const imports = [];
  if (ctx.needs.tabs)
    imports.push(
      "import { Tabs, TabItem } from '@astrojs/starlight/components';",
    );
  if (ctx.needs.icon)
    imports.push("import Icon from '@ambiqai/helia-ui/astro/Icon';");
  if (ctx.needs.terminal)
    imports.push(
      "import AsciiTerminal from '@ambiqai/helia-ui/astro/AsciiTerminal';",
    );

  const fm = ['---', `title: ${JSON.stringify(title)}`];
  if (description) fm.push(`description: ${JSON.stringify(description)}`);
  fm.push('---', '');

  const text = `${[
    ...fm,
    ...imports,
    imports.length ? '' : null,
    ...trimBlank(lines),
    '',
  ]
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')}`;

  state.counts.pages += 1;

  return {
    text: text.endsWith('\n') ? text : `${text}\n`,
    images: [...ctx.images],
    handPass: [...ctx.handPass],
    title,
    description,
  };
}

/* ---------- mkdocs nav ---------- */

/*
 * Enough YAML for a `nav:` block and nothing else. MkDocs nav is a list of
 * scalars, single-pair maps and nested lists, which is a small enough grammar
 * to read by indentation; a general YAML parser would be a dependency, and
 * this tool runs from a product repository with nothing installed.
 *
 * Anything outside that subset is reported rather than guessed at.
 */
export function parseNav(yamlText) {
  const lines = yamlText.split('\n');
  const start = lines.findIndex((l) => /^nav:\s*$/.test(l));
  if (start === -1) return [];

  const block = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    if (/^\S/.test(line)) break;
    block.push(line);
  }

  const strip = (s) => s.trim().replace(/^["']|["']$/g, '');

  /* Items at `indent`, consumed from `i` until the list outdents. */
  const read = (i, indent) => {
    const items = [];
    while (i < block.length) {
      const line = block[i];
      const at = indentOf(line);
      if (at < indent || !/^\s*-\s/.test(line)) break;
      if (at > indent) {
        i += 1;
        continue;
      }
      const rest = line.slice(at + 2);
      const pair = rest.match(/^(.*?):\s*(.*)$/);
      if (!pair) {
        items.push({ label: null, path: strip(rest) });
        i += 1;
        continue;
      }
      const label = strip(pair[1]);
      const value = strip(pair[2]);
      if (value) {
        items.push({ label, path: value });
        i += 1;
        continue;
      }
      /* `- Label:` opens a nested list one level in. */
      let j = i + 1;
      let childIndent = null;
      while (j < block.length) {
        const childAt = indentOf(block[j]);
        if (childAt <= at) break;
        if (/^\s*-\s/.test(block[j])) {
          childIndent = childAt;
          break;
        }
        j += 1;
      }
      if (childIndent === null) {
        items.push({ label, path: null, items: [] });
        i = j;
        continue;
      }
      const [children, next] = read(j, childIndent);
      items.push({ label, items: children });
      i = next;
    }
    return [items, i];
  };

  return read(0, indentOf(block[0] ?? ''))[0];
}

/**
 * A nav path (`how-to/build.md`) as the slug Starlight routes it at. A nav
 * entry may also name a directory (`api/`), which MkDocs served from its index
 * and Starlight routes at the directory slug.
 */
export function slugFor(path) {
  return routeDirFor(path.replace(/^\.\//, '').replace(/\/+$/, ''));
}

const titleCase = (s) =>
  s
    .split(/[-_]/)
    .map((w) => w.replace(/^\w/, (c) => c.toUpperCase()))
    .join(' ');

/**
 * The mkdocs nav as a Starlight sidebar array: groups keep their label and
 * nesting, pages become `slug` entries, and the site root is the empty slug.
 * Slugs carry no base path — Starlight applies the site's.
 *
 * @param titles path-to-title map for the nav entries MkDocs labeled from the
 *               page's own H1 rather than from the nav.
 */
export function buildSidebar(nav, titles = {}) {
  const entry = (item) => {
    if (item.items)
      return { label: item.label ?? '', items: item.items.map(entry) };
    const slug = slugFor(item.path);
    const label =
      item.label ??
      titles[item.path] ??
      titleCase(
        item.path.replace(/\.md$/, '').replace(/\/+$/, '').split('/').pop(),
      );
    return { label, slug };
  };
  return nav.filter((item) => item.items || item.path).map(entry);
}

/** Every page path the nav names, in nav order, deduplicated. */
export function navPaths(nav) {
  const out = [];
  const walk = (items) => {
    for (const item of items) {
      if (item.items) walk(item.items);
      else if (
        item.path &&
        item.path.endsWith('.md') &&
        !out.includes(item.path)
      )
        out.push(item.path);
    }
  };
  walk(nav);
  return out;
}
