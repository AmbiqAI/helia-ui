// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Search-engine and agent discoverability for a HELIA Starlight site.
 *
 * Two halves. The per-page tags are emitted in the head override, because only
 * a component knows which route is rendering; everything site-wide is written
 * here, from an integration that runs once after the build.
 *
 * The site-wide half reads the content collection's source files off disk
 * rather than through `astro:content`. An integration hook has no collection
 * API, and the renditions have to be the authored markdown rather than the
 * rendered HTML read backwards, so the source is the only input that can give
 * a byte-stable answer. The one thing source cannot see is a value a component
 * was handed: those come back from the rendition sidecars each part writes
 * into the built page, which is markdown a part stated rather than markup read
 * backwards. Everything below is a pure function of the file tree, the
 * sidebar and those sidecars, so two runs on one commit produce identical
 * bytes.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroConfig, AstroIntegration } from 'astro';
import type { RenditionKind } from '../rendition.ts';
import {
  RENDITION_ATTRIBUTE,
  codeFence,
  escapeMarkup,
  inlineLink,
  linkItem,
  linkTarget,
  linkText,
  stripBlockControl,
  stripControl,
  unescapeRendition,
} from '../rendition.ts';

export interface HeliaDiscoverabilityOptions {
  /** Per-page Open Graph image, generated at build. Default `true`. */
  ogImage?: boolean;
  /** WebSite, Organization, TechArticle and BreadcrumbList. Default `true`. */
  jsonLd?: boolean;
  /** `<route>/index.md` renditions and the `alternate` link. Default `true`. */
  markdown?: boolean;
  /** `llms.txt`, `llms-full.txt` and `content-index.json`. Default `true`. */
  llms?: boolean;
}

export interface ResolvedDiscoverability {
  ogImage: boolean;
  jsonLd: boolean;
  markdown: boolean;
  llms: boolean;
}

export function resolveDiscoverability(
  options: HeliaDiscoverabilityOptions | false | undefined,
): ResolvedDiscoverability {
  if (options === false) {
    return { ogImage: false, jsonLd: false, markdown: false, llms: false };
  }
  const {
    ogImage = true,
    jsonLd = true,
    markdown = true,
    llms = true,
  } = options ?? {};
  return { ogImage, jsonLd, markdown, llms };
}

/** A sidebar entry as Starlight hands it back from `config:setup`. */
interface SidebarItem {
  label?: string;
  slug?: string;
  link?: string;
  items?: SidebarItem[];
  autogenerate?: { directory?: string; collapsed?: boolean };
  collapsed?: boolean;
}

interface PageRecord {
  slug: string;
  route: string;
  url: string;
  title: string;
  description: string | undefined;
  headings: string[];
  sourcePath: string;
  lastModified: string | null;
  body: string;
  /** The sidebar trail down to the page, or `null` if the sidebar omits it. */
  sections: string[] | null;
  /** What the built page's own parts stated, in document order. */
  sidecars: readonly RenditionSidecar[];
}

const CONTENT_EXTENSIONS = ['.md', '.mdx', '.markdown'];

const toPosix = (value: string) => value.split(sep).join('/');

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * JSON for a `<script>` body.
 *
 * An HTML parser looks for the end of a script element in its text, so a page
 * description holding `</script>` would end the block and leave the rest of
 * the page's own frontmatter to be parsed as markup. `<`, `>` and `&` have a
 * JSON escape that no parser can mistake, and the value they carry is
 * unchanged for anything reading the JSON. See AmbiqAI/helia-ui#136.
 */
export const serializeJsonLd = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

/* ------------------------------------------------------------------ *
 * Frontmatter
 * ------------------------------------------------------------------ */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

const unquote = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  if ((first === '"' || first === "'") && trimmed.endsWith(first)) {
    const inner = trimmed.slice(1, -1);
    return first === '"'
      ? inner.replace(/\\"/g, '"')
      : inner.replace(/''/g, "'");
  }
  return trimmed;
};

/*
 * Only the top-level scalars, and only the handful of keys this file reads.
 * A YAML parser is not a dependency the package carries, and a nested block --
 * `hero`, `sidebar`, `head` -- is skipped rather than represented, because an
 * indented line is never a key this needs.
 */
function readFrontmatter(source: string): {
  data: Record<string, string | boolean>;
  body: string;
} {
  const match = FRONTMATTER.exec(source);
  if (!match) return { data: {}, body: source };

  const lines = match[1]!.split(/\r?\n/);
  const data: Record<string, string | boolean> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const entry = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
    if (!entry) continue;

    const key = entry[1]!;
    const raw = entry[2]!.trim();

    // A block scalar carries its value on the indented lines that follow it.
    if (raw === '|' || raw === '>' || raw === '|-' || raw === '>-') {
      const folded = raw.startsWith('>');
      const collected: string[] = [];
      while (
        index + 1 < lines.length &&
        /^(?:[ \t]+\S|[ \t]*$)/.test(lines[index + 1]!)
      ) {
        index += 1;
        collected.push(lines[index]!.trim());
      }
      data[key] = folded
        ? collected.join(' ').replace(/\s+/g, ' ').trim()
        : collected.join('\n').trim();
      continue;
    }

    if (raw === '') continue;
    if (raw === 'true' || raw === 'false') {
      data[key] = raw === 'true';
      continue;
    }
    data[key] = unquote(raw);
  }

  return { data, body: source.slice(match[0].length) };
}

/* ------------------------------------------------------------------ *
 * Markdown rendition
 * ------------------------------------------------------------------ */

const FENCE = /^([ \t]{0,3})(`{3,}|~{3,})(.*)$/;

/** Splits a document into fenced-code and prose runs, in source order. */
function splitFences(body: string): { code: boolean; text: string }[] {
  const lines = body.split('\n');
  const segments: { code: boolean; text: string }[] = [];
  let buffer: string[] = [];
  let fence: string | null = null;

  const flush = (code: boolean) => {
    if (buffer.length > 0) segments.push({ code, text: buffer.join('\n') });
    buffer = [];
  };

  for (const line of lines) {
    const match = FENCE.exec(line);
    if (fence === null) {
      if (match) {
        flush(false);
        fence = match[2]!;
      }
      buffer.push(line);
      continue;
    }
    buffer.push(line);
    if (
      match &&
      match[2]!.startsWith(fence[0]!) &&
      match[2]!.length >= fence.length &&
      match[3]!.trim() === ''
    ) {
      flush(true);
      fence = null;
    }
  }
  flush(fence === null ? false : true);
  return segments;
}

const INLINE_CODE = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g;

/*
 * Inline code is the one place a brace, a tag or a comment is content rather
 * than syntax, so every transform below runs with those spans held out and put
 * back afterwards.
 */
function withoutInlineCode(
  text: string,
  transform: (masked: string) => string,
): string {
  const spans: string[] = [];
  const masked = text.replace(INLINE_CODE, (match) => {
    spans.push(match);
    return `\u0000${spans.length - 1}\u0000`;
  });
  return transform(masked).replace(
    /\u0000(\d+)\u0000/g,
    (_, index: string) => spans[Number(index)]!,
  );
}

const MDX_COMMENT = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g;

/**
 * Drops MDX comments.
 *
 * A comment renders nothing, so a rendition carrying one states something the
 * page does not. It runs before everything else because a comment holds
 * whatever the author commented out -- tags, imports, a whole section -- and
 * none of that should reach a later pass as content.
 */
export function stripComments(text: string): string {
  return withoutInlineCode(text, (masked) => masked.replace(MDX_COMMENT, ''));
}

interface EsmScan {
  /** Open brackets of every kind, carried into the next line. */
  depth: number;
  /** Whether the line ended inside a template literal. */
  template: boolean;
}

/*
 * Bracket depth across one line of JavaScript.
 *
 * Quotes are consumed rather than counted, so a brace inside a string cannot
 * open a block. A template literal is skipped whole, interpolations included:
 * reading them would need a real parser, and skipping them keeps an unbalanced
 * brace inside a template from swallowing the rest of the file.
 */
function scanEsm(line: string, state: EsmScan): EsmScan {
  let { depth, template } = state;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (template) {
      if (char === '`') template = false;
      continue;
    }
    if (char === '`') {
      template = true;
      continue;
    }
    if (char === '"' || char === "'") {
      index += 1;
      while (index < line.length && line[index] !== char) {
        if (line[index] === '\\') index += 1;
        index += 1;
      }
      continue;
    }
    if (char === '/' && line[index + 1] === '/') break;
    if (char === '{' || char === '[' || char === '(') depth += 1;
    else if (char === '}' || char === ']' || char === ')') depth -= 1;
  }

  return { depth: Math.max(0, depth), template };
}

const IMPORT_LINE = /^\s*import\b/;
const IMPORT_BINDING = String.raw`(?:[A-Za-z_$][\w$]*|\*\s+as\s+[A-Za-z_$][\w$]*|\{[^}]*\})`;
/*
 * A whole import statement, as against a sentence that opens with the word.
 * The specifier is quoted and what stands in front of it is a binding rather
 * than a run of words, so a sentence about importing values out of a table is
 * read as the prose it is. The shape is spelled out in the fixtures, not
 * here: an example written as source in a comment is a specifier as far as
 * the boundary check is concerned.
 */
const IMPORT_WHOLE = new RegExp(
  String.raw`^\s*import\s*(?:['"][^'"]*['"]|(?:type\s+)?${IMPORT_BINDING}(?:\s*,\s*${IMPORT_BINDING})?\s+from\s*['"][^'"]*['"])\s*;?\s*$`,
);

/* The specifier of an import is the only quoted thing in it. */
const QUOTED = /['"]/;

const EXPORT_LINE = /^\s*export\b/;
/*
 * The shapes a real export statement takes: something is named and then
 * assigned, called, or given a body. A sentence that opens with the word names
 * nothing, and dropping one deletes the page's own prose -- and, where its
 * brackets do not balance, every line after it as well.
 */
const EXPORT_SHAPES = [
  /^\s*export\s+(?:async\s+)?(?:const|let|var|function|class|type|interface)\s+(?:[A-Za-z_$][\w$]*|\{[^}]*\}|\[[^\]]*\])\s*(?:[=({:<]|extends\b|implements\b)/,
  /^\s*export\s+default\s+(?:[{[]|(?:async\s+)?function\b|class\b|[A-Za-z_$][\w$]*\s*(?:\(|;?\s*$))/,
  /^\s*export\s*[{*]/,
];

/**
 * Drops the ESM at the top of an MDX file, statement by statement.
 *
 * A rendition is markdown for a reader that cannot resolve a module, so the
 * imports are noise and the tags they name are reduced separately. A statement
 * that opens a bracket carries the rest of itself on the lines that follow,
 * and those lines are JavaScript too: the depth is tracked from the opening
 * line through the closing `];` or `}` so that an `export const` publishes no
 * more of its body than an `import` does. See AmbiqAI/helia-ui#143.
 *
 * The unbracketed continuation -- an assignment broken across lines with no
 * bracket to close -- is not tracked, because nothing distinguishes its second
 * line from prose. Inline code is held out first: a prop carrying a code
 * sample holds whole statements of someone else's JavaScript, and none of it
 * is this file's ESM.
 */
export function stripEsm(text: string): string {
  return withoutInlineCode(text, (masked) => {
    const kept: string[] = [];
    /* The lines of a statement that has not finished. Nothing is dropped
       until the whole of it is in hand and reads as a statement; a run that
       ends with one still open never held a statement, and its lines go back
       rather than being dropped on a guess that would take the rest of the
       page with them. */
    let pending: string[] = [];
    /* What the open statement is waiting for: a module specifier, or the
       bracket that closes a body. */
    let open: { waits: 'specifier' | 'brackets'; scan: EsmScan } | null = null;

    const settle = (dropped: boolean) => {
      if (!dropped) kept.push(...pending);
      open = null;
      pending = [];
    };

    for (const line of masked.split('\n')) {
      if (open) {
        pending.push(line);
        /* An import ends at its specifier, which is the only quoted thing in
           it, rather than at a bracket: the `from` clause may sit on a line
           of its own, past the brace that closed the bindings. Until then
           there is nothing to judge the statement on. */
        if (open.waits === 'specifier') {
          if (QUOTED.test(line)) settle(IMPORT_WHOLE.test(pending.join('\n')));
          continue;
        }
        open.scan = scanEsm(line, open.scan);
        if (open.scan.depth === 0 && !open.scan.template) settle(true);
        continue;
      }

      const isImport = IMPORT_LINE.test(line);
      const isExport =
        EXPORT_LINE.test(line) &&
        EXPORT_SHAPES.some((shape) => shape.test(line));
      if (!isImport && !isExport) {
        kept.push(line);
        continue;
      }

      const scanned = scanEsm(line, { depth: 0, template: false });
      const unfinished = scanned.depth > 0 || scanned.template;

      if (isImport) {
        if (IMPORT_WHOLE.test(line)) continue;
        /* A statement that is going to continue has an open brace or a comma
           waiting for the next binding. Anything else that opens with the
           word is a sentence. */
        if (!unfinished && !/,\s*$/.test(line)) {
          kept.push(line);
          continue;
        }
        open = { waits: 'specifier', scan: scanned };
        pending = [line];
        continue;
      }

      if (unfinished) {
        open = { waits: 'brackets', scan: scanned };
        pending = [line];
      }
    }

    return [...kept, ...pending].join('\n');
  });
}

/**
 * The index of the brace closing the group that opens at `start`, or `-1`.
 *
 * Quoted and template spans are consumed rather than counted, the way a line
 * of ESM is: the brace in `{items.join('} ')}` is a character in a string and
 * neither closes the expression nor opens one.
 */
function closingBrace(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      index += 1;
      while (index < text.length && text[index] !== char) {
        if (text[index] === '\\') index += 1;
        index += 1;
      }
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Drops MDX expressions.
 *
 * What `{count}` renders is whatever the page's scope makes of it, and a
 * rendition is read without that scope. The source of the expression is not
 * its value, so publishing it would state something the page never said; the
 * value is a documented loss. Runs after the tags are reduced, so the braces
 * left by then are the page's own and not a component's props. An unbalanced
 * brace is left alone, as is a brace inside inline code or escaped as `\{`.
 */
export function stripExpressions(text: string): string {
  return withoutInlineCode(text, (masked) => {
    let out = '';
    let index = 0;

    while (index < masked.length) {
      const char = masked[index]!;
      if (char === '\\') {
        out += masked.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (char !== '{') {
        out += char;
        index += 1;
        continue;
      }
      const end = closingBrace(masked, index);
      if (end === -1) {
        out += masked.slice(index);
        break;
      }
      index = end + 1;
    }

    return out;
  });
}

/*
 * A tag, including the wrapped and the expression-bearing forms MDX allows. An
 * attribute value is read as a whole -- a quoted string, or a braced expression
 * one level deep -- rather than as "anything but a bracket", because a prop
 * carrying a code sample holds the brackets of its own markup and a naive scan
 * stops at the first of them, leaving the component's children on the page.
 */
const braces = (depth: number): string =>
  depth === 0
    ? String.raw`\{[^{}]*\}`
    : String.raw`\{(?:[^{}]|${braces(depth - 1)})*\}`;

/* Three levels reach `items={[{ ... }]}`, the deepest prop the parts take. */
const ATTRIBUTE = String.raw`(?:"[^"]*"|'[^']*'|${braces(3)}|[^<>"'{}])`;
const TAG = new RegExp(
  String.raw`</?[A-Za-z][A-Za-z0-9.:-]*(?:\s${ATTRIBUTE}*?)?/?>`,
  'g',
);

const TAG_NAME = /^<\/?([A-Za-z][A-Za-z0-9.:-]*)/;
const ATTRIBUTE_PAIR = new RegExp(
  String.raw`([A-Za-z_$][\w$.:-]*)(?:\s*=\s*("[^"]*"|'[^']*'|${braces(3)}))?`,
  'g',
);

/** HTML elements with no closing tag, which must not open a nesting level. */
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

interface Attribute {
  /** The value when it is a string literal, `null` when it is an expression. */
  text: string | null;
  /** The value as authored, braces included. */
  raw: string;
}

/*
 * A prop is a string literal or an expression. `title="x"` and `title={"x"}`
 * are the same string and are read as one; anything else is an expression
 * whose value this pass cannot know, and is carried as raw source for the few
 * renderers that read the source rather than the value.
 */
function attributeOf(raw: string): Attribute {
  const value = raw.trim();
  if (value.startsWith('"') || value.startsWith("'")) {
    return { text: value.slice(1, -1), raw: value };
  }
  const inner = value.slice(1, -1).trim();
  const quoted =
    (inner.startsWith('"') && inner.endsWith('"')) ||
    (inner.startsWith("'") && inner.endsWith("'"));
  return { text: quoted ? inner.slice(1, -1) : null, raw: value };
}

function attributesOf(tag: string): Record<string, Attribute> {
  const inner = tag.replace(TAG_NAME, '').replace(/\/?>$/, '');
  const attributes: Record<string, Attribute> = {};

  for (const [, name, raw] of inner.matchAll(ATTRIBUTE_PAIR)) {
    attributes[name!] =
      raw === undefined ? { text: null, raw: '' } : attributeOf(raw);
  }

  return attributes;
}

interface ElementNode {
  type: 'element';
  name: string;
  attributes: Record<string, Attribute>;
  children: TagNode[];
}

interface TextNode {
  type: 'text';
  value: string;
}

type TagNode = ElementNode | TextNode;

/*
 * The tags and the text between them as a tree.
 *
 * A rendition is built one prose run at a time, and a fenced code block splits
 * a run, so an element whose children hold a fence arrives here with its
 * closing tag in another run. An unclosed element therefore takes the rest of
 * the run as its children, and a closing tag that matches nothing is dropped.
 */
function parseTags(text: string): TagNode[] {
  const root: ElementNode = {
    type: 'element',
    name: '',
    attributes: {},
    children: [],
  };
  const stack: ElementNode[] = [root];
  let index = 0;

  for (const match of text.matchAll(TAG)) {
    const tag = match[0];
    const open = stack.at(-1)!;
    if (match.index > index) {
      open.children.push({
        type: 'text',
        value: text.slice(index, match.index),
      });
    }
    index = match.index + tag.length;

    const name = TAG_NAME.exec(tag)?.[1] ?? '';
    if (tag.startsWith('</')) {
      const at = stack.findLastIndex((node) => node.name === name);
      if (at > 0) stack.length = at;
      continue;
    }

    const element: ElementNode = {
      type: 'element',
      name,
      attributes: attributesOf(tag),
      children: [],
    };
    open.children.push(element);
    if (!tag.endsWith('/>') && !VOID_TAGS.has(name.toLowerCase())) {
      stack.push(element);
    }
  }

  if (index < text.length) {
    stack.at(-1)!.children.push({ type: 'text', value: text.slice(index) });
  }

  return root.children;
}

const TRANSCRIPT_ENTRY = /\{([^{}]*)\}/g;
const ENTRY_TEXT = /\btext\s*:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/;
const ENTRY_KIND = /\bkind\s*:\s*(?:'([^']*)'|"([^"]*)")/;
const ENTRY_PROMPT = /\bprompt\s*:\s*(?:'([^']*)'|"([^"]*)")/;

const unquoteJs = (value: string): string =>
  value
    .slice(1, -1)
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\(['"\\])/g, '$1');

/*
 * `lines={[{ kind: 'command', text: 'npm run build' }]}` read back as the
 * transcript it renders, prompts included. Only the inline literal form: a
 * transcript imported from a module is not in this file, so there is nothing
 * to render and the component reduces to its children like any other.
 */
function transcriptOf(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const entries = [...raw.matchAll(TRANSCRIPT_ENTRY)];
  if (entries.length === 0) return null;

  const lines: string[] = [];
  for (const [, body] of entries) {
    const quoted = ENTRY_TEXT.exec(body!)?.[1];
    if (quoted === undefined) return null;
    const kindMatch = ENTRY_KIND.exec(body!);
    const kind = kindMatch?.[1] ?? kindMatch?.[2];
    const promptMatch = ENTRY_PROMPT.exec(body!);
    const prompt = promptMatch?.[1] ?? promptMatch?.[2] ?? '$';
    const value = unquoteJs(quoted);
    lines.push(
      kind === 'command' && prompt !== '' ? `${prompt} ${value}` : value,
    );
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Rendition sidecars
 * ------------------------------------------------------------------ */

/** One part's own Markdown, as it stated it in the built HTML. */
export interface RenditionSidecar {
  kind: RenditionKind;
  markdown: string;
}

const SIDECAR = new RegExp(
  String.raw`<script\b[^>]*\b${RENDITION_ATTRIBUTE}="([^"]*)"[^>]*>([\s\S]*?)</script>`,
  'gi',
);

/* The element Starlight wraps the rendered content in, matched as an element
   rather than as a run of characters: the class name is also in the stylesheet
   the page inlines in its head, which comes first and is not the content. */
const CONTENT_ELEMENT =
  /<([a-zA-Z][\w-]*)\b[^>]*\bclass="[^"]*\bsl-markdown-content\b[^"]*"[^>]*>/;

/*
 * The region of a page that is the page.
 *
 * A part the layout renders -- a header's button, a card in the footer -- is
 * not content the source pass was ever going to see, and reading one back
 * would leave the page with a sidecar more than its source has occurrences and
 * so turn the splice off for that kind. The region therefore ends where the
 * content element does, and `</main>` stands in if the depth walk runs past it.
 */
function contentRegion(html: string): string {
  const open = CONTENT_ELEMENT.exec(html);
  if (!open) return html;

  const start = open.index + open[0].length;
  const nested = new RegExp(`<(/?)${open[1]!}\\b`, 'gi');
  nested.lastIndex = start;

  let depth = 1;
  let end = html.length;
  let tag = nested.exec(html);
  while (tag !== null) {
    depth += tag[1] === '/' ? -1 : 1;
    if (depth === 0) {
      end = tag.index;
      break;
    }
    tag = nested.exec(html);
  }

  const main = html.indexOf('</main>', start);
  return html.slice(start, main === -1 ? end : Math.min(end, main));
}

/** The sidecars a built page carries, in document order. */
export function collectSidecars(html: string): RenditionSidecar[] {
  return [...contentRegion(html).matchAll(SIDECAR)].map(([, kind, body]) => ({
    kind: kind as RenditionKind,
    /* A control character reaches a prop from whatever produced the data
       behind it, and NUL is what the reduction masks inline code with. */
    markdown: stripBlockControl(unescapeRendition(body!)).trim(),
  }));
}

/**
 * What the source pass hands each component occurrence, in source order.
 *
 * A kind is spliced only when the page rendered exactly as many sidecars of it
 * as the source has occurrences, because the sequence the two agree on is the
 * only thing that anchors one to the other: a card grid built by mapping over
 * a model is one tag in the source and ten cards on the page, and splicing
 * those in order would file the first card's line under the wrong heading.
 * Where they disagree the source-derived form stands, which loses nothing that
 * was not already lost. See AmbiqAI/helia-ui#167.
 */
export interface SidecarCursor {
  /** The next sidecar of this kind, or `null` to keep the source form. */
  take(kind: RenditionKind): string | null;
  /** How many occurrences of each kind the source pass has reached. */
  counts: Map<RenditionKind, number>;
  /** Tag names the page imported from somewhere other than this package. */
  foreign: ReadonlySet<string>;
}

export function createSidecarCursor(
  sidecars: readonly RenditionSidecar[],
  foreign: ReadonlySet<string> = new Set(),
): SidecarCursor {
  const queues = new Map<RenditionKind, string[]>();
  const counts = new Map<RenditionKind, number>();
  for (const sidecar of sidecars) {
    const queue = queues.get(sidecar.kind);
    if (queue) queue.push(sidecar.markdown);
    else queues.set(sidecar.kind, [sidecar.markdown]);
  }

  return {
    counts,
    foreign,
    take(kind) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      const next = queues.get(kind)?.shift();
      return next === undefined || next === '' ? null : next;
    },
  };
}

const PACKAGE_SPECIFIER = /^@ambiqai\/helia-ui(?:\/|$)/;
const IMPORT_BINDINGS =
  /\bimport\s+(?!type\b)([^;'"]+?)\s+from\s*['"]([^'"]+)['"]/g;

/**
 * The tag names a page bound to something other than one of these parts.
 *
 * `LinkCard` is Starlight's name as well as this package's, and the imports
 * are stripped before the tags are read, so without this a page writing
 * Starlight's card would have its own components counted as occurrences of a
 * part that states nothing, and the count guard would turn the splice off for
 * the whole page. Read off the body before anything is stripped from it.
 */
export function foreignBindings(body: string): Set<string> {
  const names = new Set<string>();
  for (const [, clause, specifier] of body.matchAll(IMPORT_BINDINGS)) {
    if (PACKAGE_SPECIFIER.test(specifier!)) continue;
    for (const binding of clause!.replace(/[{}]/g, ' ').split(',')) {
      const name = binding
        .trim()
        .split(/\s+as\s+|\s+/)
        .pop();
      if (name && /^[A-Z]/.test(name)) names.add(name);
    }
  }
  return names;
}

/** What an element reduced to, and how the text around it must be joined. */
interface Reduction {
  /** `item` is one line of a list; `block` stands alone; `inline` is prose. */
  kind: 'inline' | 'item' | 'block';
  text: string;
}

const literal = (node: ElementNode, name: string): string | undefined =>
  node.attributes[name]?.text ?? undefined;

/*
 * A card's title is a heading in the package's own markup -- `LinkCard`
 * defaults to `h3` -- so it is one here too, rather than a level derived from
 * where the card happens to sit.
 */
const CARD_HEADING = '###';

/*
 * The parts that state their own rendition, and the source shape that stands
 * for each one. A component is asked for a sidecar only where it renders one,
 * so the source sequence and the page's stay in step.
 */
function sidecarKind(
  node: ElementNode,
  cursor: SidecarCursor | null,
): RenditionKind | null {
  if (cursor !== null && cursor.foreign.has(node.name)) return null;
  /* `rendition={false}` is a part telling the page that something around it
     states the whole card, so the header renders no block of its own. */
  const stating = node.attributes['rendition'];
  if (
    stating !== undefined &&
    !/^(?:\{true\}|["']?true["']?)$/.test(stating.raw.trim())
  ) {
    return null;
  }
  if (node.name === 'AsciiTerminal') return 'terminal';
  if (node.name === 'LinkCard') return 'link-card';
  const linked = node.attributes['href'] !== undefined;
  if (node.name === 'CardHeader' && linked) return 'card';
  if (node.name === 'Button' && linked) return 'button';
  return null;
}

/* The parts whose label is their children rather than a `title` prop. A
   link-bearing one of these is a link, and reducing it to its children alone
   left a page's whole set of calls to action as prose. See
   AmbiqAI/helia-ui#156. */
const LABELED_BY_CHILDREN = new Set([
  'Button',
  'Card',
  'CardHeader',
  'LinkCard',
]);

function reduceElement(
  node: ElementNode,
  cursor: SidecarCursor | null,
): Reduction {
  const children = reduceNodes(node.children, true, cursor);
  const kind = sidecarKind(node, cursor);
  const stated = kind === null ? null : (cursor?.take(kind) ?? null);

  if (node.name === 'AsciiTerminal') {
    if (stated !== null) return { kind: 'block', text: stated };
    const transcript = transcriptOf(node.attributes['lines']?.raw);
    if (transcript !== null) {
      return { kind: 'block', text: codeFence(transcript) };
    }
    return children;
  }

  if (stated !== null) {
    /* A button is a word in a sentence's place; a card is a line in a list. */
    return { kind: kind === 'button' ? 'inline' : 'item', text: stated };
  }

  const title = literal(node, 'title');
  const href = literal(node, 'href');
  /* A card's line is a prop as often as it is a child: Starlight's cards take
     `description`, the package's take the line as children. */
  const line = children.text.replace(/\s+/g, ' ').trim();
  const description = line === '' ? literal(node, 'description') : line;

  /* Whatever component carries both a name and a target is a link, whoever
     wrote it: the package's own parts, Starlight's, and a consuming site's
     alike. An element is not: `<a href title>` is already the link it makes,
     and `title` on it is a tooltip rather than the link's name. */
  if (/^[A-Z]/.test(node.name) && title !== undefined && href !== undefined) {
    /* The description here is a reduced run of the page's own markdown, links
       and code spans included, so only a tag opener is held in it. */
    const link = `- [${linkText(title)}](${linkTarget(href)})`;
    return {
      kind: 'item',
      text:
        description === undefined || description === ''
          ? link
          : `${link}: ${escapeMarkup(description)}`,
    };
  }

  /* A `title` prop that is an expression is a value this pass cannot have,
     and the children are the line rather than the name: only a part written
     with no title at all is named by what is inside it, and only where those
     children are text the source states outright. A label still carrying an
     expression is not a name: `{cta.label}` is dropped a pass later, and a
     link made of it would reach a reader as `[](href)`. */
  if (
    href !== undefined &&
    node.attributes['title'] === undefined &&
    LABELED_BY_CHILDREN.has(node.name) &&
    line !== '' &&
    !line.includes('{')
  ) {
    return node.name === 'Button'
      ? { kind: 'inline', text: inlineLink(line, href) }
      : { kind: 'item', text: linkItem(line, href) };
  }

  if (node.name === 'Card' && title !== undefined) {
    const body = children.text.trim();
    const heading = `${CARD_HEADING} ${stripControl(title)}`;
    return {
      kind: 'block',
      text: body === '' ? heading : `${heading}\n\n${body}`,
    };
  }

  /* A block diagram is its labels and their nesting, and both are props: the
     children of a Block are more Blocks, never text. Each block is a list
     item and the blocks inside it are indented under it, so the hierarchy the
     page draws is the hierarchy a reader of the rendition gets. */
  if (node.name === 'Block') {
    const label = literal(node, 'label');
    if (label === undefined) return children;
    const sublabel = literal(node, 'sublabel');
    const name = linkText(label);
    const head = href === undefined ? name : `[${name}](${linkTarget(href)})`;
    const line =
      sublabel === undefined
        ? `- ${head}`
        : `- ${head}: ${stripControl(sublabel)}`;
    const inner = children.text.trim();
    const nested = inner === '' ? '' : `\n${inner.replace(/^/gm, '  ')}`;
    return { kind: 'item', text: `${line}${nested}` };
  }

  if (node.name === 'BlockDiagram') {
    const caption = literal(node, 'caption');
    const lead = [title, caption]
      .filter((value): value is string => value !== undefined)
      .map((value) => stripControl(value))
      .join(': ');
    const body = children.text.trim();
    if (lead === '') return { kind: 'block', text: body };
    return { kind: 'block', text: body === '' ? lead : `${lead}\n\n${body}` };
  }

  return children;
}

/*
 * Children of an element are indented under it, and that indentation outlives
 * the tags: four spaces in front of a sentence is an indented code block in
 * plain markdown, so a card's title would reach a reader as code. A line
 * inside an element is therefore flattened to the margin.
 */
function reduceNodes(
  nodes: readonly TagNode[],
  inside: boolean,
  cursor: SidecarCursor | null,
): Reduction {
  let out = '';
  let last: 'none' | 'inline' | 'item' | 'block' = 'none';
  let standalone = false;

  for (const node of nodes) {
    if (node.type === 'text') {
      let value = node.value;
      if (inside) {
        value = value.replace(/\n[ \t]+/g, '\n');
        /* The line may have opened with a tag that is now gone, leaving its
           indentation in front of the first text of the line. */
        if (/(?:^|\n)[ \t]*$/.test(out)) value = value.replace(/^[ \t]+/, '');
      }
      if (value.trim() === '') {
        /* Between two blocks the whitespace is the authoring indentation and
           nothing else, so it goes with the tags it was laid out for. */
        if (last === 'none' || last === 'inline') out += value;
        continue;
      }
      if (last === 'item' || last === 'block') {
        out = `${out.replace(/\s+$/, '')}\n\n`;
      }
      out += value;
      last = 'inline';
      continue;
    }

    const reduced = reduceElement(node, cursor);
    if (reduced.text === '') continue;
    if (reduced.kind === 'inline') {
      out += reduced.text;
      last = 'inline';
      continue;
    }

    standalone = true;
    out = out.replace(/\s+$/, '');
    if (out !== '') {
      out += last === 'item' && reduced.kind === 'item' ? '\n' : '\n\n';
    }
    out += reduced.text;
    last = reduced.kind;
  }

  return { kind: standalone ? 'block' : 'inline', text: out };
}

/**
 * Reduces component and HTML tags to markdown.
 *
 * What a component renders is mostly its children, and dropping the tags is
 * the whole of it. What a card renders is its props: an attribute-only
 * `<LinkCard title href />` has no children at all, so stripping it publishes
 * nothing where the page shows a link and leaves a section index as a list of
 * orphan sentences. Anything carrying both a title and a target is
 * therefore emitted as a list item, and a titled `Card` as a heading over its
 * body. Nesting authored inside an element that renders as one of those goes
 * with it, which is the cheaper of the two losses.
 *
 * A prop whose value is an expression is a documented loss to this pass: its
 * value is the page's to compute and the source is all there is here. A part
 * that states its own rendition is handed back through `cursor`, which is what
 * recovers a transcript or a card built from a record. See AmbiqAI/helia-ui#143
 * and AmbiqAI/helia-ui#167.
 */
export function reduceTags(
  text: string,
  cursor: SidecarCursor | null = null,
): string {
  return withoutInlineCode(text, (masked) => {
    /* An attribute list wraps, and the tag with it. A wrapped tag folds back
       onto one line so that a value broken across lines -- a title written
       over two of them -- is one line of markdown and not two. */
    const folded = masked.replace(TAG, (tag) =>
      tag.includes('\n') ? tag.replace(/\s*\n\s*/g, ' ') : tag,
    );
    return reduceNodes(parseTags(folded), false, cursor).text;
  });
}

/**
 * Rewrites a link target onto the deployed site.
 *
 * A relative target resolves against the page's own URL, a root-relative one
 * against the origin -- which already carries the base path, because the site
 * is served under one -- and a bare fragment against the page. Anything with a
 * scheme is left exactly as authored.
 */
function absolutize(target: string, pageUrl: string, origin: string): string {
  const value = target.trim();
  if (value === '') return target;
  if (/^[a-zA-Z][\w+.-]*:/.test(value)) return target;
  if (value.startsWith('//')) return target;
  if (value.startsWith('#')) return `${pageUrl}${value}`;
  if (value.startsWith('/')) return new URL(value, origin).href;
  return new URL(value, pageUrl).href;
}

/* The pointy form is the one a target holding a parenthesis or a space is
   written in, and it still has to reach the deployed site. */
const INLINE_LINK = /(!?\[[^\]]*\]\()(<[^<>]*>|[^()\s]+)((?:\s+"[^"]*")?\))/g;
const REFERENCE_LINK = /^([ \t]{0,3}\[[^\]]+\]:[ \t]*)(\S+)(.*)$/gm;

function resolveLinks(text: string, pageUrl: string, origin: string): string {
  const spans: string[] = [];
  const masked = text.replace(INLINE_CODE, (match) => {
    spans.push(match);
    return `\u0000${spans.length - 1}\u0000`;
  });
  const linked = masked
    .replace(INLINE_LINK, (_, open: string, target: string, close: string) => {
      const pointy = target.startsWith('<') && target.endsWith('>');
      const value = pointy ? target.slice(1, -1) : target;
      const resolved = absolutize(value, pageUrl, origin);
      return `${open}${pointy ? `<${resolved}>` : resolved}${close}`;
    })
    .replace(
      REFERENCE_LINK,
      (_, open: string, target: string, rest: string) =>
        `${open}${absolutize(target, pageUrl, origin)}${rest}`,
    );
  return linked.replace(
    /\u0000(\d+)\u0000/g,
    (_, index: string) => spans[Number(index)]!,
  );
}

/** What a kind turning itself off on one route is worth saying. */
export interface SidecarSkip {
  kind: RenditionKind;
  /** Occurrences the source has. */
  source: number;
  /** Sidecars the built page carries. */
  page: number;
}

/**
 * The cursor for the splicing pass, once the two sequences are known to agree.
 *
 * The first pass counts what the source says rendered and hands nothing back;
 * a kind the page disagrees with about the count is dropped from the second,
 * so its components keep the form the source alone can prove. A kind that
 * drops out is reported rather than dropped quietly: a consumer whose page
 * lost its transcripts should hear it from the build and not from the
 * artifact.
 */
function spliceable(
  compose: (cursor: SidecarCursor | null) => string,
  sidecars: readonly RenditionSidecar[],
  foreign: ReadonlySet<string>,
  onSkipped?: (skip: SidecarSkip) => void,
): SidecarCursor | null {
  if (sidecars.length === 0) return null;

  const totals = new Map<RenditionKind, number>();
  for (const sidecar of sidecars) {
    totals.set(sidecar.kind, (totals.get(sidecar.kind) ?? 0) + 1);
  }

  const counted = createSidecarCursor([], foreign);
  compose(counted);

  const agreed = new Set<RenditionKind>();
  for (const [kind, page] of totals) {
    const source = counted.counts.get(kind) ?? 0;
    if (source === page) agreed.add(kind);
    else onSkipped?.({ kind, source, page });
  }

  return createSidecarCursor(
    sidecars.filter((sidecar) => agreed.has(sidecar.kind)),
    foreign,
  );
}

/**
 * The markdown rendition of one page: frontmatter gone, links resolved.
 *
 * `mdx` says whether a brace is syntax or a character. In an MDX page it opens
 * an expression and a comment renders nothing; in a plain markdown page both
 * are ordinary text, and dropping them would delete the page's own prose. It
 * defaults to `false`, the answer that changes nothing for a caller that does
 * not know; the plugin passes the page's own extension.
 */
export function renderMarkdown(
  body: string,
  options: {
    pageUrl: string;
    origin: string;
    title: string;
    mdx?: boolean;
    /** What the built page's parts stated, in document order. */
    sidecars?: readonly RenditionSidecar[];
    /** Told which kind turned itself off, and what the two counts were. */
    onSidecarSkipped?: (skip: SidecarSkip) => void;
  },
): string {
  const mdx = options.mdx ?? false;
  const compose = (cursor: SidecarCursor | null) =>
    splitFences(body)
      .map(({ code, text }) => {
        /* A fenced block is quoted, not authored: a page documenting MDX shows
           a comment and an expression as the syntax they are. */
        if (code) return text;
        const reduced = reduceTags(
          stripEsm(mdx ? stripComments(text) : text),
          cursor,
        );
        return resolveLinks(
          mdx ? stripExpressions(reduced) : reduced,
          options.pageUrl,
          options.origin,
        );
      })
      .join('\n');

  const sidecars = options.sidecars ?? [];
  const rendered = compose(
    spliceable(
      compose,
      sidecars,
      sidecars.length === 0 ? new Set<string>() : foreignBindings(body),
      options.onSidecarSkipped,
    ),
  );

  const trimmed = rendered
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const heading = `# ${options.title}`;
  const withHeading = trimmed.startsWith('# ')
    ? trimmed
    : `${heading}\n\n${trimmed}`;
  return `${withHeading}\n`;
}

/** ATX headings outside fenced code, in document order. */
function headingsOf(body: string): string[] {
  return splitFences(body)
    .filter(({ code }) => !code)
    .flatMap(({ text }) => text.split('\n'))
    .map((line) => /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => reduceTags(match[2]!).trim())
    .filter((heading) => heading !== '');
}

/* ------------------------------------------------------------------ *
 * Open Graph image
 * ------------------------------------------------------------------ */

/*
 * An SVG card rather than a PNG one. Rasterizing text needs a font rasterizer
 * -- satori plus resvg, or a headless browser -- and none of those is in the
 * package's tree; adding one to emit a social preview is not a trade the
 * package makes. Consumers that need a raster card can turn `ogImage` off and
 * supply their own through Starlight's `head` config. See AmbiqAI/helia-ui#62.
 */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/* The light token surface, stated literally: the card is served on its own and
   has no stylesheet to read custom properties from. */
const OG_PAPER = '#ffffff';
const OG_INK = '#111318';
const OG_HAIRLINE = '#dfe3e8';
const OG_BRAND = '#0047ba';

/** Roboto's average advance, close enough to break a headline in the right place. */
const OG_ADVANCE = 0.54;

function wrapHeadline(
  text: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (candidate.length * fontSize * OG_ADVANCE <= maxWidth || line === '') {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line !== '') lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    const last = lines[maxLines - 1]!;
    lines[maxLines - 1] = `${last.replace(/[\s.,;:]+$/, '')}…`;
  }
  return lines;
}

/** The Ambiq mark, re-wrapped as a nested `<svg>` so its own viewBox survives. */
function markup(logo: string, x: number, y: number, width: number): string {
  const viewBox = /viewBox="([^"]+)"/.exec(logo)?.[1] ?? '0 328 1280 366';
  const [, , boxWidth, boxHeight] = viewBox
    .split(/\s+/)
    .map(Number) as number[];
  const height = width * ((boxHeight ?? 366) / (boxWidth ?? 1280));
  const inner = logo
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  return `<svg x="${x}" y="${y}" width="${width}" height="${height.toFixed(2)}" viewBox="${viewBox}">${inner}</svg>`;
}

export function renderOgImage(options: {
  title: string;
  siteTitle: string;
  logo: string;
}): string {
  const fontSize = options.title.length > 42 ? 62 : 76;
  const lines = wrapHeadline(options.title, fontSize, OG_WIDTH - 200, 3);
  const font =
    "Roboto, 'Roboto Variable', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const baseline = 340 - (lines.length - 1) * (fontSize * 0.6);

  const headline = lines
    .map(
      (line, index) =>
        `<text x="100" y="${(baseline + index * fontSize * 1.2).toFixed(0)}" font-family="${font}" font-size="${fontSize}" font-weight="700" fill="${OG_INK}">${xmlEscape(line)}</text>`,
    )
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" role="img" aria-label="${xmlEscape(`${options.title} — ${options.siteTitle}`)}">`,
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${OG_PAPER}"/>`,
    `<rect x="0" y="0" width="${OG_WIDTH}" height="10" fill="${OG_BRAND}"/>`,
    markup(options.logo, 100, 92, 210),
    headline,
    `<rect x="100" y="470" width="${OG_WIDTH - 200}" height="1" fill="${OG_HAIRLINE}"/>`,
    `<text x="100" y="524" font-family="${font}" font-size="30" font-weight="500" fill="${OG_BRAND}">${xmlEscape(options.siteTitle)}</text>`,
    `</svg>`,
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Site-wide artifacts
 * ------------------------------------------------------------------ */

function collectSources(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectSources(path);
      return CONTENT_EXTENSIONS.some((extension) =>
        entry.name.endsWith(extension),
      )
        ? [path]
        : [];
    })
    .sort();
}

function slugFor(relativePath: string): string {
  let slug = toPosix(relativePath).replace(/\.(?:md|mdx|markdown)$/, '');
  if (slug === 'index') return '';
  if (slug.endsWith('/index')) slug = slug.slice(0, -'/index'.length);
  return slug;
}

/**
 * The commit date of each source file, in one `git log` pass.
 *
 * Per-file `git log` calls would be one process per page; a single walk of the
 * content directory's history costs one. A path outside a work tree, or a
 * checkout with no history, yields nulls rather than a build failure.
 */
function lastModifiedDates(
  root: string,
  directory: string,
): Map<string, string> {
  const dates = new Map<string, string>();
  let output: string;
  let top: string;
  try {
    top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    output = execFileSync(
      'git',
      ['-C', root, 'log', '--format=%x00%cI', '--name-only', '--', directory],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch {
    return dates;
  }

  let current: string | null = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('\u0000')) {
      current = line.slice(1).trim();
      continue;
    }
    const path = line.trim();
    if (path === '' || current === null) continue;
    const absolute = toPosix(resolve(top, path));
    if (!dates.has(absolute)) dates.set(absolute, current);
  }
  return dates;
}

/** The configured sidebar, flattened into the section path of each page. */
export interface SidebarTrails {
  /** Trail by slug, for a page the sidebar names outright. */
  named: Map<string, string[]>;
  /** Trail by content directory, for pages Starlight expands off disk. */
  autogenerated: { directory: string; trail: string[] }[];
}

/** Flattens the configured sidebar into the section path of each page. */
export function sidebarTrails(
  items: readonly SidebarItem[],
  base: string,
): SidebarTrails {
  const named = new Map<string, string[]>();
  const autogenerated: { directory: string; trail: string[] }[] = [];
  const basePrefix = `/${trimSlashes(base)}`;

  const walk = (entries: readonly SidebarItem[], trail: string[]) => {
    for (const entry of entries) {
      /* An autogenerated entry carries no label of its own: since Starlight
       * 0.39 it is nested inside the group whose label it takes, and
       * `collapsed` is a display choice with nothing to say about sections. */
      if (typeof entry?.autogenerate?.directory === 'string') {
        autogenerated.push({
          directory: trimSlashes(entry.autogenerate.directory),
          trail,
        });
        continue;
      }
      if (Array.isArray(entry?.items)) {
        walk(entry.items, entry.label ? [...trail, entry.label] : trail);
        continue;
      }
      if (typeof entry?.slug === 'string') {
        named.set(trimSlashes(entry.slug), trail);
        continue;
      }
      if (typeof entry?.link === 'string' && entry.link.startsWith('/')) {
        const stripped = entry.link.startsWith(`${basePrefix}/`)
          ? entry.link.slice(basePrefix.length)
          : entry.link;
        named.set(trimSlashes(stripped), trail);
      }
    }
  };

  walk(items, []);
  return { named, autogenerated };
}

/**
 * The trail down to one page, by slug and by the file it was authored in.
 *
 * A page an autogenerated entry picks up is matched on its path under the
 * content directory, which is what Starlight matches on, and every directory
 * between that entry's own and the file becomes a label: Starlight names an
 * autogenerated subgroup after its directory. Without this a site that
 * declares a group as `{ autogenerate: { directory } }` has every page in it
 * land under the catch-all heading, whatever the sidebar calls the group.
 */
export function trailFor(
  page: { slug: string; contentPath: string },
  trails: SidebarTrails,
): string[] | null {
  const own = trails.named.get(page.slug);
  if (own) return own;

  const path = toPosix(page.contentPath);
  const withoutExtension = path.replace(/\.[^./]+$/, '');
  const directory = path.includes('/')
    ? path.slice(0, path.lastIndexOf('/'))
    : '';

  let best: { directory: string; trail: string[] } | undefined;
  for (const group of trails.autogenerated) {
    const contains =
      group.directory === '' ||
      withoutExtension === group.directory ||
      path.startsWith(`${group.directory}/`);
    if (!contains) continue;
    /* The deepest entry wins, the way the nested group does in the sidebar. */
    if (!best || group.directory.length > best.directory.length) best = group;
  }
  if (!best) return null;

  const nested = directory
    .split('/')
    .slice(best.directory === '' ? 0 : best.directory.split('/').length)
    .filter(Boolean);
  return [...best.trail, ...nested];
}

const OTHER_SECTION = 'Other pages';

/**
 * The heading a page sits under in llms.txt.
 *
 * `null` is a page the sidebar never names, which is a different thing from a
 * page it names at the top level: the first belongs under a catch-all, the
 * second under the site's own name. A repeated label is collapsed, because a
 * workspace and its only section often carry the same one and "Platform /
 * Platform" names nothing twice.
 */
function sectionName(sections: string[] | null, siteTitle: string): string {
  if (sections === null) return OTHER_SECTION;
  const labels = sections.filter(
    (label, index) => index === 0 || label !== sections[index - 1],
  );
  return labels.length > 0 ? labels.join(' / ') : siteTitle;
}

function groupBySection(
  pages: readonly PageRecord[],
  siteTitle: string,
): [string, PageRecord[]][] {
  const groups = new Map<string, PageRecord[]>();
  for (const page of pages) {
    const name = sectionName(page.sections, siteTitle);
    const bucket = groups.get(name);
    if (bucket) bucket.push(page);
    else groups.set(name, [page]);
  }
  return [...groups];
}

function llmsIndex(
  pages: readonly PageRecord[],
  site: { title: string; description: string | undefined },
): string {
  const lines = [`# ${site.title}`, ''];
  if (site.description) lines.push(`> ${site.description}`, '');

  for (const [section, entries] of groupBySection(pages, site.title)) {
    lines.push(`## ${section}`, '');
    for (const page of entries) {
      const description = page.description ? `: ${page.description}` : '';
      lines.push(`- [${page.title}](${page.url}index.md)${description}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function llmsFull(
  pages: readonly PageRecord[],
  origin: string,
  onSkipped: (page: PageRecord) => (skip: SidecarSkip) => void,
): string {
  return `${pages
    .map((page) => {
      const rendition = renderMarkdown(page.body, {
        pageUrl: page.url,
        origin,
        title: page.title,
        mdx: page.sourcePath.endsWith('.mdx'),
        sidecars: page.sidecars,
        onSidecarSkipped: onSkipped(page),
      });
      return `<!-- ${page.url} -->\n\n${rendition.trimEnd()}`;
    })
    .join('\n\n---\n\n')}\n`;
}

function rssFeed(
  posts: readonly PageRecord[],
  site: { title: string; description: string | undefined },
  feedUrl: string,
): string {
  const items = posts
    .map((post) =>
      [
        '    <item>',
        `      <title>${xmlEscape(post.title)}</title>`,
        `      <link>${xmlEscape(post.url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(post.url)}</guid>`,
        post.description
          ? `      <description>${xmlEscape(post.description)}</description>`
          : '',
        post.lastModified
          ? `      <pubDate>${new Date(post.lastModified).toUTCString()}</pubDate>`
          : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xmlEscape(site.title)}</title>`,
    `    <link>${xmlEscape(feedUrl.replace(/rss\.xml$/, ''))}</link>`,
    `    <description>${xmlEscape(site.description ?? site.title)}</description>`,
    `    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml"/>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

/*
 * The built page for a route, under either build format: a directory with an
 * index in it, or a file named for the slug.
 */
function readRouteHtml(outDir: string, slug: string): string | null {
  const parts = slug.split('/').filter(Boolean);
  const candidates = [join(outDir, ...parts, 'index.html')];
  if (parts.length > 0) {
    candidates.push(
      join(outDir, ...parts.slice(0, -1), `${parts.at(-1)}.html`),
    );
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8');
  }
  return null;
}

function write(directory: string, name: string, contents: string) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), contents, 'utf8');
}

export function discoverabilityIntegration(options: {
  resolved: ResolvedDiscoverability;
  site: { title: string; description: string | undefined };
  sidebar: readonly SidebarItem[];
}): AstroIntegration {
  let config: AstroConfig;

  return {
    name: '@ambiqai/helia-ui/starlight:discoverability',
    hooks: {
      'astro:config:done': ({ config: resolvedConfig }) => {
        config = resolvedConfig;
      },
      'astro:build:done': ({ dir, logger }) => {
        const root = fileURLToPath(config.root);
        const contentDir = join(
          fileURLToPath(config.srcDir),
          'content',
          'docs',
        );
        const outDir = fileURLToPath(dir);
        const origin = config.site ? new URL(config.site).origin : '';
        const base = `${config.base.replace(/\/+$/, '')}/`;

        if (!config.site) {
          throw new Error(
            'Discoverability needs an absolute `site` in astro.config: canonical URLs, ' +
              'Open Graph tags, llms.txt and the sitemap are all absolute.',
          );
        }

        const dates = lastModifiedDates(root, contentDir);
        const trails = sidebarTrails(options.sidebar, base);
        /* The sidecars are only read for the artifacts that carry a rendition;
           a site that turns both off pays nothing for the pass over the HTML. */
        const renditions = options.resolved.markdown || options.resolved.llms;

        const undocumented: string[] = [];
        const pages: PageRecord[] = [];

        for (const path of collectSources(contentDir)) {
          const source = readFileSync(path, 'utf8');
          const { data, body } = readFrontmatter(source);

          // Starlight drops drafts from a production build, so an artifact that
          // named one would advertise a route the deploy does not serve.
          if (data.draft === true) continue;

          const contentPath = toPosix(relative(contentDir, path));
          const slug =
            typeof data.slug === 'string' && data.slug !== ''
              ? trimSlashes(data.slug)
              : slugFor(contentPath);
          const route = slug === '' ? base : `${base}${slug}/`;
          const sourcePath = toPosix(relative(root, path));
          const title =
            typeof data.title === 'string'
              ? data.title
              : slug || options.site.title;
          const description =
            typeof data.description === 'string' ? data.description : undefined;

          if (!description && data.descriptionOptional !== true)
            undocumented.push(sourcePath);

          const html = renditions ? readRouteHtml(outDir, slug) : null;

          pages.push({
            slug,
            route,
            url: `${origin}${route}`,
            title,
            description,
            headings: headingsOf(body),
            sourcePath,
            lastModified: dates.get(toPosix(path)) ?? null,
            body,
            sections: trailFor({ slug, contentPath }, trails),
            sidecars: html === null ? [] : collectSidecars(html),
          });
        }

        if (undocumented.length > 0) {
          throw new Error(
            `${undocumented.length} page${undocumented.length === 1 ? ' has' : 's have'} no ` +
              '`description` frontmatter. A page with no description has no search result and ' +
              'no llms.txt line. Add one, or set `descriptionOptional: true` on a page whose ' +
              'title is the whole of it:\n' +
              undocumented.map((path) => `  - ${path}`).join('\n'),
          );
        }

        /* One line per route and kind, however many artifacts are rendered
           from it: a kind that turns itself off is one fact about the page. */
        const warned = new Set<string>();
        const reportSkips =
          (page: PageRecord) =>
          ({ kind, source, page: rendered }: SidecarSkip) => {
            const key = `${page.route} ${kind}`;
            if (warned.has(key)) return;
            warned.add(key);
            logger.warn(
              `${page.route} carries ${rendered} ${kind} rendition sidecar${rendered === 1 ? '' : 's'} ` +
                `where its source has ${source}, so its ${kind} components keep the form the source alone can prove. ` +
                'A set of them built from a model is the usual reason: compose that part of the rendition in the site.',
            );
          };

        // Sidebar order first, then anything the sidebar does not name, by
        // slug: both halves are stable, so the artifacts are byte-stable.
        const ordered = [...trails.named.keys()]
          .map((slug) => pages.find((page) => page.slug === slug))
          .filter((page): page is PageRecord => page !== undefined);
        const remaining = pages
          .filter((page) => !ordered.includes(page))
          .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
        const routes = [...ordered, ...remaining];

        if (options.resolved.markdown) {
          for (const page of routes) {
            write(
              join(outDir, ...page.slug.split('/').filter(Boolean)),
              'index.md',
              renderMarkdown(page.body, {
                pageUrl: page.url,
                origin,
                title: page.title,
                mdx: page.sourcePath.endsWith('.mdx'),
                sidecars: page.sidecars,
                onSidecarSkipped: reportSkips(page),
              }),
            );
          }
        }

        if (options.resolved.ogImage) {
          const logo = readFileSync(
            new URL('./ambiq-logo.svg', import.meta.url),
            'utf8',
          );
          for (const page of routes) {
            write(
              join(outDir, ...page.slug.split('/').filter(Boolean)),
              'og.svg',
              renderOgImage({
                title: page.title,
                siteTitle: options.site.title,
                logo,
              }),
            );
          }
        }

        if (options.resolved.llms) {
          write(outDir, 'llms.txt', llmsIndex(routes, options.site));
          write(outDir, 'llms-full.txt', llmsFull(routes, origin, reportSkips));
          write(
            outDir,
            'content-index.json',
            `${JSON.stringify(
              {
                site: origin,
                base,
                title: options.site.title,
                description: options.site.description ?? null,
                routes: routes.map((page) => ({
                  route: page.route,
                  url: page.url,
                  title: page.title,
                  description: page.description ?? null,
                  section: sectionName(page.sections, options.site.title),
                  headings: page.headings,
                  markdown: `${page.route}index.md`,
                  sourcePath: page.sourcePath,
                  lastModified: page.lastModified,
                })),
              },
              null,
              2,
            )}\n`,
          );
        }

        /*
         * No sitemap is written here: Starlight installs @astrojs/sitemap
         * itself when the site has not, and it runs after this hook, so a
         * second writer would only be overwritten.
         */
        /*
         * GitHub Pages reads robots.txt from the root of the uploaded artifact
         * rather than from under the base path, which is also where a site that
         * writes its own puts it. One that already has one keeps it.
         */
        const robots = join(outDir, 'robots.txt');
        if (!existsSync(robots)) {
          write(
            outDir,
            'robots.txt',
            `User-agent: *\nAllow: /\n\nSitemap: ${origin}${base}sitemap-index.xml\n`,
          );
        }

        const blogDir = join(fileURLToPath(config.srcDir), 'content', 'blog');
        if (existsSync(blogDir)) {
          const posts = collectSources(blogDir).map((path) => {
            const { data, body } = readFrontmatter(readFileSync(path, 'utf8'));
            const slug = `blog/${slugFor(relative(blogDir, path))}`;
            return {
              slug,
              route: `${base}${slug}/`,
              url: `${origin}${base}${slug}/`,
              title: typeof data.title === 'string' ? data.title : slug,
              description:
                typeof data.description === 'string'
                  ? data.description
                  : undefined,
              headings: [],
              sourcePath: toPosix(relative(root, path)),
              lastModified: dates.get(toPosix(path)) ?? null,
              body,
              sections: ['Blog'],
              sidecars: [],
            } satisfies PageRecord;
          });
          write(
            outDir,
            'rss.xml',
            rssFeed(posts, options.site, `${origin}${base}rss.xml`),
          );
        }

        logger.info(
          `discoverability: ${routes.length} routes indexed` +
            `${options.resolved.markdown ? ', markdown renditions written' : ''}` +
            `${existsSync(blogDir) ? ', rss.xml written' : ', no blog collection so no rss.xml'}.`,
        );
      },
    },
  };
}

/** Exported for the head override, which needs the same directory rule. */
export const markdownHref = (pathname: string) =>
  `${pathname.endsWith('/') ? pathname : `${pathname}/`}index.md`;

export const ogImageHref = (pathname: string) =>
  `${pathname.endsWith('/') ? pathname : `${pathname}/`}og.svg`;

export const OG_IMAGE_SIZE = { width: OG_WIDTH, height: OG_HEIGHT };
