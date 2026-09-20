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
 * a byte-stable answer. Everything below is a pure function of the file tree
 * plus the sidebar, so two runs on one commit produce identical bytes.
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

/*
 * `\u0000` is what this pass masks an inline-code span with, so it survives;
 * every other control character is neither content nor markup.
 */
const CONTROL = /[\u0001-\u001f\u007f]/g;

/*
 * A title is the page's own prose and a rendition is markdown, so a `]` in a
 * title would close the link text and let whatever the author wrote next pose
 * as the target of a link the page never made.
 */
const linkText = (value: string): string =>
  value.replace(CONTROL, '').replace(/([\\[\]])/g, '\\$1');

/* A target holding whitespace or a parenthesis needs the pointy form to stay
   one target, and `<` and `>` inside it need escaping in turn. */
const linkTarget = (value: string): string => {
  const href = value.replace(CONTROL, '');
  return /[\s()]/.test(href) ? `<${href.replace(/([\\<>])/g, '\\$1')}>` : href;
};

/** The longest run of backticks in a string, which a fence has to clear. */
const longestRun = (value: string): number =>
  Math.max(0, ...[...value.matchAll(/`+/g)].map((run) => run[0]!.length));

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

function reduceElement(node: ElementNode): Reduction {
  const children = reduceNodes(node.children, true);

  if (node.name === 'AsciiTerminal') {
    const transcript = transcriptOf(node.attributes['lines']?.raw);
    if (transcript !== null) {
      const fence = '`'.repeat(Math.max(3, longestRun(transcript) + 1));
      return { kind: 'block', text: `${fence}text\n${transcript}\n${fence}` };
    }
    return children;
  }

  const title = literal(node, 'title');
  const href = literal(node, 'href');

  /* Whatever component carries both a name and a target is a link, whoever
     wrote it: the package's own parts, Starlight's, and a consuming site's
     alike. An element is not: `<a href title>` is already the link it makes,
     and `title` on it is a tooltip rather than the link's name. */
  if (/^[A-Z]/.test(node.name) && title !== undefined && href !== undefined) {
    const description = children.text.replace(/\s+/g, ' ').trim();
    const link = `- [${linkText(title)}](${linkTarget(href)})`;
    return {
      kind: 'item',
      text: description === '' ? link : `${link}: ${description}`,
    };
  }

  if (node.name === 'Card' && title !== undefined) {
    const body = children.text.trim();
    const heading = `${CARD_HEADING} ${title.replace(CONTROL, '')}`;
    return {
      kind: 'block',
      text: body === '' ? heading : `${heading}\n\n${body}`,
    };
  }

  return children;
}

/*
 * Children of an element are indented under it, and that indentation outlives
 * the tags: four spaces in front of a sentence is an indented code block in
 * plain markdown, so a card's title would reach a reader as code. A line
 * inside an element is therefore flattened to the margin.
 */
function reduceNodes(nodes: readonly TagNode[], inside: boolean): Reduction {
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

    const reduced = reduceElement(node);
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
 * A prop whose value is an expression is a documented loss: its value is the
 * page's to compute and this pass has only the source. See
 * AmbiqAI/helia-ui#143.
 */
export function reduceTags(text: string): string {
  return withoutInlineCode(text, (masked) => {
    /* An attribute list wraps, and the tag with it. A wrapped tag folds back
       onto one line so that a value broken across lines -- a title written
       over two of them -- is one line of markdown and not two. */
    const folded = masked.replace(TAG, (tag) =>
      tag.includes('\n') ? tag.replace(/\s*\n\s*/g, ' ') : tag,
    );
    return reduceNodes(parseTags(folded), false).text;
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
  },
): string {
  const mdx = options.mdx ?? false;
  const rendered = splitFences(body)
    .map(({ code, text }) => {
      /* A fenced block is quoted, not authored: a page documenting MDX shows
         a comment and an expression as the syntax they are. */
      if (code) return text;
      const reduced = reduceTags(stripEsm(mdx ? stripComments(text) : text));
      return resolveLinks(
        mdx ? stripExpressions(reduced) : reduced,
        options.pageUrl,
        options.origin,
      );
    })
    .join('\n');

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

function llmsFull(pages: readonly PageRecord[], origin: string): string {
  return `${pages
    .map((page) => {
      const rendition = renderMarkdown(page.body, {
        pageUrl: page.url,
        origin,
        title: page.title,
        mdx: page.sourcePath.endsWith('.mdx'),
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
          write(outDir, 'llms-full.txt', llmsFull(routes, origin));
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
