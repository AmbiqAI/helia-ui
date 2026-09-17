// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The C and C++ extractor: a Doxygen XML directory in, a reference model out.
 *
 * Developed against Doxygen 1.17.0 with GENERATE_XML=YES. Unlike a griffe
 * dump, Doxygen's XML is a schema'd format that ships its own `compound.xsd`,
 * so this reader takes the version from `index.xml` and records it rather than
 * pinning one release and refusing the rest.
 *
 * Everything that knows about C stops at this file. It reads the compounds,
 * formats declarations the way C and C++ spell them, and folds Doxygen's
 * commands onto the fields of `reference-model.ts`. What routes the pages,
 * resolves cross-references and writes MDX is in `reference-render.mjs` and
 * never sees a `memberdef`, which is the point: the Python reference and this
 * one are the same pages with different content.
 *
 * The mapping, in one place:
 *
 *   compound file                 module        one page per header
 *   compound namespace, group     module        claimed before the file's
 *   compound struct, class,       symbol        on the module that declares
 *     union, interface                          it, members nested under it
 *   compound dir, page, example   dropped       navigation, not API surface
 *   memberdef function            function      method inside a class
 *   memberdef variable            attribute     a struct field or a global
 *   memberdef define              macro
 *   memberdef typedef             type
 *   memberdef enum                enum          enumvalue children as members
 *   enumvalue                     constant
 *
 * `extractModel` is a pure function of the parsed dump and the options, so the
 * CLI and the tests exercise the same code. `readDoxygenXml` is the one place
 * that touches the filesystem, because the input is a directory rather than a
 * file and both callers would otherwise write the same walk.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { child, children, descendants, parseXml, textOf } from './xml.mjs';

/** The Doxygen release this reader was written against. */
export const DOXYGEN_VERSION = '1.17.0';

/** Wrap a declaration across lines past this width, as the Python side does. */
const LINE_LENGTH = 120;

/** Frontmatter descriptions are a summary, not the first paragraph. */
const DESCRIPTION_LIMIT = 160;

/** Compound kinds that become a page of their own. */
const MODULE_KINDS = ['group', 'namespace', 'file'];

/** Compound kinds that become a symbol on the module that declares them. */
const SYMBOL_KINDS = {
  struct: 'struct',
  class: 'class',
  union: 'struct',
  interface: 'class',
};

/** `memberdef` kinds this reader understands, and what they become. */
const MEMBER_KINDS = {
  function: 'function',
  variable: 'attribute',
  define: 'macro',
  typedef: 'type',
  enum: 'enum',
  property: 'attribute',
};

/** Doxygen's own admonitions, and the Starlight aside each becomes. */
const ASIDE_TYPES = {
  note: 'note',
  remark: 'note',
  see: 'note',
  par: 'note',
  attention: 'caution',
  warning: 'caution',
  important: 'caution',
  invariant: 'note',
  pre: 'note',
  post: 'note',
};

/** Sections pulled out as model fields rather than left as prose. */
const STRUCTURED = new Set(['return', 'since', 'retval', 'exception']);

/**
 * The extraction half of the options. The half that decides how a reference
 * looks lives in `RENDER_DEFAULTS`.
 */
export const DEFAULTS = {
  /** `c`, `cpp`, or empty to decide from the dump. */
  language: '',
  /** Strip this prefix from the paths Doxygen recorded. */
  sourceRoot: '',
  /** Link template for source, with `{path}` and `{line}`. */
  sourceUrl: '',
  /** The library the reference documents. Empty takes Doxygen's PROJECT_NAME. */
  name: '',
};

export class DoxyrefSchemaError extends Error {}

const schemaHint =
  'The directory must be a Doxygen XML output directory: set GENERATE_XML = YES and XML_PROGRAMLISTING = NO, run doxygen, then point --xml at XML_OUTPUT.';

/* -------------------------------------------------------------------------
 * Reading the directory
 * ---------------------------------------------------------------------- */

/**
 * Parse an already-read Doxygen XML output directory.
 *
 * @param {object} input
 * @param {string} input.index The text of `index.xml`.
 * @param {Map<string, string>} input.compounds Compound XML text, keyed by refid.
 * @param {string} [input.project] PROJECT_NAME, when `Doxyfile.xml` was there.
 * @returns {{ version: string, project: string, compounds: object[] }}
 * @throws {DoxyrefSchemaError} when this is not a Doxygen XML directory.
 */
export function parseDoxygenXml({ index, compounds, project = '' }) {
  let root;
  try {
    root = parseXml(index);
  } catch (error) {
    throw new DoxyrefSchemaError(`index.xml is not XML: ${error.message}`);
  }
  if (root.name !== 'doxygenindex') {
    throw new DoxyrefSchemaError(
      `index.xml has a <${root.name}> root, expected <doxygenindex>. ${schemaHint}`,
    );
  }

  const entries = children(root, 'compound');
  if (entries.length === 0) {
    throw new DoxyrefSchemaError(
      `index.xml lists no compounds, so Doxygen documented nothing. ${schemaHint}`,
    );
  }

  const out = [];
  for (const entry of entries) {
    const refid = entry.attrs.refid ?? '';
    const kind = entry.attrs.kind ?? '';
    if (!MODULE_KINDS.includes(kind) && !Object.hasOwn(SYMBOL_KINDS, kind))
      continue;
    const text = compounds.get(refid);
    /* A compound file that index.xml names but the directory does not hold is
     * a partial dump, not a fatal one: report the gap and keep going, because
     * the pages that can be generated are still worth generating. */
    if (text === undefined) continue;
    const def = child(parseXml(text), 'compounddef');
    if (def) out.push({ refid, kind, def });
  }

  if (out.length === 0) {
    throw new DoxyrefSchemaError(
      `None of the ${entries.length} compounds in index.xml is a file, namespace, group or class. ${schemaHint}`,
    );
  }

  return {
    version: root.attrs.version ?? '',
    project,
    compounds: out,
  };
}

/** PROJECT_NAME out of the `Doxyfile.xml` a run leaves beside its compounds. */
function projectName(text) {
  const root = parseXml(text);
  const option = descendants(root, 'option').find(
    (node) => node.attrs.id === 'PROJECT_NAME',
  );
  return option ? textOf(option).trim() : '';
}

/**
 * Read a Doxygen XML output directory.
 *
 * The one function here that touches the filesystem. It exists because the
 * input is a directory rather than a file, and the CLI and the tests would
 * otherwise each write the same walk.
 *
 * @param {string} dir The `XML_OUTPUT` directory.
 * @returns {Promise<object>} The same shape {@link parseDoxygenXml} returns.
 */
export async function readDoxygenXml(dir) {
  let names;
  try {
    names = await readdir(dir);
  } catch (error) {
    throw new DoxyrefSchemaError(`Could not read ${dir}: ${error.message}`);
  }
  if (!names.includes('index.xml')) {
    throw new DoxyrefSchemaError(`${dir} has no index.xml. ${schemaHint}`);
  }

  const compounds = new Map();
  for (const name of names) {
    if (!name.endsWith('.xml')) continue;
    if (name === 'index.xml' || name === 'Doxyfile.xml') continue;
    compounds.set(name.slice(0, -4), await readFile(join(dir, name), 'utf8'));
  }

  let project = '';
  if (names.includes('Doxyfile.xml')) {
    project = projectName(await readFile(join(dir, 'Doxyfile.xml'), 'utf8'));
  }

  return parseDoxygenXml({
    index: await readFile(join(dir, 'index.xml'), 'utf8'),
    compounds,
    project,
  });
}

/* -------------------------------------------------------------------------
 * Descriptions
 * ---------------------------------------------------------------------- */

const collapse = (text) => text.replace(/\s+/g, ' ');

/** Drop a key whose value is empty, so the model carries no `"type": ""`. */
const withOptional = (base, extras) => {
  const out = { ...base };
  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
};

/** Elements that end the paragraph they appear in rather than flowing in it. */
const BLOCK_TAGS = new Set([
  'blockquote',
  'heading',
  'itemizedlist',
  'orderedlist',
  'para',
  'parameterlist',
  'parblock',
  'programlisting',
  'simplesect',
  'table',
  'variablelist',
  'verbatim',
  'xrefsect',
]);

/** Elements with nothing a reader needs: markup for another output format. */
const DROPPED = new Set([
  'anchor',
  'htmlonly',
  'latexonly',
  'manonly',
  'rtfonly',
  'docbookonly',
  'xmlonly',
  'indexentry',
  'internal',
]);

/*
 * A `programlisting` back to the source it was written from.
 *
 * Indentation in a code block is not decoration, and Doxygen does not put it
 * in the text: every run of spaces is an `<sp/>`, with `value` for a run
 * longer than one. Reading the text alone yields code with no whitespace at
 * all, which compiles in neither C nor the reader's head.
 */
function listing(node) {
  const render = (part) => {
    if (typeof part === 'string') return part;
    if (part.name === 'sp') return ' '.repeat(Number(part.attrs.value) || 1);
    return (part.children ?? []).map(render).join('');
  };
  return children(node, 'codeline')
    .map((line) => render(line).trimEnd())
    .join('\n')
    .replace(/\s+$/, '');
}

/**
 * Inline content as Markdown.
 *
 * Whitespace is collapsed: Doxygen wraps prose at whatever column the comment
 * was written to, and those line breaks are an artifact of the source file
 * rather than something the author meant.
 */
function inline(node, context) {
  let out = '';
  for (const part of node.children ?? []) {
    if (typeof part === 'string') {
      out += collapse(part);
      continue;
    }
    const { name, attrs } = part;
    if (DROPPED.has(name)) continue;
    switch (name) {
      case 'computeroutput':
      case 'ref':
        /* A `ref` is a cross-reference to another symbol and the model has no
         * field for one, so it renders as the identifier in code. The renderer
         * owns routes and resolves `[Text][target]`; Doxygen's refids are
         * output-file names rather than model ids, so they cannot become one
         * here without the renderer learning about Doxygen. */
        out += `\`${collapse(textOf(part)).trim()}\``;
        break;
      case 'bold':
      case 'strong':
        out += `**${inline(part, context).trim()}**`;
        break;
      case 'emphasis':
        out += `*${inline(part, context).trim()}*`;
        break;
      case 'strike':
        out += `~~${inline(part, context).trim()}~~`;
        break;
      case 'ulink':
        out += `[${inline(part, context).trim()}](${attrs.url ?? ''})`;
        break;
      case 'linebreak':
        out += '\n';
        break;
      case 'nonbreakablespace':
        out += '\u00a0';
        break;
      case 'sp':
        out += ' ';
        break;
      case 'formula':
        out += collapse(textOf(part)).trim();
        break;
      case 'image':
        context.warn('an image in a description was dropped');
        break;
      default:
        out += inline(part, context);
    }
  }
  return out;
}

const heading = (node, context) =>
  `${'#'.repeat(Math.min(6, Number(node.attrs.level) || 1))} ${inline(node, context).trim()}`;

function listBlock(node, context, ordered) {
  const items = children(node, 'listitem').map((item, i) => {
    const marker = ordered ? `${i + 1}.` : '-';
    const body = blocks(item, context).join('\n\n');
    const pad = ' '.repeat(marker.length + 1);
    return `${marker} ${body.split('\n').join(`\n${pad}`)}`;
  });
  return items.join('\n');
}

function tableBlock(node, context) {
  const rows = children(node, 'row').map((row) =>
    children(row, 'entry').map((entry) =>
      collapse(blocks(entry, context).join(' ')).replace(/\|/g, '\\|').trim(),
    ),
  );
  if (rows.length === 0) return '';
  const [head, ...body] = rows;
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

/**
 * Block content as Markdown.
 *
 * `parameterlist`, and the `simplesect` kinds in `STRUCTURED`, are collected
 * into `context.fields` instead of rendered: they are model fields, and the
 * renderer draws them as tables beside every other language's.
 */
function blocks(node, context) {
  const out = [];
  let run = '';
  const flush = () => {
    const text = run.replace(/[ \t]+$/gm, '').trim();
    if (text) out.push(text);
    run = '';
  };

  for (const part of node.children ?? []) {
    if (typeof part === 'string') {
      run += collapse(part);
      continue;
    }
    if (DROPPED.has(part.name)) continue;
    if (!BLOCK_TAGS.has(part.name)) {
      run += inline({ children: [part] }, context);
      continue;
    }
    flush();
    switch (part.name) {
      case 'para':
      case 'parblock':
        out.push(...blocks(part, context));
        break;
      case 'programlisting':
        out.push(
          `\`\`\`${part.attrs.filename?.replace(/^\./, '') || context.language}\n${listing(part)}\n\`\`\``,
        );
        break;
      case 'verbatim':
        out.push(`\`\`\`\n${textOf(part).replace(/\s+$/, '')}\n\`\`\``);
        break;
      case 'itemizedlist':
        out.push(listBlock(part, context, false));
        break;
      case 'orderedlist':
        out.push(listBlock(part, context, true));
        break;
      case 'variablelist':
        out.push(...blocks(part, context));
        break;
      case 'heading':
        out.push(heading(part, context));
        break;
      case 'table':
        out.push(tableBlock(part, context));
        break;
      case 'blockquote':
        out.push(
          blocks(part, context)
            .join('\n\n')
            .split('\n')
            .map((line) => `> ${line}`.trimEnd())
            .join('\n'),
        );
        break;
      case 'parameterlist':
        collectParameterList(part, context);
        break;
      case 'xrefsect':
        collectXrefSect(part, context);
        break;
      case 'simplesect': {
        const kind = part.attrs.kind ?? '';
        if (STRUCTURED.has(kind)) {
          collectSimpleSect(kind, part, context);
          break;
        }
        const type = ASIDE_TYPES[kind] ?? 'note';
        const title =
          collapse(textOf(child(part, 'title') ?? { children: [] })).trim() ||
          (kind === 'see' ? 'See also' : '');
        const body = blocks(
          { children: children(part).filter((c) => c.name !== 'title') },
          context,
        ).join('\n\n');
        if (body) {
          out.push(
            `${title ? `:::${type}[${title}]` : `:::${type}`}\n${body}\n\n:::`,
          );
        }
        break;
      }
      default:
        out.push(...blocks(part, context));
    }
  }
  flush();
  return out;
}

function collectParameterList(node, context) {
  const kind = node.attrs.kind ?? 'param';
  for (const item of children(node, 'parameteritem')) {
    const description = blocks(
      child(item, 'parameterdescription') ?? { children: [] },
      context,
    )
      .join('\n\n')
      .trim();
    for (const list of children(item, 'parameternamelist')) {
      for (const named of children(list, 'parametername')) {
        const name = collapse(textOf(named)).trim();
        const direction = named.attrs.direction;
        if (kind === 'exception') {
          context.fields.raises.push(
            withOptional({ description }, { type: name }),
          );
        } else if (kind === 'retval') {
          context.fields.returns.push(withOptional({ description }, { name }));
        } else {
          context.fields.params.set(
            name,
            withOptional({ description }, { direction }),
          );
        }
      }
      /* `@param` with no name at all is a typo in the comment; it would
       * otherwise become a nameless row nobody can match to an argument. */
      if (children(list, 'parametername').length === 0)
        context.warn(`a ${kind} entry has no name`);
    }
  }
}

function collectSimpleSect(kind, node, context) {
  const body = blocks(
    { children: children(node).filter((c) => c.name !== 'title') },
    context,
  )
    .join('\n\n')
    .trim();
  if (kind === 'return') context.fields.returns.push({ description: body });
  else if (kind === 'since') context.fields.since = collapse(body).trim();
  else if (kind === 'exception')
    context.fields.raises.push({ description: body });
}

function collectXrefSect(node, context) {
  const title = collapse(textOf(child(node, 'xreftitle') ?? {})).trim();
  const body = blocks(
    child(node, 'xrefdescription') ?? { children: [] },
    context,
  )
    .join('\n\n')
    .trim();
  if (/^deprecated$/i.test(title)) context.fields.deprecated = body;
  else if (body) context.fields.note.push(`:::note[${title}]\n${body}\n\n:::`);
}

/**
 * A member's or compound's documentation, split into prose and model fields.
 *
 * @returns {{ description: string, summary: string, fields: object }}
 */
function document(node, context) {
  const fields = {
    params: new Map(),
    returns: [],
    raises: [],
    note: [],
    since: undefined,
    deprecated: undefined,
  };
  const inner = { ...context, fields };

  const brief = blocks(
    child(node, 'briefdescription') ?? { children: [] },
    inner,
  )
    .join('\n\n')
    .trim();
  const detail = blocks(
    child(node, 'detaileddescription') ?? { children: [] },
    inner,
  )
    .join('\n\n')
    .trim();

  /* Doxygen also emits a `<deprecated>` element in place of the xrefsect when
   * the deprecation list is switched off, so both spellings are read. */
  const element = child(node, 'deprecated');
  if (element && fields.deprecated === undefined) {
    fields.deprecated = blocks(element, inner).join('\n\n').trim();
  }

  const description = [brief, detail, ...fields.note]
    .filter(Boolean)
    .join('\n\n');

  return { description, summary: summarize(brief || detail), fields };
}

/** The first sentence of a description, for the member index and frontmatter. */
export function summarize(text) {
  const plain = collapse(String(text ?? '').split(/\n\s*\n/)[0])
    .replace(/^#+\s*/, '')
    .replace(/[*`_]/g, '')
    .trim();
  const sentence = /^(.*?[.!?])(\s|$)/.exec(plain)?.[1] ?? plain;
  return sentence.length > DESCRIPTION_LIMIT
    ? `${sentence.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : sentence;
}

/* -------------------------------------------------------------------------
 * Declarations
 * ---------------------------------------------------------------------- */

const typeText = (node) => collapse(textOf(node ?? {})).trim();

/** The declared parameters of a `memberdef`, before the docs are merged in. */
function declaredParams(node) {
  return children(node, 'param').map((param) => {
    const name =
      typeText(child(param, 'declname')) || typeText(child(param, 'defname'));
    return withOptional(
      { name },
      {
        type: typeText(child(param, 'type')),
        default: typeText(child(param, 'defval')),
      },
    );
  });
}

/**
 * A function declaration, wrapped one parameter per line when the single-line
 * form would run past the line length.
 */
function functionSignature(node) {
  const returnType = typeText(child(node, 'type'));
  const name = typeText(child(node, 'name'));
  const lead = typeText(child(node, 'definition')) || `${returnType} ${name}`;
  const args = declaredParams(node).map((param) =>
    /* A pointer type already ends in `*`, so a space would read as a
     * multiplication rather than as part of the type. */
    param.type
      ? `${param.type}${param.type.endsWith('*') || param.type.endsWith('&') ? '' : ' '}${param.name}${param.default ? ` = ${param.default}` : ''}`
      : param.name,
  );
  const qualifiers = [
    node.attrs.const === 'yes' ? 'const' : '',
    typeText(child(node, 'exceptions')),
  ]
    .filter(Boolean)
    .join(' ');
  const tail = qualifiers ? ` ${qualifiers}` : '';
  const oneLine = `${lead}(${args.join(', ')})${tail}`;
  if (oneLine.length <= LINE_LENGTH || args.length === 0) return oneLine;
  return `${lead}(\n${args.map((arg) => `    ${arg}`).join(',\n')}\n)${tail}`;
}

function memberSignature(node, kind) {
  const name = typeText(child(node, 'name'));
  const type = typeText(child(node, 'type'));
  const initializer = typeText(child(node, 'initializer'));
  switch (kind) {
    case 'function':
      return functionSignature(node);
    case 'macro': {
      const params = children(node, 'param').map((param) =>
        typeText(child(param, 'defname')),
      );
      const args = params.length > 0 ? `(${params.join(', ')})` : '';
      return `#define ${name}${args}${initializer ? ` ${initializer}` : ''}`;
    }
    case 'type':
      return typeText(child(node, 'definition')) || `typedef ${type} ${name}`;
    case 'enum':
      return `enum ${name}`;
    default: {
      const args = typeText(child(node, 'argsstring'));
      return [type, `${name}${args}`].filter(Boolean).join(' ');
    }
  }
}

/* -------------------------------------------------------------------------
 * Symbols
 * ---------------------------------------------------------------------- */

function sourceOf(node, context) {
  const location = child(node, 'location');
  const path = locationPath(location?.attrs.file ?? '', context.options);
  const line = Number(location?.attrs.line ?? location?.attrs.declline);
  const at = Number.isInteger(line) && line > 0 ? line : 1;
  return withOptional(
    { path, line: at },
    {
      url: context.options.sourceUrl
        ? context.options.sourceUrl
            .replace('{path}', path)
            .replace('{line}', String(at))
        : undefined,
    },
  );
}

/** A path Doxygen recorded, made relative to the repository it came from. */
function locationPath(file, options) {
  const normalized = file.replace(/\\/g, '/');
  if (options.sourceRoot && normalized.startsWith(options.sourceRoot)) {
    return normalized.slice(options.sourceRoot.length).replace(/^\/+/, '');
  }
  return normalized.replace(/^\/+/, '');
}

/** The id an enumerator is known by, which depends on whether it has a scope. */
const enumValueId = (member, enumId, scoped) =>
  scoped ? `${enumId}::${member}` : member;

function enumValues(node, id, context, scoped) {
  return children(node, 'enumvalue').map((value) => {
    const name = typeText(child(value, 'name'));
    const initializer = typeText(child(value, 'initializer'));
    const { description, summary } = document(value, context);
    return {
      id: enumValueId(name, id, scoped),
      name,
      kind: 'constant',
      language: context.language,
      signature: `${name}${initializer ? ` ${initializer}` : ''}`,
      summary,
      description,
      params: [],
      returns: [],
      raises: [],
      examples: [],
      source: context.source,
      members: [],
    };
  });
}

/** One `memberdef` as a symbol, with its documented parameters merged in. */
function memberSymbol(node, context, scope) {
  const kind = MEMBER_KINDS[node.attrs.kind];
  if (!kind) {
    context.warn(`unsupported memberdef kind "${node.attrs.kind}"`);
    return null;
  }
  const name = typeText(child(node, 'name'));
  if (!name) return null;

  const qualified = typeText(child(node, 'qualifiedname'));
  const id = qualified || (scope ? `${scope}::${name}` : name);
  const inner = context.scoped(id);
  const { description, summary, fields } = document(node, inner);

  /* The declaration is the authority on which parameters exist and what they
   * are typed; the comment is the authority on what they mean. A documented
   * name the declaration does not have is a stale comment, and it is reported
   * rather than added as a row for an argument nobody can pass. */
  const declared = declaredParams(node);
  const params = declared.map((param) => {
    const documented = fields.params.get(param.name);
    return { ...param, description: '', ...documented, name: param.name };
  });
  for (const documented of fields.params.keys()) {
    if (!declared.some((param) => param.name === documented))
      inner.warn(`documents a parameter "${documented}" it does not declare`);
  }

  const source = sourceOf(node, context);
  return withOptional(
    {
      id,
      name,
      kind: kind === 'function' && scope ? 'method' : kind,
      language: context.language,
      signature: memberSignature(node, kind),
      summary,
      description,
      params: kind === 'function' || kind === 'macro' ? params : [],
      returns: fields.returns,
      raises: fields.raises,
      examples: [],
      source,
      members:
        kind === 'enum'
          ? enumValues(
              node,
              id,
              { ...inner, source },
              node.attrs.strong === 'yes' || Boolean(scope),
            )
          : [],
    },
    { since: fields.since, deprecated: fields.deprecated },
  );
}

/** Every `memberdef` of a compound, in the order the source declares them. */
function compoundMembers(def, context, scope) {
  const out = [];
  for (const section of children(def, 'sectiondef')) {
    /* Private and package members are implementation, not API surface. The
     * Doxyfile decides what is emitted at all; this only declines to publish
     * what Doxygen itself marked as not part of the interface. */
    if (/private|package/.test(section.attrs.kind ?? '')) continue;
    for (const member of children(section, 'memberdef')) {
      if (member.attrs.prot === 'private') continue;
      const symbol = memberSymbol(member, context, scope);
      if (symbol) out.push({ symbol, line: symbol.source.line });
    }
  }
  return out.sort((a, b) => a.line - b.line).map((entry) => entry.symbol);
}

/** A struct, class, union or interface compound as a symbol. */
function compoundSymbol(compound, context, nested) {
  const { def } = compound;
  const name = typeText(child(def, 'compoundname'));
  const inner = context.scoped(name);
  const { description, summary, fields } = document(def, inner);
  const kind = SYMBOL_KINDS[compound.kind];
  const short = name.split('::').pop();

  return withOptional(
    {
      id: name,
      name: short,
      kind,
      language: context.language,
      signature: `${compound.kind} ${short}`,
      summary,
      description,
      params: [],
      returns: [],
      raises: [],
      examples: [],
      source: sourceOf(def, context),
      members: [...compoundMembers(def, inner, name), ...nested],
    },
    { since: fields.since, deprecated: fields.deprecated },
  );
}

/* -------------------------------------------------------------------------
 * Modules
 * ---------------------------------------------------------------------- */

/** A path segment that survives being split back out of a dotted module path. */
const segment = (text) =>
  text
    .replace(/[^\w.-]+/g, '-')
    .replace(/\./g, '_')
    .replace(/^-+|-+$/g, '') || 'x';

/**
 * The route identity of a documented header.
 *
 * The renderer splits a module path on dots, which is Python's spelling of a
 * package. A header has no such name, so its path is its directory and base
 * name dotted together and the extension is dropped from the path but kept in
 * the title: `src/helia_sample.h` is `helia_sample` at
 * `reference/api/<library>/helia_sample/`, titled `helia_sample.h`.
 */
function headerIdentity(file) {
  const parts = file.split('/').filter((part) => part && part !== '.');
  const base = parts.pop() ?? 'header';
  const stem = base.replace(/\.[^.]+$/, '');
  return { dirs: parts, stem, title: base };
}

/**
 * Drop the directory prefix every documented header shares.
 *
 * `src/` or `include/` is how a repository is laid out, not part of any API,
 * and repeating it in every route buys a reader nothing.
 */
function commonPrefix(identities) {
  if (identities.length === 0) return 0;
  const first = identities[0].dirs;
  let shared = 0;
  while (shared < first.length) {
    const part = first[shared];
    if (!identities.every((entry) => entry.dirs[shared] === part)) break;
    shared += 1;
  }
  return shared;
}

/** The language the reference is in, when the caller did not say. */
function detectLanguage(compounds) {
  const declared = compounds
    .map((compound) => compound.def.attrs.language)
    .filter(Boolean);
  if (declared.some((language) => language === 'C')) return 'c';
  /* Doxygen labels a `.h` file C++ whatever is in it, so the attribute alone
   * would call every C project C++. A dump with no class and no namespace, out
   * of files that are all C translation units or headers, is C. */
  const hasCppOnly = compounds.some((compound) =>
    ['class', 'namespace', 'interface'].includes(compound.kind),
  );
  const files = compounds.filter((compound) => compound.kind === 'file');
  const allC =
    files.length > 0 &&
    files.every((compound) =>
      /\.(c|h)$/i.test(typeText(child(compound.def, 'compoundname'))),
    );
  return !hasCppOnly && allC ? 'c' : 'cpp';
}

/**
 * Turn a parsed Doxygen dump into a reference model.
 *
 * @param {object} dump From {@link parseDoxygenXml} or {@link readDoxygenXml}.
 * @param {object} [options] Extraction options; see {@link DEFAULTS}.
 * @param {object} [meta] What the caller knows that the dump cannot say:
 *   `sourceCommit`, and the `$schema` the artifacts carry.
 * @returns {{ model: object, warnings: string[] }}
 */
export function extractModel(dump, options = DEFAULTS, meta = {}) {
  const resolved = { ...DEFAULTS, ...options };
  const warnings = [];
  const language = resolved.language || detectLanguage(dump.compounds);
  /* A warning names the symbol it came from, so every context carries the
   * factory that makes the next one: a member reads its own documentation and
   * reports against its own id rather than against whichever page it was
   * reached through. */
  const scoped = (subject) => ({
    options: resolved,
    language,
    scoped,
    warn: (message) => warnings.push(`${subject}: ${message}`),
  });

  const modules = dump.compounds.filter((compound) =>
    MODULE_KINDS.includes(compound.kind),
  );
  const classes = dump.compounds.filter((compound) =>
    Object.hasOwn(SYMBOL_KINDS, compound.kind),
  );

  const headers = modules.filter((compound) => compound.kind === 'file');
  const identities = new Map(
    headers.map((compound) => [
      compound.refid,
      headerIdentity(
        locationPath(
          child(compound.def, 'location')?.attrs.file ??
            typeText(child(compound.def, 'compoundname')),
          resolved,
        ),
      ),
    ]),
  );
  const shared = commonPrefix([...identities.values()]);

  const rootName = resolved.name || dump.project || 'reference';
  const rootPath = segment(rootName);

  /** Where a module sits in the tree, and what its page is called. */
  const placement = (compound) => {
    const name = typeText(child(compound.def, 'compoundname'));
    if (compound.kind === 'file') {
      const { dirs, stem, title } = identities.get(compound.refid);
      return {
        parts: [...dirs.slice(shared), stem].map(segment),
        title,
      };
    }
    if (compound.kind === 'namespace') {
      return { parts: name.split('::').map(segment), title: name };
    }
    const heading = typeText(child(compound.def, 'title'));
    return { parts: [segment(name)], title: heading || name };
  };

  /* A grouped member is emitted by Doxygen under its group and again under the
   * file that declares it. The author's grouping is the deliberate structure,
   * so a group claims a member first and the file page shows what is left. */
  const rank = { group: 0, namespace: 1, file: 2 };
  const ordered = [...modules].sort(
    (a, b) => rank[a.kind] - rank[b.kind] || a.refid.localeCompare(b.refid),
  );

  const claimedMembers = new Set();
  const claimedClasses = new Set();
  const byPath = new Map();

  const root = {
    path: rootPath,
    name: rootName,
    summary: '',
    description: '',
    symbols: [],
    submodules: [],
  };
  byPath.set(rootPath, root);

  /** Create the intermediate modules a nested route needs, once each. */
  const ensure = (parts, title) => {
    let path = rootPath;
    let node = root;
    for (const [depth, part] of parts.entries()) {
      path = `${path}.${part}`;
      let next = byPath.get(path);
      if (!next) {
        next = {
          path,
          name: depth === parts.length - 1 ? title : part,
          summary: '',
          description: '',
          symbols: [],
          submodules: [],
        };
        byPath.set(path, next);
        node.submodules.push(next);
      }
      node = next;
    }
    return node;
  };

  /** Class compounds nested inside another class, keyed by the outer one. */
  const nestedOf = new Map();
  const byName = new Map(
    classes.map((compound) => [
      typeText(child(compound.def, 'compoundname')),
      compound,
    ]),
  );
  for (const compound of classes) {
    for (const inner of children(compound.def, 'innerclass')) {
      const target = byName.get(typeText(inner));
      if (target && target !== compound) {
        nestedOf.set(target.refid, compound.refid);
        claimedClasses.add(target.refid);
      }
    }
  }

  const classSymbol = (compound) => {
    const nested = classes
      .filter((other) => nestedOf.get(other.refid) === compound.refid)
      .map((other) => classSymbol(other));
    return compoundSymbol(
      compound,
      scoped(typeText(child(compound.def, 'compoundname'))),
      nested,
    );
  };

  for (const compound of ordered) {
    const { parts, title } = placement(compound);
    const target = parts.length === 0 ? root : ensure(parts, title);

    const documented = document(compound.def, scoped(target.path));
    if (!target.description) {
      target.summary = documented.summary;
      target.description = documented.description;
    }

    const symbols = [];
    for (const inner of children(compound.def, 'innerclass')) {
      const found = byName.get(typeText(inner));
      if (!found || claimedClasses.has(found.refid)) continue;
      claimedClasses.add(found.refid);
      symbols.push(classSymbol(found));
    }
    for (const symbol of compoundMembers(compound.def, scoped(target.path))) {
      if (claimedMembers.has(symbol.id)) continue;
      claimedMembers.add(symbol.id);
      symbols.push(symbol);
    }
    target.symbols.push(...symbols);
  }

  /* A class Doxygen documented but no compound declares still belongs on a
   * page; it lands on the module its own location names, or on the root. */
  for (const compound of classes) {
    if (claimedClasses.has(compound.refid)) continue;
    claimedClasses.add(compound.refid);
    const file = locationPath(
      child(compound.def, 'location')?.attrs.file ?? '',
      resolved,
    );
    const { dirs, stem, title } = headerIdentity(file);
    const target = file
      ? ensure([...dirs.slice(shared), stem].map(segment), title)
      : root;
    target.symbols.push(classSymbol(compound));
  }

  /* An id is the page anchor, so two symbols cannot share one. Two static
   * functions with the same name in different translation units genuinely do,
   * and qualifying the later one by its page keeps both reachable. */
  const seen = new Set();
  for (const module of byPath.values()) {
    const visit = (symbol) => {
      if (seen.has(symbol.id)) {
        const unique = `${module.path}::${symbol.id}`;
        warnings.push(`${module.path}: duplicate id ${symbol.id}`);
        symbol.id = unique;
      }
      seen.add(symbol.id);
      for (const member of symbol.members) visit(member);
    };
    for (const symbol of module.symbols) visit(symbol);
  }

  /* A file whose every member a group claimed has nothing left to show. */
  const prune = (module) => {
    module.submodules = module.submodules.filter(prune);
    return (
      module === root ||
      module.symbols.length > 0 ||
      module.submodules.length > 0 ||
      Boolean(module.description)
    );
  };
  prune(root);

  const model = withOptional(
    { name: rootName, language, modules: [root] },
    {
      $schema: meta.schema,
      generatedFrom: withOptional(
        { tool: 'doxyref', version: dump.version || DOXYGEN_VERSION },
        { sourceCommit: meta.sourceCommit },
      ),
    },
  );

  return { model, warnings };
}
