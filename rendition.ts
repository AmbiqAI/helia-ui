// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The rendition sidecar: how a part states its own Markdown at build time.
 *
 * The Markdown twin of a page and `llms-full.txt` are reduced from the authored
 * source, which is the only input that can give a byte-stable answer. Source is
 * blind to a prop: a transcript imported from a module, a card whose title and
 * line come from a record, a button whose label is an expression are all
 * content the reader sees and the source pass cannot name.
 *
 * So a part states it. Alongside its markup it renders a hidden block holding
 * the Markdown it is worth to a reader, and the discoverability pass reads
 * those back out of the built HTML and splices them into the rendition where
 * the source pass put that component. The part is the only thing that knows
 * the values, so the part is what says them. See AmbiqAI/helia-ui#167.
 */

/** What a sidecar stands for, which is what the splice matches it on. */
export type RenditionKind = 'terminal' | 'link-card' | 'card' | 'button';

export const RENDITION_ATTRIBUTE = 'data-helia-rendition';

/*
 * `\u0000` is the mask the rendition pass holds an inline-code span with, so
 * it survives; every other control character, a line break in a title
 * included, is neither content nor markup. Written as escapes rather than as
 * the bytes themselves: a literal one in this file makes it binary to git.
 */
const CONTROL = /[\u0001-\u001f\u007f]/g;

/*
 * What a block of markdown cannot carry, tab and the line breaks excepted.
 * NUL is here and not in CONTROL because the pass masks inline code with it,
 * and a sidecar is read back long after any mask has been put back.
 */
const BLOCK_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Drops every control character a value has no business carrying. */
export const stripBlockControl = (value: string): string =>
  value.replace(BLOCK_CONTROL, '');

export const stripControl = (value: string): string =>
  value.replace(CONTROL, '');

/**
 * A run of plain text as inline Markdown: the `[...]` half of a link, a card's
 * line, a button's label.
 *
 * A title is the page's own prose and a rendition is Markdown, so a `]` in one
 * would close the link text and let whatever followed pose as the target of a
 * link the page never made. `<` and `&` are held for the same reason one step
 * on: this text has been read back out of rendered HTML with its entities
 * decoded, so a summary a page escaped as `&lt;img onerror=...&gt;` would
 * otherwise reach a reader of the rendition as live markup.
 */
export const linkText = (value: string): string =>
  stripControl(value).replace(/([\\[\]<&])/g, '\\$1');

/**
 * Holds a bare `<` in text that is already Markdown.
 *
 * What the source pass reduces carries the page's own links and code spans, so
 * it cannot be escaped as plain text; the one thing in it that is neither its
 * syntax nor its prose is a tag opener the tag pass left behind.
 */
export const escapeMarkup = (value: string): string =>
  value.replace(/(?<!\\)</g, '\\<');

/**
 * Text for the `(...)` half of a link.
 *
 * A target holding whitespace or a parenthesis needs the pointy form to stay
 * one target, and `<` and `>` inside it need escaping in turn.
 */
export const linkTarget = (value: string): string => {
  const href = stripControl(value);
  return /[\s()]/.test(href) ? `<${href.replace(/([\\<>])/g, '\\$1')}>` : href;
};

/** The longest run of backticks in a string, which a fence has to clear. */
const longestRun = (value: string): number =>
  Math.max(0, ...[...value.matchAll(/`+/g)].map((run) => run[0]!.length));

/** A fenced block whose fence clears the longest run of backticks inside it. */
export const codeFence = (body: string, language = 'text'): string => {
  const fence = '`'.repeat(Math.max(3, longestRun(body) + 1));
  return `${fence}${language}\n${body}\n${fence}`;
};

/**
 * `- [title](href): description`, the shape a card is worth to a reader.
 *
 * Both halves are plain text as far as this is concerned, and both are escaped
 * as such. A caller holding Markdown rather than text -- the source pass, whose
 * description is a reduced run of the page's own prose -- composes the line
 * itself rather than escaping its syntax away.
 */
export const linkItem = (
  title: string,
  href: string,
  description?: string,
): string => {
  const line = `- [${linkText(title)}](${linkTarget(href)})`;
  const trailing = description?.trim();
  return trailing ? `${line}: ${linkText(trailing)}` : line;
};

/** `[label](href)`, for a control whose whole content is its label. */
export const inlineLink = (label: string, href: string): string =>
  `[${linkText(label)}](${linkTarget(href)})`;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeEntities = (value: string): string =>
  value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body.startsWith('#x') || body.startsWith('#X')
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });

const TAG = /<(\/?)([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)\/?>/g;

/** Elements whose content is not the reader's, whatever it says. */
const OPAQUE = new Set(['script', 'style', 'template', 'svg', 'noscript']);

/**
 * The reading text of a slot a part has already rendered.
 *
 * A part reads its own children back as HTML, because that is the only form
 * Astro hands it, and a sidecar carries text. What the page hides from a
 * screen reader it hides from an agent too, which is what keeps `LinkCard`'s
 * motion cue out of a card's title.
 */
export function renditionText(html: string): string {
  let out = '';
  let index = 0;
  /* The element being skipped and how deep the same name is nested inside it,
     so an `aria-hidden` wrapper ends at its own closing tag. */
  let skip: { name: string; depth: number } | null = null;

  for (const match of html.matchAll(TAG)) {
    const [tag, closing, rawName, attributes] = match;
    const name = rawName!.toLowerCase();
    if (skip === null && index < match.index) {
      out += html.slice(index, match.index);
    }
    index = match.index + tag.length;

    if (skip !== null) {
      if (name !== skip.name) continue;
      if (closing === '/') {
        if (skip.depth === 0) skip = null;
        else skip.depth -= 1;
      } else if (!tag.endsWith('/>')) skip.depth += 1;
      continue;
    }

    if (closing === '/' || tag.endsWith('/>')) continue;
    const hidden =
      OPAQUE.has(name) || /\baria-hidden\s*=\s*["']?true/i.test(attributes!);
    if (hidden) skip = { name, depth: 0 };
  }

  if (skip === null && index < html.length) out += html.slice(index);
  /* A slot that wrapped in the source arrives with a line break between the
     words it wrapped between, and the browser renders that break as the space
     the reader sees. Collapsing before the control characters go is what keeps
     it: stripped first, the break left the words joined. See
     AmbiqAI/helia-ui#171. */
  return stripControl(decodeEntities(out).replace(/\s+/g, ' ')).trim();
}

/**
 * Markdown for the raw text of a `<script>` element.
 *
 * An HTML parser ends a raw text element at `</script`, which it matches
 * without regard to case and with any whitespace or slash after the name, and
 * `<!--` puts it in the state where a nested `<script` would carry it past one
 * end tag. Rather than match that grammar, every `</` and every `<!--` is held
 * with a backslash the reader takes back out, so `</SCRIPT\t>` is held exactly
 * as `</script>` is. A backslash already standing between `<` and one of those
 * openings is joined by one more, which is what makes the round trip exact. Nothing else
 * in the block is markup, which is why the sidecar is a script rather than a
 * template: what is written is what is read back, entities and all.
 */
export const escapeRendition = (markdown: string): string =>
  markdown.replace(
    /<(\\*)(\/|!--)/g,
    (_, held: string, opener: string) => `<${held}\\${opener}`,
  );

/** Takes back out what `escapeRendition` held. */
export const unescapeRendition = (raw: string): string =>
  raw.replace(
    /<(\\+)(\/|!--)/g,
    (_, held: string, opener: string) => `<${held.slice(1)}${opener}`,
  );

/**
 * The attributes of the block a part states its rendition in.
 *
 * A script of an unknown type renders nothing, is not styled, and takes no
 * part in the box the page lays out, so the sidecar cannot move a pixel of
 * what a reader sees. The Pagefind marker is belt and braces: search already
 * skips a script, and the attribute says why it must keep doing so.
 */
export const renditionAttributes = (kind: RenditionKind) => ({
  type: 'text/markdown',
  [RENDITION_ATTRIBUTE]: kind,
  'data-pagefind-ignore': true,
});
