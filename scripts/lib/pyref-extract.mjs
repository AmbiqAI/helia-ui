// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The Python extractor: a griffe JSON dump in, a reference model out.
 *
 * Developed against griffe 1.7.3 (`griffe dump <package> --docstyle google -f`).
 * The dump is a plain tree of objects keyed by name, so the reader here pins
 * the shape it understands rather than trusting whatever version produced the
 * file -- see `parseDump`.
 *
 * Everything that knows about Python stops at this file. It reads the dump,
 * formats signatures the way Python spells them, and folds Google-style
 * docstring sections into the fields of `reference-model.ts`. What routes the
 * pages, resolves cross-references and writes MDX is in `reference-render.mjs`
 * and never sees a griffe node, which is the point: a C or TypeScript
 * extractor ships beside this one and the pages come out identical.
 *
 * The extractor is a pure function of the dump and the options: no filesystem,
 * no process, so the CLI and the tests exercise the same code.
 */

import { code, table } from './markdown.mjs';

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
 * The extraction half of the mkdocstrings options the HELIA product sites use.
 * The half that decides how a page looks lives in `RENDER_DEFAULTS`, because
 * the model is the same whether or not a site shows signatures.
 */
export const DEFAULTS = {
  docstringStyle: 'google',
  mergeInitIntoClass: true,
  membersOrder: 'source',
  filters: ['!^_', '^__init__$'],
  showSignatureAnnotations: true,
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
 * Docstring sections to model fields
 * ---------------------------------------------------------------------- */

const sectionsOf = (node, kind) =>
  (node?.docstring?.parsed ?? []).filter((section) => section.kind === kind);

/**
 * Sections that become fields of the symbol rather than prose in its
 * description. Anything not here and not handled by `describe` is reported: a
 * section this reader has never seen is a gap in the reference, and finding it
 * in a warning beats finding it missing from a page.
 */
const STRUCTURED = new Set([
  'parameters',
  'other parameters',
  'returns',
  'yields',
  'receives',
  'raises',
  'warns',
  'examples',
  'attributes',
  'deprecated',
]);

const entriesOf = (section) =>
  Array.isArray(section.value) ? section.value : [];

/** Drop a key whose value is empty, so the model carries no `"type": ""`. */
const withOptional = (base, extras) => {
  const out = { ...base };
  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
};

function extractParams(node) {
  const out = [];
  for (const kind of ['parameters', 'other parameters']) {
    for (const section of sectionsOf(node, kind)) {
      for (const entry of entriesOf(section)) {
        out.push(
          withOptional(
            {
              name: String(entry.name ?? ''),
              description: entry.description ?? '',
            },
            {
              type: renderExpr(entry.annotation),
              /* griffe writes `null` for "no default", which is the model's
               * "required"; the renderer decides what word to print for it. */
              default:
                entry.value === null || entry.value === undefined
                  ? undefined
                  : renderExpr(entry.value),
            },
          ),
        );
      }
    }
  }
  return out;
}

/*
 * `Yields:` and `Receives:` are returns with a direction, and the model has no
 * field for that direction because only a generator-shaped language has one.
 * An unnamed entry therefore takes the section's own word as its name, which
 * is what the reader needs from the row and what mkdocstrings put in the
 * heading above it.
 */
const RETURN_LABELS = {
  returns: undefined,
  yields: 'yield',
  receives: 'receive',
};

function extractReturns(node) {
  const out = [];
  for (const kind of ['returns', 'yields', 'receives']) {
    for (const section of sectionsOf(node, kind)) {
      for (const entry of entriesOf(section)) {
        out.push(
          withOptional(
            { description: entry.description ?? '' },
            {
              name: entry.name || RETURN_LABELS[kind],
              type: renderExpr(entry.annotation),
            },
          ),
        );
      }
    }
  }
  return out;
}

function extractRaises(node) {
  const out = [];
  for (const kind of ['raises', 'warns']) {
    for (const section of sectionsOf(node, kind)) {
      for (const entry of entriesOf(section)) {
        out.push(
          withOptional(
            { description: entry.description ?? '' },
            { type: renderExpr(entry.annotation) },
          ),
        );
      }
    }
  }
  return out;
}

/*
 * griffe hands back a Google `Examples:` section as alternating prose and code
 * chunks. The model pairs them: prose introduces the snippet that follows it,
 * which is how the section was written and how it reads back.
 */
function extractExamples(node) {
  const out = [];
  let pending;
  for (const section of sectionsOf(node, 'examples')) {
    for (const entry of entriesOf(section)) {
      const [kind, value] = Array.isArray(entry) ? entry : ['text', entry];
      if (kind === 'examples') {
        out.push(
          withOptional(
            { code: String(value).trimEnd(), language: 'python' },
            { description: pending },
          ),
        );
        pending = undefined;
      } else {
        pending = String(value).trim() || undefined;
      }
    }
  }
  return out;
}

function extractDeprecation(node) {
  const section = sectionsOf(node, 'deprecated')[0];
  if (!section) return undefined;
  const version = section.value?.version;
  const description = String(section.value?.description ?? '').trim();
  return [version ? `Since ${version}.` : '', description]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * The symbol's prose: every section that is not a field, in docstring order.
 *
 * Admonitions stay as Starlight directives rather than becoming structure. A
 * `Note:` in a docstring is an aside the author wrote deliberately, and the
 * model has no field for "an aside" that would mean the same thing in C.
 */
function describe(node, context, { skip = [] } = {}) {
  const docstring = node?.docstring;
  if (!docstring) return '';
  if (!Array.isArray(docstring.parsed)) {
    context.warn(
      `docstring was not parsed by griffe (style ${context.options.docstringStyle}?)`,
    );
    return docstring.value ? String(docstring.value) : '';
  }

  const blocks = [];
  for (const section of docstring.parsed) {
    if (skip.includes(section.kind)) continue;
    if (STRUCTURED.has(section.kind)) continue;
    switch (section.kind) {
      case 'text':
        blocks.push(String(section.value ?? ''));
        break;
      case 'admonition': {
        const kind = String(section.value?.annotation ?? 'note').toLowerCase();
        const type = ASIDE_TYPES[kind] ?? 'note';
        const title = String(section.title ?? '');
        const head =
          title && title.toLowerCase() !== type
            ? `:::${type}[${title}]`
            : `:::${type}`;
        blocks.push(`${head}\n${section.value?.description ?? ''}\n\n:::`);
        break;
      }
      case 'modules':
      case 'classes':
      case 'functions': {
        const label = section.kind[0].toUpperCase() + section.kind.slice(1);
        const rows = entriesOf(section).map((entry) => [
          code(entry.name),
          entry.description ?? '',
        ]);
        const rendered = table(['Name', 'Description'], rows);
        if (rendered) blocks.push(`**${label}**\n\n${rendered}`);
        break;
      }
      default:
        context.warn(`unsupported docstring section "${section.kind}"`);
    }
  }
  return blocks
    .map((block) => block.trimEnd())
    .filter(Boolean)
    .join('\n\n');
}

/* -------------------------------------------------------------------------
 * Symbols
 * ---------------------------------------------------------------------- */

/**
 * Where a symbol is written.
 *
 * `filepath` in a dump is the absolute path on the machine that ran griffe, so
 * it is only useful relative to something. Without a `--source-root` the model
 * falls back to the last two segments, which still tells a reader which file
 * to open without pinning someone's home directory into a published artifact.
 */
function sourceOf(node, options) {
  const line = Number.isInteger(node.lineno) ? node.lineno : 1;
  const filepath = typeof node.filepath === 'string' ? node.filepath : '';
  let path = node.path ?? '';
  if (filepath && options.sourceRoot) {
    path = filepath.startsWith(options.sourceRoot)
      ? filepath.slice(options.sourceRoot.length).replace(/^\/+/, '')
      : filepath;
  } else if (filepath) {
    path = filepath.split('/').slice(-2).join('/');
  }
  return withOptional(
    { path, line },
    {
      url: options.sourceUrl
        ? options.sourceUrl
            .replace('{path}', path)
            .replace('{line}', String(line))
        : undefined,
    },
  );
}

/*
 * mkdocstrings shows these labels beside the symbol and the model has no field
 * for them: `classmethod` is a fact about Python, not about APIs. They lead the
 * description as code spans, which is where they read and where the text
 * artifacts keep them.
 */
const labelLine = (node) => {
  const shown = SHOWN_LABELS.filter((label) =>
    (node.labels ?? []).includes(label),
  );
  return shown.length ? shown.map((label) => `\`${label}\``).join(' ') : '';
};

const join = (...blocks) => blocks.filter(Boolean).join('\n\n');

/** The first sentence of a plain string, for an entry that has no docstring. */
function firstSentence(text) {
  const plain = String(text ?? '')
    .trim()
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ');
  return /^(.*?[.!?])(\s|$)/.exec(plain)?.[1] ?? plain;
}

/** A Python attribute, whether it was documented in a section or declared. */
function attributeSymbol(
  { name, id, annotation, value, description, node },
  context,
) {
  const type = renderExpr(annotation);
  const initial = renderExpr(value);
  return {
    id,
    name,
    /* An UPPER_CASE name is the language's own way of saying "constant", and
     * the badge is the one place a reader looks for that. */
    kind: /^[A-Z][A-Z0-9_]*$/.test(name) ? 'constant' : 'attribute',
    language: 'python',
    signature: `${name}${type ? `: ${type}` : ''}${initial ? ` = ${initial}` : ''}`,
    summary: node ? summarize(node) : firstSentence(description),
    description: description ?? '',
    params: [],
    returns: [],
    raises: [],
    examples: [],
    source: node
      ? sourceOf(node, context.options)
      : { path: id.split('.').slice(0, -1).join('/'), line: 1 },
    members: [],
  };
}

/**
 * The attributes of a class or module: the documented `Attributes:` section
 * merged with the declared attribute members, so a dataclass or a pydantic
 * model is complete whichever way its fields were written down.
 */
function extractAttributes(node, context) {
  const documented = new Map();
  for (const section of sectionsOf(node, 'attributes')) {
    for (const entry of entriesOf(section)) documented.set(entry.name, entry);
  }

  const out = [];
  const seen = new Set();
  for (const member of members(node, context.options, ['attribute'])) {
    seen.add(member.name);
    const entry = documented.get(member.name);
    out.push(
      attributeSymbol(
        {
          name: member.name,
          id: member.path ?? `${node.path}.${member.name}`,
          annotation: entry?.annotation ?? member.annotation,
          value: member.value,
          description: entry?.description ?? describe(member, context),
          node: member,
        },
        context,
      ),
    );
  }
  for (const [name, entry] of documented) {
    if (seen.has(name)) continue;
    out.push(
      attributeSymbol(
        {
          name,
          id: `${node.path}.${name}`,
          annotation: entry.annotation,
          description: entry.description ?? '',
        },
        context,
      ),
    );
  }
  return out;
}

function functionSymbol(node, context, { kind, isMethod, name = node.name }) {
  const { options } = context;
  context.state.symbol = node.path;
  return withOptional(
    {
      id: node.path,
      name,
      kind,
      language: 'python',
      signature: renderSignature(name, node, options, { isMethod }),
      summary: summarize(node),
      description: join(labelLine(node), describe(node, context)),
      params: extractParams(node),
      returns: extractReturns(node),
      raises: extractRaises(node),
      examples: extractExamples(node),
      source: sourceOf(node, options),
      members: [],
    },
    { deprecated: extractDeprecation(node) },
  );
}

function classSymbol(node, context) {
  const { options } = context;
  const init = node.members?.__init__;
  const merged = options.mergeInitIntoClass && init?.kind === 'function';
  context.state.symbol = node.path;

  const signature = merged
    ? renderSignature(node.name, init, options, { isMethod: true })
    : `${node.name}()`;

  /* The class docstring and `__init__` both describe the constructor. With
   * merge_init_into_class the class is where the parameters belong, and only
   * one of the two usually carries them; the `__init__` summary is dropped
   * when the class has one of its own, which is the same sentence twice. */
  const classParams = extractParams(node);
  const useInit = merged && classParams.length === 0;
  const initProse =
    useInit && sectionsOf(node, 'text').length === 0
      ? describe(init, context)
      : '';

  const methods = members(node, options, ['function'])
    .filter((member) => !(merged && member.name === '__init__'))
    .map((member) =>
      functionSymbol(member, context, { kind: 'method', isMethod: true }),
    );

  context.state.symbol = node.path;
  return withOptional(
    {
      id: node.path,
      name: node.name,
      kind: 'class',
      language: 'python',
      signature,
      summary: summarize(node),
      description: join(labelLine(node), describe(node, context), initProse),
      params: useInit ? extractParams(init) : classParams,
      returns: useInit ? extractReturns(init) : extractReturns(node),
      raises: useInit ? extractRaises(init) : extractRaises(node),
      examples: extractExamples(node),
      source: sourceOf(node, options),
      members: [...extractAttributes(node, context), ...methods],
    },
    { deprecated: extractDeprecation(node) },
  );
}

/* -------------------------------------------------------------------------
 * Modules
 * ---------------------------------------------------------------------- */

/*
 * A module that publishes `__all__` still has to say what it publishes.
 * Aliases are documented where they are defined, so the list links rather than
 * duplicating, in the model's own cross-reference syntax: the renderer owns
 * routes and turns these into URLs.
 */
function reExportTable(node) {
  const rows = reExports(node).map(({ name, target }) => [
    `[${name}][${target}]`,
    code(target),
  ]);
  const rendered = table(['Name', 'Source'], rows);
  return rendered ? `**Re-exports**\n\n${rendered}` : '';
}

function moduleModel(module, context) {
  const { options } = context;
  const node = module.node;
  context.state.symbol = module.path;

  const symbols = [
    ...extractAttributes(node, context),
    ...members(node, options, ['class', 'function']).map((member) =>
      member.kind === 'class'
        ? classSymbol(member, context)
        : functionSymbol(member, context, {
            kind: 'function',
            isMethod: false,
          }),
    ),
  ];

  context.state.symbol = module.path;
  return {
    path: module.path,
    name: module.parts.at(-1),
    summary: summarize(node),
    description: join(describe(node, context), reExportTable(node)),
    symbols,
    submodules: [],
  };
}

/**
 * Turn a parsed griffe dump into a reference model.
 *
 * @param {object} root The package module from {@link parseDump}.
 * @param {object} [options] Extraction options; see {@link DEFAULTS}.
 * @param {object} [meta] What the caller knows about the run that the dump
 *   cannot say: `sourceCommit`, and the `$schema` the artifacts carry.
 * @returns {{ model: object, warnings: string[] }}
 */
export function extractModel(root, options = DEFAULTS, meta = {}) {
  const warnings = [];
  /* Warnings name the symbol they came from, so `state` is shared by every
   * copy of the context rather than captured when one is spread. */
  const state = { symbol: root.name };
  const context = {
    options: { ...DEFAULTS, ...options },
    state,
    warn: (message) => warnings.push(`${state.symbol}: ${message}`),
  };

  const byPath = new Map();
  for (const module of collectModules(root)) {
    const model = moduleModel(module, context);
    byPath.set(module.path, model);
    const parent = byPath.get(module.parts.slice(0, -1).join('.'));
    if (parent) parent.submodules.push(model);
  }

  const model = withOptional(
    {
      name: root.name,
      language: 'python',
      modules: [byPath.get(root.name)],
    },
    {
      $schema: meta.schema,
      generatedFrom: withOptional(
        { tool: 'pyref', version: GRIFFE_VERSION },
        { sourceCommit: meta.sourceCommit },
      ),
    },
  );

  return { model, warnings };
}
