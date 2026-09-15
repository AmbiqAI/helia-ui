// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Markdown text helpers, and what it takes to make Markdown prose safe inside
 * an MDX page.
 *
 * Shared by the generators that write pages from text they did not author: the
 * MkDocs converter, the Python extractor and the reference renderer. One copy,
 * because the set of characters MDX reads specially is a fact about MDX rather
 * than about any of them, and separate copies would diverge the first time one
 * generator met a page the others had not.
 */

/*
 * MDX reads `{` as an expression and `<` as a tag, so any prose that meant
 * them literally has to be escaped or the page will not compile. Code spans
 * are exempt: MDX does not read inside them.
 */
export function escapeMdx(text) {
  return text
    .replace(/[{}]/g, (c) => `\\${c}`)
    .replace(/<(\/?)([A-Za-z][\w.-]*)?/g, (m, slash, name) =>
      name && isElementName(name) ? m : `&lt;${slash}${name ?? ''}`,
    );
}

export function mapOutsideCode(text, fn) {
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

export const isElementName = (name) =>
  HTML_TAGS.has(name.toLowerCase()) || /^[A-Z]/.test(name);

const FENCE = /^(\s*)(```+|~~~+)/;

/** Split text into code fences and prose, so rewrites skip code. */
export function segments(text) {
  const out = [];
  let prose = [];
  let fence = null;
  for (const line of text.split('\n')) {
    const match = FENCE.exec(line);
    if (fence === null && match) {
      if (prose.length) out.push({ code: false, text: prose.join('\n') });
      prose = [];
      fence = match[2][0];
      out.push({ code: true, text: line });
    } else if (fence !== null) {
      out.push({ code: true, text: line });
      if (match && match[2][0] === fence) fence = null;
    } else {
      prose.push(line);
    }
  }
  if (prose.length) out.push({ code: false, text: prose.join('\n') });
  return out;
}

export const mapProse = (text, fn) =>
  segments(text)
    .map((segment) => (segment.code ? segment.text : fn(segment.text)))
    .join('\n');

/** A table cell: pipes escaped and paragraphs folded onto one line. */
export const cell = (text) =>
  String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n\s*\r?\n/g, '<br><br>')
    .replace(/\r?\n/g, ' ')
    .trim();

export const code = (text) => (text ? `\`${text}\`` : '');

export function table(headers, rows) {
  if (rows.length === 0) return '';
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
  return lines.join('\n');
}
