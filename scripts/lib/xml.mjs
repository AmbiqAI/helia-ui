// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Just enough XML to read a Doxygen dump.
 *
 * A dependency would be the obvious answer and is the wrong one here: these
 * scripts run from a product repository's CI with nothing installed but this
 * package, and the reference generator has stayed dependency-free on purpose.
 * Doxygen's output is also a narrow target -- machine-written, UTF-8, no
 * namespaces that matter, no DTD, no entities beyond the predefined five -- so
 * the general-purpose parser's generality would all be dead weight.
 *
 * What this deliberately does not do: validate. A document that does not fit
 * is read as far as it makes sense and the caller decides what is missing,
 * because a reference generator that refuses a file over a stray attribute is
 * a reference generator nobody can run.
 */

/**
 * One element.
 *
 * @typedef {object} XmlElement
 * @property {string} name Tag name, as written.
 * @property {Record<string, string>} attrs Attributes, entities already decoded.
 * @property {Array<XmlElement | string>} children Elements and text, in document order.
 */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/** Resolve the predefined entities and numeric character references. */
export function decodeEntities(text) {
  if (!text.includes('&')) return text;
  return text.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (all, ref) => {
      if (ref.startsWith('#x') || ref.startsWith('#X'))
        return String.fromCodePoint(Number.parseInt(ref.slice(2), 16));
      if (ref.startsWith('#'))
        return String.fromCodePoint(Number.parseInt(ref.slice(1), 10));
      return Object.hasOwn(ENTITIES, ref) ? ENTITIES[ref] : all;
    },
  );
}

const ATTR = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function parseAttrs(text) {
  const attrs = {};
  for (const match of text.matchAll(ATTR)) {
    attrs[match[1]] = decodeEntities(match[3] ?? match[4] ?? '');
  }
  return attrs;
}

export class XmlError extends Error {}

/**
 * Parse an XML document into a tree of elements and text.
 *
 * @param {string} text The document source.
 * @returns {XmlElement} The root element.
 * @throws {XmlError} when there is no root element.
 */
export function parseXml(text) {
  const root = { name: '#document', attrs: {}, children: [] };
  const stack = [root];
  let index = 0;

  const push = (node) => stack.at(-1).children.push(node);

  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open === -1) {
      const tail = text.slice(index);
      if (tail) push(tail);
      break;
    }
    if (open > index) push(decodeEntities(text.slice(index, open)));

    /* CDATA before the generic cases: its body may contain anything, so it
     * cannot be scanned for a closing angle bracket. */
    if (text.startsWith('<![CDATA[', open)) {
      const end = text.indexOf(']]>', open);
      const stop = end === -1 ? text.length : end;
      push(text.slice(open + 9, stop));
      index = end === -1 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<!--', open)) {
      const end = text.indexOf('-->', open);
      index = end === -1 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<?', open) || text.startsWith('<!', open)) {
      const end = text.indexOf('>', open);
      index = end === -1 ? text.length : end + 1;
      continue;
    }

    const close = text.indexOf('>', open);
    if (close === -1) {
      push(decodeEntities(text.slice(open)));
      break;
    }
    const raw = text.slice(open + 1, close);
    index = close + 1;

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      /* An unmatched end tag closes back to its own start tag if it has one
       * and is otherwise dropped, so one malformed element cannot reparent
       * the rest of the document. */
      const depth = stack.findLastIndex((node) => node.name === name);
      if (depth > 0) stack.length = depth;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const name = /^[\w:.-]+/.exec(body)?.[0];
    if (!name) continue;
    const node = {
      name,
      attrs: parseAttrs(body.slice(name.length)),
      children: [],
    };
    push(node);
    if (!selfClosing) stack.push(node);
  }

  const element = root.children.find((child) => typeof child !== 'string');
  if (!element) throw new XmlError('The document has no root element.');
  return element;
}

/** The element children of a node, optionally only those with a given name. */
export const children = (node, name) =>
  (node?.children ?? []).filter(
    (child) => typeof child !== 'string' && (!name || child.name === name),
  );

/** The first element child with a given name, or undefined. */
export const child = (node, name) => children(node, name)[0];

/** Every descendant with a given name, in document order. */
export function descendants(node, name) {
  const out = [];
  const visit = (current) => {
    for (const element of children(current)) {
      if (element.name === name) out.push(element);
      visit(element);
    }
  };
  visit(node);
  return out;
}

/** All text under a node, with no markup and no normalization. */
export function textOf(node) {
  if (typeof node === 'string') return node;
  return (node?.children ?? []).map(textOf).join('');
}
