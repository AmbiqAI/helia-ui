// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Renders a griffe JSON dump into Starlight Markdown, the way mkdocstrings
 * renders it into MkDocs Material.
 *
 * Developed against griffe 1.7.3 (`griffe dump <package> --docstyle google -f`).
 * The dump is a plain tree of objects keyed by name, so the reader here pins
 * the shape it understands rather than trusting whatever version produced the
 * file -- see `parseDump`.
 *
 * The renderer is a pure function of the dump and the options: no filesystem,
 * no process, so the CLI and the tests exercise the same code.
 *
 * Two anchors exist on every symbol heading. The Starlight slug comes from the
 * heading text, and an explicit `<span id="dotted.path">` reproduces the
 * mkdocstrings anchor so inbound links written against the MkDocs site keep
 * resolving after the move.
 */

/** The griffe release whose `dump` output this reader was written against. */
export const GRIFFE_VERSION = '1.7.3';

/** Wrap a signature across lines past this width, as mkdocstrings does. */
const LINE_LENGTH = 120;

/** Frontmatter descriptions are a summary, not the first paragraph. */
const DESCRIPTION_LIMIT = 160;

/** Member labels worth surfacing; the rest are noise on the page. */
const SHOWN_LABELS = [
  'abstractmethod',
  'classmethod',
  'staticmethod',
  'property',
  'cached',
  'dataclass',
];

/** Google-style admonition kinds Starlight's `Aside` can carry directly. */
const ASIDE_TYPES = {
  note: 'note',
  info: 'note',
  abstract: 'note',
  summary: 'note',
  question: 'note',
  example: 'note',
  tip: 'tip',
  hint: 'tip',
  important: 'tip',
  success: 'tip',
  warning: 'caution',
  caution: 'caution',
  attention: 'caution',
  failure: 'caution',
  danger: 'danger',
  error: 'danger',
  bug: 'danger',
};

/**
 * Defaults mirroring the mkdocstrings options the HELIA product sites use, so
 * that a run with no flags reproduces the pages those sites publish today.
 */
export const DEFAULTS = {
  docstringStyle: 'google',
  showRootHeading: false,
  headingLevel: 2,
  mergeInitIntoClass: true,
  membersOrder: 'source',
  filters: ['!^_', '^__init__$'],
  separateSignature: true,
  showSignature: true,
  showSignatureAnnotations: true,
  routePrefix: 'reference/api',
  base: '/',
};

export class PyrefSchemaError extends Error {}

/* -------------------------------------------------------------------------
 * Dump reading
 * ---------------------------------------------------------------------- */

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const schemaHint = `The dump must come from griffe ${GRIFFE_VERSION}: griffe dump <package> --docstyle google -f > dump.json`;

/**
 * Validate the top level of a griffe dump and return the package module.
 *
 * @param {unknown} data Parsed JSON from `griffe dump`.
 * @param {string} [packageName] Which top-level package to read, when the dump
 *   holds more than one.
 * @returns {{ name: string, root: object }}
 * @throws {PyrefSchemaError} when the shape is not the one this reader pins.
 */
export function parseDump(data, packageName) {
  if (!isObject(data)) {
    throw new PyrefSchemaError(
      `Expected a JSON object of packages, got ${Array.isArray(data) ? 'an array' : typeof data}. ${schemaHint}`,
    );
  }

  const names = Object.keys(data);
  if (names.length === 0) {
    throw new PyrefSchemaError(`The dump is empty. ${schemaHint}`);
  }

  const name = packageName ?? (names.length === 1 ? names[0] : undefined);
  if (name === undefined) {
    throw new PyrefSchemaError(
      `The dump holds ${names.length} packages (${names.join(', ')}). Pass --package to choose one.`,
    );
  }
  if (!Object.hasOwn(data, name)) {
    throw new PyrefSchemaError(
      `No package named ${name} in the dump. It holds: ${names.join(', ')}.`,
    );
  }

  const root = data[name];
  const missing = ['kind', 'name', 'path', 'members'].filter(
    (key) => !isObject(root) || !Object.hasOwn(root, key),
  );
  if (missing.length > 0) {
    throw new PyrefSchemaError(
      `Package ${name} is missing ${missing.join(', ')}, so this is not a shape this reader understands. ${schemaHint}`,
    );
  }
  if (root.kind !== 'module') {
    throw new PyrefSchemaError(
      `Package ${name} has kind ${JSON.stringify(root.kind)}, expected "module". ${schemaHint}`,
    );
  }
  if (!isObject(root.members)) {
    throw new PyrefSchemaError(
      `Package ${name} has a non-object "members". ${schemaHint}`,
    );
  }

  return { name, root };
}

/* -------------------------------------------------------------------------
 * Filters and ordering
 * ---------------------------------------------------------------------- */

/**
 * Compile mkdocstrings `filters` into a predicate. Patterns apply in order and
 * the last match wins; a name no pattern matches is kept.
 *
 * @param {string[]} filters Patterns, `!`-prefixed to exclude.
 */
export function compileFilters(filters) {
  const compiled = filters.map((raw) => {
    const exclude = raw.startsWith('!');
    return { exclude, pattern: new RegExp(exclude ? raw.slice(1) : raw) };
  });
  return (name) => {
    let keep = true;
    for (const { exclude, pattern } of compiled) {
      if (pattern.test(name)) keep = !exclude;
    }
    return keep;
  };
}

const byOrder = (order) => (a, b) =>
  order === 'alphabetical'
    ? a.name.localeCompare(b.name)
    : (a.lineno ?? 0) - (b.lineno ?? 0);

/**
 * The members of a node that survive the filters, in the configured order.
 * Aliases are dropped here; `reExports` handles the ones a module publishes.
 */
function members(node, options, kinds) {
  const keep = compileFilters(options.filters);
  return Object.entries(node.members ?? {})
    .filter(([name, member]) => {
      if (!isObject(member)) return false;
      if (member.kind === 'alias') return false;
      if (!kinds.includes(member.kind)) return false;
      return keep(name);
    })
    .map(([name, member]) => ({ ...member, name: member.name ?? name }))
    .sort(byOrder(options.membersOrder));
}

/** Names a module republishes through `__all__`, in declaration order. */
function reExports(node) {
  const all = node.members?.__all__;
  const elements = all?.value?.elements;
  if (!Array.isArray(elements)) return [];
  return elements
    .filter((item) => typeof item === 'string')
    .map((item) => item.replace(/^['"]|['"]$/g, ''))
    .map((name) => ({ name, target: node.members?.[name]?.target_path }))
    .filter((entry) => entry.target);
}

/**
 * Every module in the tree, in the order the pages should appear.
 *
 * `__main__` is skipped: it is an entry point, not API surface, and the MkDocs
 * generator skipped it too.
 */
export function collectModules(root) {
  const out = [];
  const visit = (node, parts) => {
    out.push({ parts, path: parts.join('.'), node });
    const children = Object.entries(node.members ?? {})
      .filter(([, m]) => isObject(m) && m.kind === 'module')
      .filter(([name]) => name !== '__main__')
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [name, child] of children) visit(child, [...parts, name]);
  };
  visit(root, [root.name]);
  return out;
}

/* -------------------------------------------------------------------------
 * Expressions
 * ---------------------------------------------------------------------- */

/**
 * Render a griffe expression back to the Python source it came from.
 *
 * @param {unknown} expr A serialized `Expr*` node, a literal string, or null.
 * @returns {string}
 */
export function renderExpr(expr) {
  if (expr === null || expr === undefined) return '';
  if (typeof expr === 'string') return expr;
  if (typeof expr === 'number' || typeof expr === 'boolean')
    return String(expr);
  if (Array.isArray(expr)) return expr.map(renderExpr).join(', ');
  if (!isObject(expr)) return String(expr);

  const list = (items) => (items ?? []).map(renderExpr).join(', ');

  switch (expr.cls) {
    case 'ExprName':
      return String(expr.name ?? '');
    case 'ExprAttribute':
      return (expr.values ?? []).map(renderExpr).join('.');
    case 'ExprSubscript':
      return `${renderExpr(expr.left)}[${renderExpr(expr.slice)}]`;
    case 'ExprTuple':
      return expr.implicit ? list(expr.elements) : `(${list(expr.elements)})`;
    case 'ExprList':
      return `[${list(expr.elements)}]`;
    case 'ExprSet':
      return `{${list(expr.elements)}}`;
    case 'ExprDict':
      return `{${(expr.keys ?? [])
        .map((key, i) => `${renderExpr(key)}: ${renderExpr(expr.values?.[i])}`)
        .join(', ')}}`;
    case 'ExprBinOp':
      return `${renderExpr(expr.left)} ${expr.operator} ${renderExpr(expr.right)}`;
    case 'ExprBoolOp':
      return (expr.values ?? [])
        .map(renderExpr)
        .join(` ${expr.operator ?? 'and'} `);
    case 'ExprUnaryOp':
      return `${expr.operator}${renderExpr(expr.value)}`;
    case 'ExprCall':
      return `${renderExpr(expr.function)}(${list(expr.arguments)})`;
    case 'ExprKeyword':
      return `${expr.name}=${renderExpr(expr.value)}`;
    case 'ExprVarPositional':
      return `*${renderExpr(expr.value)}`;
    case 'ExprVarKeyword':
      return `**${renderExpr(expr.value)}`;
    case 'ExprLambda':
      return `lambda ${list(expr.parameters)}: ...`;
    case 'ExprParameter':
      return String(expr.name ?? '');
    case 'ExprIfExp':
      return `${renderExpr(expr.body)} if ${renderExpr(expr.test)} else ${renderExpr(expr.orelse)}`;
    case 'ExprComprehension':
      return `for ${renderExpr(expr.target)} in ${renderExpr(expr.iterable)}`;
    case 'ExprDictComp':
      return `{${renderExpr(expr.key)}: ${renderExpr(expr.value)} ${list(expr.generators)}}`;
    case 'ExprSlice':
      return `${renderExpr(expr.lower)}:${renderExpr(expr.upper)}`;
    default:
      if (typeof expr.name === 'string') return expr.name;
      if (Object.hasOwn(expr, 'value')) return renderExpr(expr.value);
      if (Array.isArray(expr.elements)) return list(expr.elements);
      return '';
  }
}

/* -------------------------------------------------------------------------
 * Signatures
 * ---------------------------------------------------------------------- */

const RECEIVERS = new Set(['self', 'cls']);

/**
 * The parameter list of a function, formatted as Python source.
 *
 * @param {object} fn A `function` node.
 * @param {object} options Rendering options.
 * @param {boolean} isMethod Drop the leading `self`/`cls`, as mkdocstrings does.
 */
function renderParameters(fn, options, isMethod) {
  const parameters = (fn.parameters ?? []).filter(
    (parameter, index) =>
      !(isMethod && index === 0 && RECEIVERS.has(parameter.name)),
  );

  const parts = [];
  let seenPositionalOnly = false;
  let seenStar = false;

  for (const parameter of parameters) {
    const kind = parameter.kind ?? 'positional or keyword';
    if (kind === 'positional-only') seenPositionalOnly = true;
    if (seenPositionalOnly && kind !== 'positional-only') {
      parts.push('/');
      seenPositionalOnly = false;
    }
    if (kind === 'variadic positional') seenStar = true;
    if (kind === 'keyword-only' && !seenStar) {
      parts.push('*');
      seenStar = true;
    }

    let text = parameter.name;
    if (kind === 'variadic positional') text = `*${text}`;
    if (kind === 'variadic keyword') text = `**${text}`;

    const annotation = options.showSignatureAnnotations
      ? renderExpr(parameter.annotation)
      : '';
    if (annotation) text += `: ${annotation}`;
    if (parameter.default !== null && parameter.default !== undefined) {
      text += annotation
        ? ` = ${renderExpr(parameter.default)}`
        : `=${renderExpr(parameter.default)}`;
    }
    parts.push(text);
  }
  if (seenPositionalOnly) parts.push('/');
  return parts;
}

/**
 * A callable's signature, wrapped one parameter per line when the single-line
 * form would run past the line length.
 */
export function renderSignature(name, fn, options, { isMethod = false } = {}) {
  const parts = renderParameters(fn, options, isMethod);
  const returns =
    options.showSignatureAnnotations && fn.returns
      ? ` -> ${renderExpr(fn.returns)}`
      : '';
  const oneLine = `${name}(${parts.join(', ')})${returns}`;
  if (oneLine.length <= LINE_LENGTH) return oneLine;
  return `${name}(\n${parts.map((part) => `    ${part},`).join('\n')}\n)${returns}`;
}

/* -------------------------------------------------------------------------
 * Markdown helpers
 * ---------------------------------------------------------------------- */

const FENCE = /^(\s*)(```+|~~~+)/;

/** Split text into code fences and prose, so rewrites skip code. */
function segments(text) {
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

const mapProse = (text, fn) =>
  segments(text)
    .map((segment) => (segment.code ? segment.text : fn(segment.text)))
    .join('\n');

/**
 * Shift Markdown headings inside a docstring so the shallowest sits at the
 * configured heading level. mkdocstrings leaves them alone, which lets a
 * docstring emit an `<h1>` that competes with the page title; Starlight builds
 * its table of contents from the document, so the levels have to nest.
 */
function shiftHeadings(text, level) {
  const found = [...text.matchAll(/^(#{1,6})\s+\S/gm)].map((m) => m[1].length);
  if (found.length === 0) return text;
  const shift = level - Math.min(...found);
  if (shift <= 0) return text;
  return mapProse(text, (prose) =>
    prose.replace(/^(#{1,6})(\s+)/gm, (_, hashes, space) => {
      const next = Math.min(6, hashes.length + shift);
      return `${'#'.repeat(next)}${space}`;
    }),
  );
}

/** A table cell: pipes escaped and paragraphs folded onto one line. */
const cell = (text) =>
  String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n\s*\r?\n/g, '<br><br>')
    .replace(/\r?\n/g, ' ')
    .trim();

const code = (text) => (text ? `\`${text}\`` : '');

function table(headers, rows) {
  if (rows.length === 0) return '';
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
  return lines.join('\n');
}

/** YAML double-quoted scalar: safe for any docstring summary. */
const yamlString = (value) =>
  `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim()}"`;

/** The first sentence of a docstring, for the frontmatter description. */
export function summarize(node) {
  const text = (node?.docstring?.parsed ?? []).find(
    (section) => section.kind === 'text',
  )?.value;
  if (typeof text !== 'string') return '';
  const first = text
    .trim()
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ');
  /* Material icon shortcodes are content, not prose; they have no meaning in
   * a `<meta name="description">`. Converting the pages that use them is a
   * separate job, so the summary drops them and the body keeps them. */
  const plain = first
    .replace(/^#+\s*/, '')
    .replace(/:[a-z0-9]+(?:-[a-z0-9]+)+:\s*/g, '')
    .replace(/[*`_]/g, '');
  const sentence = /^(.*?[.!?])(\s|$)/.exec(plain)?.[1] ?? plain;
  return sentence.length > DESCRIPTION_LIMIT
    ? `${sentence.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : sentence;
}

/* -------------------------------------------------------------------------
 * Cross-references
 * ---------------------------------------------------------------------- */

const CROSSREF = /\[([^\]\n]+)\]\[([^\]\n]*)\]/g;

/**
 * Build the map from a dotted Python path to the page and anchor that carries
 * it, so `[Name][module.path]` can become a link.
 */
export function buildIndex(modules) {
  const index = new Map();
  const add = (path, modulePath) =>
    index.set(path, { modulePath, anchor: path });
  const walk = (node, modulePath) => {
    for (const [name, member] of Object.entries(node.members ?? {})) {
      if (!isObject(member) || member.kind === 'alias') continue;
      const path = member.path ?? `${modulePath}.${name}`;
      if (member.kind === 'module') continue;
      add(path, modulePath);
      if (member.kind === 'class') walk(member, modulePath);
    }
  };
  for (const { path, node } of modules) {
    index.set(path, { modulePath: path, anchor: null });
    walk(node, path);
  }
  return index;
}

const joinUrl = (base, tail) => `${base.replace(/\/$/, '')}/${tail}`;

/**
 * Rewrite `[Text][target]` cross-references to site URLs.
 *
 * An unresolved reference keeps its text and is reported rather than left as a
 * dead link, which is what the MkDocs build did with `autorefs`.
 */
export function resolveCrossRefs(text, context) {
  const { index, options, currentModule, warn } = context;
  return mapProse(text, (prose) =>
    prose.replace(CROSSREF, (match, label, target, offset, whole) => {
      if (isInsideCode(whole, offset)) return match;
      const wanted = target.trim() || label.trim();
      const hit =
        index.get(wanted) ??
        (currentModule ? index.get(`${currentModule}.${wanted}`) : undefined);
      if (!hit) {
        warn(`unresolved cross-reference [${label}][${target}]`);
        return label;
      }
      const url = joinUrl(
        options.base,
        `${options.routePrefix}/${hit.modulePath.split('.').join('/')}/`,
      );
      return `[${label}](${hit.anchor ? `${url}#${hit.anchor}` : url})`;
    }),
  );
}

/** True when an offset falls inside a backtick span on its line. */
function isInsideCode(text, offset) {
  const start = text.lastIndexOf('\n', offset) + 1;
  const ticks = (text.slice(start, offset).match(/`/g) ?? []).length;
  return ticks % 2 === 1;
}

/* -------------------------------------------------------------------------
 * Docstring sections
 * ---------------------------------------------------------------------- */

const named = (entries) =>
  entries.some((entry) => (entry.name ?? '').length > 0);

/**
 * Render one parsed docstring section.
 *
 * @returns {string} Markdown, or the empty string when the section is empty.
 */
function renderSection(section, context) {
  const text = (value) => resolveCrossRefs(String(value ?? ''), context);
  const entries = Array.isArray(section.value) ? section.value : [];

  switch (section.kind) {
    case 'text':
      return shiftHeadings(text(section.value), context.options.headingLevel);

    case 'parameters':
    case 'other parameters': {
      const label =
        section.kind === 'parameters' ? 'Parameters' : 'Other parameters';
      const rows = entries.map((entry) => [
        code(entry.name),
        code(renderExpr(entry.annotation)),
        text(entry.description),
        entry.value === null || entry.value === undefined
          ? '_required_'
          : code(renderExpr(entry.value)),
      ]);
      return `**${label}**\n\n${table(['Name', 'Type', 'Description', 'Default'], rows)}`;
    }

    case 'attributes': {
      const rows = entries.map((entry) => [
        code(entry.name),
        code(renderExpr(entry.annotation)),
        text(entry.description),
      ]);
      return `**Attributes**\n\n${table(['Name', 'Type', 'Description'], rows)}`;
    }

    case 'returns':
    case 'yields':
    case 'receives': {
      const label =
        section.kind === 'returns'
          ? 'Returns'
          : section.kind === 'yields'
            ? 'Yields'
            : 'Receives';
      const withNames = named(entries);
      const headers = withNames
        ? ['Name', 'Type', 'Description']
        : ['Type', 'Description'];
      const rows = entries.map((entry) => {
        const tail = [
          code(renderExpr(entry.annotation)),
          text(entry.description),
        ];
        return withNames ? [code(entry.name), ...tail] : tail;
      });
      return `**${label}**\n\n${table(headers, rows)}`;
    }

    case 'raises':
    case 'warns': {
      const label = section.kind === 'raises' ? 'Raises' : 'Warns';
      const rows = entries.map((entry) => [
        code(renderExpr(entry.annotation)),
        text(entry.description),
      ]);
      return `**${label}**\n\n${table(['Type', 'Description'], rows)}`;
    }

    case 'examples': {
      /* griffe hands back alternating prose and code chunks. */
      return entries
        .map((entry) => {
          const [kind, value] = Array.isArray(entry) ? entry : ['text', entry];
          return kind === 'examples'
            ? `\`\`\`python\n${String(value).trimEnd()}\n\`\`\``
            : text(value);
        })
        .filter(Boolean)
        .join('\n\n');
    }

    case 'admonition': {
      const kind = String(section.value?.annotation ?? 'note').toLowerCase();
      const title = section.title ?? '';
      const type = ASIDE_TYPES[kind] ?? 'note';
      const redundant = title.toLowerCase() === type;
      const head = title && !redundant ? `:::${type}[${title}]` : `:::${type}`;
      /* The blank line before the closer keeps it out of a trailing list item
       * when a formatter reflows the page. */
      return `${head}\n${text(section.value?.description)}\n\n:::`;
    }

    case 'deprecated':
      return `:::caution[Deprecated]\n${
        section.value?.version ? `Since ${section.value.version}. ` : ''
      }${text(section.value?.description)}\n\n:::`;

    case 'modules':
    case 'classes':
    case 'functions': {
      const label = section.kind[0].toUpperCase() + section.kind.slice(1);
      const rows = entries.map((entry) => [
        code(entry.name),
        text(entry.description),
      ]);
      return `**${label}**\n\n${table(['Name', 'Description'], rows)}`;
    }

    default:
      context.warn(`unsupported docstring section "${section.kind}"`);
      return '';
  }
}

/**
 * Render a docstring, optionally holding back sections the caller places
 * itself (a class merges its `__init__` parameters into its own body).
 */
function renderDocstring(node, context, { skip = [] } = {}) {
  const docstring = node?.docstring;
  if (!docstring) return [];
  if (!Array.isArray(docstring.parsed)) {
    context.warn(
      `docstring was not parsed by griffe (style ${context.options.docstringStyle}?)`,
    );
    return docstring.value ? [String(docstring.value)] : [];
  }
  return docstring.parsed
    .filter((section) => !skip.includes(section.kind))
    .map((section) => renderSection(section, context))
    .filter((block) => block.trim().length > 0);
}

const sectionsOf = (node, kind) =>
  (node?.docstring?.parsed ?? []).filter((section) => section.kind === kind);

/* -------------------------------------------------------------------------
 * Symbols
 * ---------------------------------------------------------------------- */

const heading = (level, path, title) =>
  `${'#'.repeat(level)} <span id="${path}"></span>${title}`;

const labelsOf = (node) => {
  const shown = SHOWN_LABELS.filter((label) =>
    (node.labels ?? []).includes(label),
  );
  return shown.length ? shown.map((label) => `\`${label}\``).join(' ') : '';
};

function renderFunction(node, context, { level, title, isMethod }) {
  const { options } = context;
  context.state.symbol = node.path;
  const blocks = [heading(level, node.path, title)];
  const labels = labelsOf(node);
  if (labels) blocks.push(labels);
  if (options.showSignature) {
    const name = title.includes('.') ? title.split('.').pop() : title;
    blocks.push(
      `\`\`\`python\n${renderSignature(name, node, options, { isMethod })}\n\`\`\``,
    );
  }
  blocks.push(...renderDocstring(node, context));
  return blocks;
}

/**
 * The attributes of a class or module: the documented `Attributes:` section
 * merged with the public attribute members, so a dataclass or a pydantic model
 * renders its fields whichever way they were documented.
 */
function renderAttributes(node, context, label = 'Attributes') {
  const documented = new Map();
  for (const section of sectionsOf(node, 'attributes')) {
    for (const entry of section.value ?? []) documented.set(entry.name, entry);
  }
  const rows = [];
  const seen = new Set();

  for (const member of members(node, context.options, ['attribute'])) {
    seen.add(member.name);
    const entry = documented.get(member.name);
    rows.push([
      code(member.name),
      code(renderExpr(entry?.annotation ?? member.annotation)),
      resolveCrossRefs(
        entry?.description ?? summarizeValue(member) ?? '',
        context,
      ),
      code(renderExpr(member.value)),
    ]);
  }
  for (const [name, entry] of documented) {
    if (seen.has(name)) continue;
    rows.push([
      code(name),
      code(renderExpr(entry.annotation)),
      resolveCrossRefs(entry.description ?? '', context),
      '',
    ]);
  }
  if (rows.length === 0) return '';
  const anyDefault = rows.some((row) => row[3] !== '');
  const headers = anyDefault
    ? ['Name', 'Type', 'Description', 'Default']
    : ['Name', 'Type', 'Description'];
  const trimmed = anyDefault ? rows : rows.map((row) => row.slice(0, 3));
  return `**${label}**\n\n${table(headers, trimmed)}`;
}

const summarizeValue = (member) => {
  const text = (member.docstring?.parsed ?? []).find((s) => s.kind === 'text');
  return typeof text?.value === 'string' ? text.value : '';
};

function renderClass(node, context, level) {
  const { options } = context;
  const init = node.members?.__init__;
  const merged = options.mergeInitIntoClass && init?.kind === 'function';

  const blocks = [heading(level, node.path, node.name)];
  const labels = labelsOf(node);
  if (labels) blocks.push(labels);

  if (options.showSignature) {
    const signature = merged
      ? renderSignature(node.name, init, options, { isMethod: true })
      : `${node.name}()`;
    blocks.push(`\`\`\`python\n${signature}\n\`\`\``);
  }

  context.state.symbol = node.path;
  const inner = context;
  blocks.push(...renderDocstring(node, inner, { skip: ['attributes'] }));

  /* The class docstring and `__init__` both describe the constructor; with
   * merge_init_into_class the class body is where the parameters belong, and
   * only one of the two usually carries them. The `__init__` summary is
   * dropped when the class has one of its own, which is otherwise the same
   * sentence twice. */
  const classParams = sectionsOf(node, 'parameters').length > 0;
  if (merged && !classParams) {
    const skip = sectionsOf(node, 'text').length > 0 ? ['text'] : [];
    blocks.push(...renderDocstring(init, inner, { skip }));
  }

  const attributes = renderAttributes(node, inner);
  if (attributes) blocks.push(attributes);

  for (const member of members(node, options, ['function'])) {
    if (merged && member.name === '__init__') continue;
    blocks.push(
      ...renderFunction(member, context, {
        level: level + 1,
        title: `${node.name}.${member.name}`,
        isMethod: true,
      }),
    );
  }
  return blocks;
}

/* -------------------------------------------------------------------------
 * Pages
 * ---------------------------------------------------------------------- */

/**
 * Render one module to a Starlight Markdown page.
 *
 * @returns {{ path: string, markdown: string, anchors: string[], warnings: string[] }}
 */
export function renderModule(module, { index, options, order = 0 }) {
  const warnings = [];
  const anchors = [];
  /* Warnings name the symbol they came from, so `state` is shared by every
   * copy of the context rather than captured by value when one is spread. */
  const state = { symbol: module.path };
  const context = {
    index,
    options,
    currentModule: module.path,
    state,
    warn: (message) => warnings.push(`${state.symbol}: ${message}`),
  };

  const title = module.parts.at(-1);
  const description = summarize(module.node);
  const front = ['---', `title: ${yamlString(title)}`];
  if (description) front.push(`description: ${yamlString(description)}`);
  front.push('sidebar:', `  order: ${order}`, '---');

  const blocks = [front.join('\n')];
  blocks.push(
    ...renderDocstring(module.node, context, { skip: ['attributes'] }),
  );

  const attributes = renderAttributes(
    module.node,
    context,
    'Module attributes',
  );
  if (attributes) blocks.push(attributes);

  const exports = reExports(module.node);
  if (exports.length > 0) {
    /* Aliases are rendered where they are defined, not where they are
     * imported; a module that publishes an `__all__` still needs to say what
     * it publishes, so it links instead of duplicating. */
    const rows = exports.map(({ name, target }) => {
      const hit = index.get(target);
      const url = hit
        ? joinUrl(
            options.base,
            `${options.routePrefix}/${hit.modulePath.split('.').join('/')}/`,
          )
        : null;
      return [
        url
          ? `[${name}](${url}${hit.anchor ? `#${hit.anchor}` : ''})`
          : code(name),
        code(target),
      ];
    });
    blocks.push(`**Re-exports**\n\n${table(['Name', 'Source'], rows)}`);
  }

  for (const member of members(module.node, options, ['class', 'function'])) {
    anchors.push(member.path);
    if (member.kind === 'class') {
      for (const nested of members(member, options, ['function'])) {
        if (options.mergeInitIntoClass && nested.name === '__init__') continue;
        anchors.push(nested.path);
      }
      blocks.push(...renderClass(member, context, options.headingLevel));
    } else {
      blocks.push(
        ...renderFunction(member, context, {
          level: options.headingLevel,
          title: member.name,
          isMethod: false,
        }),
      );
    }
  }

  const markdown = `${blocks
    .map((block) => block.trimEnd())
    .filter(Boolean)
    .join('\n\n')}\n`;

  return {
    path: `${module.parts.join('/')}/index.md`,
    route: `${options.routePrefix}/${module.parts.join('/')}/`,
    markdown,
    anchors,
    warnings,
  };
}

/**
 * Render every module and return the pages plus the collected warnings.
 */
export function renderAll(root, options) {
  const modules = collectModules(root);
  const index = buildIndex(modules);
  const pages = [];
  const warnings = [];

  const orders = new Map();
  for (const module of modules) {
    const parent = module.parts.slice(0, -1).join('/');
    const next = (orders.get(parent) ?? 0) + 1;
    orders.set(parent, next);
    const page = renderModule(module, { index, options, order: next });
    pages.push(page);
    warnings.push(...page.warnings);
  }
  return { modules, index, pages, warnings };
}

/* -------------------------------------------------------------------------
 * Sidebar
 * ---------------------------------------------------------------------- */

/**
 * A Starlight sidebar fragment for the generated pages, replacing the
 * literate-nav summary MkDocs built from the same tree.
 *
 * @returns {{ label: string, items: Array<object> }}
 */
export function buildSidebar(root, options) {
  const slug = (parts) => `${options.routePrefix}/${parts.join('/')}`;

  const group = (node, parts) => {
    const children = Object.entries(node.members ?? {})
      .filter(([, m]) => isObject(m) && m.kind === 'module')
      .filter(([name]) => name !== '__main__')
      .sort(([a], [b]) => a.localeCompare(b));

    if (children.length === 0) return { label: node.name, slug: slug(parts) };

    return {
      label: node.name,
      collapsed: true,
      items: [
        { label: 'Overview', slug: slug(parts) },
        ...children.map(([name, child]) => group(child, [...parts, name])),
      ],
    };
  };

  const top = group(root, [root.name]);
  return { label: root.name, items: top.items ?? [top] };
}
