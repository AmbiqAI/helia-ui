// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * A reference model in, a published reference out: MDX pages that compose the
 * `Ref*` parts, the JSON the model itself is, and the two text artifacts an
 * agent reads instead of the pages.
 *
 * Nothing here knows a language. Every input is a field of `reference-model.ts`
 * and every output is a function of it, so the Python, C and TypeScript
 * references are the same pages with different content rather than three
 * renderers that drifted.
 *
 * The JSON is the source of truth and the pages are a view of it. That ordering
 * is why the model is written out whole and per module, with sorted keys and no
 * timestamp: an artifact that changes when nothing changed is one nobody can
 * diff, and a reference whose consumer has to scrape HTML is one that breaks
 * every time the design moves.
 *
 * The renderer is a pure function of the model and the options: no filesystem,
 * no process, so the CLI and the tests exercise the same code.
 */

import { escapeMdx, mapOutsideCode, mapProse, table } from './markdown.mjs';

/** The schema identifier the artifacts carry. Mirrors `reference-model.ts`. */
export const REFERENCE_MODEL_SCHEMA =
  'https://ambiqai.github.io/helia-ui/schema/reference-model-1.json';

/** Frontmatter descriptions are a summary, not the first paragraph. */
const DESCRIPTION_LIMIT = 160;

/**
 * The half of the options that decides how a reference looks. The half that
 * decides what is in it lives with each extractor.
 */
export const RENDER_DEFAULTS = {
  /** Site base path, for every URL the pages and artifacts carry. */
  base: '/',
  /** Where the pages live under the content root, and under `public/`. */
  routePrefix: 'reference/api',
  /** Rank of a symbol heading. Members sit one below it. */
  headingLevel: 2,
  /** Whether a symbol shows its signature. */
  showSignature: true,
  /** Passed through for mkdocstrings compatibility; the parts have no second form. */
  separateSignature: true,
  /** Whether the package's own page repeats its name as a heading. */
  showRootHeading: false,
  /** Table density on generated pages, which are long. */
  density: 'compact',
  /** Origin for the absolute URLs in `llms.txt`. Without it they are site-root relative. */
  site: '',
};

/** The parts a generated page composes, and where they come from. */
const PART_IMPORTS = [
  ['RefMembers', '@ambiqai/helia-ui/astro/RefMembers'],
  ['RefParams', '@ambiqai/helia-ui/astro/RefParams'],
  ['RefSection', '@ambiqai/helia-ui/astro/RefSection'],
  ['RefSymbol', '@ambiqai/helia-ui/astro/RefSymbol'],
];

/* -------------------------------------------------------------------------
 * Paths and URLs
 * ---------------------------------------------------------------------- */

/** A base path is always absolute and always ends in a slash. */
export function normalizeBase(base) {
  if (!base || base === '/') return '/';
  const withLead = base.startsWith('/') ? base : `/${base}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}

const segmentsOf = (modulePath) => modulePath.split('.');

/*
 * The characters github-slugger drops: the ASCII punctuation either side of
 * `-` and `_`, the control range, and the Unicode spaces. Everything an
 * identifier can hold is in here; the emoji ranges the library also strips are
 * not, because a module path that carries one has a worse problem than its
 * route.
 */
const SLUG_STRIP =
  /[\0-\x1F!-,.\/:-@\[-\^`\{-~\x7F-\x9F\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g;

/**
 * One route segment, spelled the way the site will serve it.
 *
 * Starlight routes a page by the content id Astro derives from its file path,
 * which is github-slugger's `slug()` over each segment: lowercased, with that
 * punctuation removed and spaces hyphenated. A generator that emits the module
 * name as written instead links to a route nobody serves, and on a
 * case-insensitive filesystem the pages directory and the artifact directory
 * collide. The rule is inlined rather than imported because these scripts run
 * in a product repository's CI with nothing installed but this package.
 */
export const slugSegment = (text) =>
  String(text).toLowerCase().replace(SLUG_STRIP, '').replace(/ /g, '-');

const routeSegments = (modulePath) => segmentsOf(modulePath).map(slugSegment);

const joinUrl = (base, tail) => `${base.replace(/\/$/, '')}/${tail}`;

/** Every module of a model, parents before children, as the pages are ordered. */
export function flatten(model) {
  const out = [];
  const visit = (module) => {
    out.push(module);
    for (const child of module.submodules ?? []) visit(child);
  };
  for (const module of model.modules ?? []) visit(module);
  return out;
}

/** Every symbol on a module, parents before members, as the page renders them. */
export function flattenSymbols(module) {
  const out = [];
  const visit = (symbol) => {
    out.push(symbol);
    for (const member of symbol.members ?? []) visit(member);
  };
  for (const symbol of module.symbols ?? []) visit(symbol);
  return out;
}

const routes = (modulePath, options) => {
  const parts = routeSegments(modulePath);
  return {
    /** Page route, for a link from another page. */
    page: joinUrl(options.base, `${options.routePrefix}/${parts.join('/')}/`),
    /** The module's own JSON, served out of `public/`. */
    json: joinUrl(
      options.base,
      `${options.routePrefix}/${parts.join('/')}.json`,
    ),
    /** Content path, relative to the `--out` directory. */
    file: `${parts.join('/')}/index.mdx`,
    /** Artifact path, relative to the `public/` directory. */
    artifact: `${options.routePrefix}/${parts.join('/')}.json`,
  };
};

/* -------------------------------------------------------------------------
 * Preconditions
 * ---------------------------------------------------------------------- */

export class ReferenceRenderError extends Error {}

/*
 * Not a second copy of the model schema: `reference-model.ts` says what a model
 * is, and a consumer that cares validates against it. This checks only what the
 * renderer is about to dereference, so a malformed model fails naming the
 * module it failed on instead of throwing from inside a template.
 */
function assertRenderable(model) {
  if (!model || typeof model !== 'object' || Array.isArray(model))
    throw new ReferenceRenderError('The model must be an object.');
  if (!Array.isArray(model.modules) || model.modules.length === 0)
    throw new ReferenceRenderError('The model has no modules.');
  for (const module of flatten(model)) {
    if (typeof module.path !== 'string' || module.path.length === 0)
      throw new ReferenceRenderError('A module has no path.');
    if (!Array.isArray(module.symbols))
      throw new ReferenceRenderError(
        `${module.path}: symbols is not an array.`,
      );
    for (const symbol of flattenSymbols(module)) {
      for (const key of ['id', 'name', 'kind', 'language', 'signature']) {
        if (typeof symbol[key] !== 'string' || symbol[key].length === 0) {
          throw new ReferenceRenderError(
            `${module.path}: a symbol is missing ${key}.`,
          );
        }
      }
    }
  }
}

/* -------------------------------------------------------------------------
 * Cross-references
 * ---------------------------------------------------------------------- */

const CROSSREF = /\[([^\]\n]+)\]\[([^\]\n]*)\]/g;

/**
 * Map every id in the model to the page that carries it.
 *
 * Extractors leave `[Text][target]` in descriptions because only the renderer
 * knows the routes. A module resolves to its page and a symbol to its page plus
 * its own id as the fragment, which is the anchor `RefSymbol` renders.
 */
export function buildIndex(model, options) {
  const index = new Map();
  for (const module of flatten(model)) {
    index.set(module.path, { modulePath: module.path, anchor: null });
    for (const symbol of flattenSymbols(module)) {
      index.set(symbol.id, { modulePath: module.path, anchor: symbol.id });
    }
  }
  return {
    url(target, currentModule) {
      const wanted = target.trim();
      const hit =
        index.get(wanted) ??
        (currentModule ? index.get(`${currentModule}.${wanted}`) : undefined);
      if (!hit) return null;
      const { page } = routes(hit.modulePath, options);
      return hit.anchor ? `${page}#${hit.anchor}` : page;
    },
  };
}

/** True when an offset falls inside a backtick span on its line. */
function isInsideCode(text, offset) {
  const start = text.lastIndexOf('\n', offset) + 1;
  const ticks = (text.slice(start, offset).match(/`/g) ?? []).length;
  return ticks % 2 === 1;
}

/**
 * Rewrite `[Text][target]` cross-references to site URLs.
 *
 * An unresolved reference keeps its text and is reported rather than left as a
 * dead link, which is what MkDocs did with `autorefs`.
 */
export function resolveCrossRefs(text, context) {
  const { index, currentModule, warn } = context;
  return mapProse(text, (prose) =>
    prose.replace(CROSSREF, (match, label, target, offset, whole) => {
      if (isInsideCode(whole, offset)) return match;
      const url = index.url(target.trim() || label.trim(), currentModule);
      if (!url) {
        warn(`unresolved cross-reference [${label}][${target}]`);
        return label;
      }
      return `[${label}](${url})`;
    }),
  );
}

/**
 * Shift Markdown headings in a description so the shallowest sits below the
 * symbol's own heading. A docstring that opens with an `<h1>` would otherwise
 * outrank the page title, and Starlight builds its table of contents from the
 * document.
 */
export function shiftHeadings(text, level) {
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

/* -------------------------------------------------------------------------
 * Text
 * ---------------------------------------------------------------------- */

/** YAML double-quoted scalar: safe for any summary. */
const yamlString = (value) =>
  `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim()}"`;

/** A summary trimmed to fit a `<meta name="description">`. */
function metaDescription(summary) {
  const plain = String(summary ?? '')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > DESCRIPTION_LIMIT
    ? `${plain.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`
    : plain;
}

/** Description prose, cross-references resolved and MDX-safe. */
function prose(text, context, level) {
  if (!text) return '';
  const linked = resolveCrossRefs(text, context);
  const shifted = shiftHeadings(linked, level);
  return mapProse(shifted, (part) => mapOutsideCode(part, escapeMdx));
}

/** Description prose for a text artifact: linked, but never MDX-escaped. */
const plainProse = (text, context, level) =>
  text ? shiftHeadings(resolveCrossRefs(text, context), level) : '';

const indent = (text, spaces) =>
  text
    .split('\n')
    .map((line) => (line.trim() ? `${' '.repeat(spaces)}${line}` : line))
    .join('\n');

/* -------------------------------------------------------------------------
 * Rows
 * ---------------------------------------------------------------------- */

/*
 * The word for a parameter with no default. The model says "absent"; which
 * word a reader sees is the renderer's call, and an empty cell in a column of
 * defaults reads as "the default is nothing".
 */
const REQUIRED = 'Required';

const DIRECTIONS = { in: 'in', out: 'out', inout: 'in, out' };

const paramRows = (symbol) =>
  symbol.params.map((param) => ({
    name: param.name,
    ...(param.type ? { type: param.type } : {}),
    default:
      param.default ??
      (param.direction
        ? `${REQUIRED} · ${DIRECTIONS[param.direction]}`
        : REQUIRED),
    description: param.description,
  }));

const returnRows = (symbol) =>
  symbol.returns.map((entry) => ({
    ...(entry.name ? { name: entry.name } : {}),
    ...(entry.type ? { type: entry.type } : {}),
    description: entry.description,
  }));

const raiseRows = (symbol) =>
  symbol.raises.map((entry) => ({
    ...(entry.type ? { name: entry.type } : {}),
    description: entry.description,
  }));

/* -------------------------------------------------------------------------
 * MDX
 * ---------------------------------------------------------------------- */

const attr = (name, value) => `${name}={${JSON.stringify(value)}}`;

function symbolMdx(symbol, context, level) {
  const { options } = context;
  const props = [
    attr('id', symbol.id),
    attr('name', symbol.name),
    attr('kind', symbol.kind),
    attr('language', symbol.language),
    attr('signature', options.showSignature ? symbol.signature : ''),
    attr('level', Math.min(4, level)),
  ];
  if (symbol.summary) props.push(attr('summary', symbol.summary));
  if (symbol.source) props.push(attr('source', symbol.source));
  if (symbol.since) props.push(attr('since', symbol.since));
  if (symbol.deprecated) props.push(attr('deprecated', symbol.deprecated));

  const body = [];
  const description = prose(symbol.description, context, level + 1);
  if (description) body.push(description);

  const section = (title, inner) =>
    `<RefSection title=${JSON.stringify(title)}>\n${indent(inner, 2)}\n</RefSection>`;

  const params = paramRows(symbol);
  if (params.length > 0) {
    body.push(
      section(
        'Parameters',
        `<RefParams\n  caption={${JSON.stringify(`Parameters of ${symbol.name}`)}}\n  density={${JSON.stringify(options.density)}}\n  rows={${JSON.stringify(params)}}\n/>`,
      ),
    );
  }

  const returns = returnRows(symbol);
  if (returns.length > 0) {
    body.push(
      section(
        'Returns',
        `<RefParams\n  caption={${JSON.stringify(`Returns of ${symbol.name}`)}}\n  density={${JSON.stringify(options.density)}}\n  nameLabel="Value"\n  rows={${JSON.stringify(returns)}}\n/>`,
      ),
    );
  }

  const raises = raiseRows(symbol);
  if (raises.length > 0) {
    body.push(
      section(
        'Raises',
        `<RefParams\n  caption={${JSON.stringify(`Errors raised by ${symbol.name}`)}}\n  density={${JSON.stringify(options.density)}}\n  nameLabel="Type"\n  rows={${JSON.stringify(raises)}}\n/>`,
      ),
    );
  }

  if (symbol.examples.length > 0) {
    const blocks = symbol.examples
      .map((example) =>
        [
          example.description
            ? prose(example.description, context, level + 1)
            : '',
          `\`\`\`${example.language ?? symbol.language}\n${example.code}\n\`\`\``,
        ]
          .filter(Boolean)
          .join('\n\n'),
      )
      .join('\n\n');
    body.push(section('Examples', blocks));
  }

  for (const member of symbol.members ?? []) {
    body.push(symbolMdx(member, context, level + 1));
  }

  const inner = body.join('\n\n');
  return `<RefSymbol\n  ${props.join('\n  ')}\n>\n\n${indent(inner, 2)}\n\n</RefSymbol>`;
}

const memberItems = (module) =>
  module.symbols.map((symbol) => ({
    id: symbol.id,
    name: symbol.name,
    kind: symbol.kind,
    ...(symbol.summary ? { summary: symbol.summary } : {}),
  }));

/**
 * Render one module to an MDX page.
 *
 * @returns {{ path: string, route: string, mdx: string, anchors: string[], warnings: string[] }}
 */
export function renderModulePage(module, { index, options, order = 0 }) {
  const warnings = [];
  const context = {
    index,
    options,
    currentModule: module.path,
    warn: (message) => warnings.push(`${module.path}: ${message}`),
  };
  const { page, json, file, artifact } = routes(module.path, options);

  const front = ['---', `title: ${yamlString(module.name)}`];
  const description = metaDescription(module.summary);
  if (description) front.push(`description: ${yamlString(description)}`);
  front.push('sidebar:', `  order: ${order}`, '---');

  const blocks = [front.join('\n')];
  blocks.push(
    PART_IMPORTS.map(([name, from]) => `import ${name} from '${from}';`).join(
      '\n',
    ),
  );

  if (options.showRootHeading) blocks.push(`# ${module.path}`);

  const moduleProse = prose(module.description, context, options.headingLevel);
  if (moduleProse) blocks.push(moduleProse);

  /* The contract with an agent reading this page: the data behind it is one
   * link away and it is the thing that is generated, not the page. */
  blocks.push(`[Machine-readable model](${json})`);

  const items = memberItems(module);
  if (items.length > 0) {
    blocks.push(
      `<RefMembers label="On this page" items={${JSON.stringify(items)}} />`,
    );
  }

  for (const symbol of module.symbols) {
    blocks.push(symbolMdx(symbol, context, options.headingLevel));
  }

  const mdx = `${blocks
    .map((block) => block.trimEnd())
    .filter(Boolean)
    .join('\n\n')}\n`;

  return {
    path: file,
    route: page,
    artifact,
    mdx,
    anchors: flattenSymbols(module).map((symbol) => symbol.id),
    warnings,
  };
}

/* -------------------------------------------------------------------------
 * Markdown, for the text artifacts
 * ---------------------------------------------------------------------- */

const markdownTable = (headers, rows) =>
  table(
    headers,
    rows.map((row) => headers.map((header) => row[header.toLowerCase()] ?? '')),
  );

/** One module as plain Markdown: what `llms-full.txt` is made of. */
export function renderModuleMarkdown(module, { index, options }) {
  const context = {
    index,
    options,
    currentModule: module.path,
    warn: () => {},
  };
  const level = options.headingLevel;
  const blocks = [`# ${module.path}`];

  const moduleProse = plainProse(module.description, context, level);
  if (moduleProse) blocks.push(moduleProse);

  const write = (symbol, depth) => {
    blocks.push(`${'#'.repeat(Math.min(6, depth))} ${symbol.id}`);
    blocks.push(`\`${symbol.kind}\` · \`${symbol.language}\``);
    if (options.showSignature) {
      blocks.push(`\`\`\`${symbol.language}\n${symbol.signature}\n\`\`\``);
    }
    if (symbol.deprecated) blocks.push(`**Deprecated.** ${symbol.deprecated}`);
    if (symbol.since) blocks.push(`Available since ${symbol.since}.`);
    const body = plainProse(symbol.description, context, depth + 1);
    if (body) blocks.push(body);

    const params = paramRows(symbol);
    if (params.length > 0) {
      blocks.push(
        `**Parameters**\n\n${markdownTable(['Name', 'Type', 'Default', 'Description'], params)}`,
      );
    }
    const returns = returnRows(symbol);
    if (returns.length > 0) {
      blocks.push(
        `**Returns**\n\n${markdownTable(['Name', 'Type', 'Description'], returns)}`,
      );
    }
    const raises = raiseRows(symbol);
    if (raises.length > 0) {
      blocks.push(
        `**Raises**\n\n${markdownTable(['Name', 'Description'], raises)}`,
      );
    }
    for (const example of symbol.examples ?? []) {
      if (example.description) blocks.push(example.description);
      blocks.push(
        `\`\`\`${example.language ?? symbol.language}\n${example.code}\n\`\`\``,
      );
    }
    blocks.push(`Source: \`${symbol.source?.path}:${symbol.source?.line}\``);
    for (const member of symbol.members ?? []) write(member, depth + 1);
  };

  for (const symbol of module.symbols) write(symbol, level);

  return `${blocks
    .map((block) => String(block).trimEnd())
    .filter(Boolean)
    .join('\n\n')}\n`;
}

/* -------------------------------------------------------------------------
 * Artifacts
 * ---------------------------------------------------------------------- */

/**
 * JSON with every object's keys in sorted order and a trailing newline.
 *
 * Byte stability is the point: a reference regenerated from an unchanged source
 * has to produce an unchanged file, or `--check` reports drift that is not
 * drift and nobody can read the diff when there is real drift.
 */
export function canonicalJson(value) {
  const sort = (input) => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.keys(input)
          .sort()
          .map((key) => [key, sort(input[key])]),
      );
    }
    return input;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

const absolute = (url, options) =>
  options.site ? `${options.site.replace(/\/$/, '')}${url}` : url;

/**
 * `llms.txt`: what this reference is and where each module's page and data are.
 *
 * The convention is a title, one line of description, then link sections. An
 * agent that reads this one file knows every route in the reference without
 * crawling it.
 */
export function renderLlmsTxt(model, options) {
  const modules = flatten(model);
  const root = modules[0];
  const summary =
    metaDescription(root.summary) ||
    `API reference for ${model.name}, generated from source.`;

  const lines = [
    `# ${model.name} API reference`,
    '',
    `> ${summary}`,
    '',
    `The reference is generated from the ${model.language} source. The JSON is the source of truth and the pages are a view of it.`,
    '',
    '## Modules',
    '',
  ];
  for (const module of modules) {
    const { page, json } = routes(module.path, options);
    const note = metaDescription(module.summary);
    lines.push(
      `- [${module.path}](${absolute(page, options)})${note ? `: ${note}` : ''} ([JSON](${absolute(json, options)}))`,
    );
  }

  const whole = joinUrl(options.base, `${options.routePrefix}/reference.json`);
  lines.push(
    '',
    '## Machine-readable',
    '',
    `- [reference.json](${absolute(whole, options)}): every module in one document, against ${REFERENCE_MODEL_SCHEMA}`,
    `- [llms-full.txt](${absolute(joinUrl(options.base, `${options.routePrefix}/llms-full.txt`), options)}): every module page as Markdown, in order`,
    '',
  );
  return lines.join('\n');
}

/** `llms-full.txt`: every module's Markdown, in module order. */
export function renderLlmsFull(model, { index, options }) {
  return `${flatten(model)
    .map((module) => renderModuleMarkdown(module, { index, options }).trimEnd())
    .join('\n\n---\n\n')}\n`;
}

/* -------------------------------------------------------------------------
 * Sidebar
 * ---------------------------------------------------------------------- */

/**
 * A Starlight sidebar fragment for the generated pages.
 *
 * @returns {{ label: string, items: Array<object> }}
 */
export function buildSidebar(model, options) {
  const slug = (modulePath) =>
    `${options.routePrefix}/${routeSegments(modulePath).join('/')}`;

  const group = (module) => {
    const children = module.submodules ?? [];
    if (children.length === 0)
      return { label: module.name, slug: slug(module.path) };
    return {
      label: module.name,
      collapsed: true,
      items: [
        { label: 'Overview', slug: slug(module.path) },
        ...children.map(group),
      ],
    };
  };

  const top = group(model.modules[0]);
  return { label: model.modules[0].name, items: top.items ?? [top] };
}

/** The module tree as `RefNav` items, for a site that renders its own nav. */
export function buildNav(model, options) {
  const item = (module) => {
    const { page } = routes(module.path, options);
    const children = (module.submodules ?? []).map(item);
    return {
      label: module.name,
      href: page,
      ...(children.length > 0 ? { items: children } : {}),
    };
  };
  return model.modules.map(item);
}

/* -------------------------------------------------------------------------
 * The whole run
 * ---------------------------------------------------------------------- */

/**
 * Render a model into everything a site publishes for it.
 *
 * @param {object} model A reference model; see `reference-model.ts`.
 * @param {object} [options] See {@link RENDER_DEFAULTS}.
 * @returns {{ pages: object[], artifacts: object[], sidebar: object, nav: object[], warnings: string[] }}
 *   `pages` are written under `--out`, `artifacts` under `public/`.
 */
export function renderReference(model, options = {}) {
  assertRenderable(model);
  const resolved = {
    ...RENDER_DEFAULTS,
    ...options,
    base: normalizeBase(options.base ?? RENDER_DEFAULTS.base),
    routePrefix: (options.routePrefix ?? RENDER_DEFAULTS.routePrefix).replace(
      /^\/|\/$/g,
      '',
    ),
  };
  const index = buildIndex(model, resolved);
  const modules = flatten(model);
  const warnings = [];

  /* Two module paths that differ only in case or punctuation are one route
   * once slugged, and the second page would overwrite the first with no sign
   * of it in the output. */
  const claimed = new Map();
  for (const module of modules) {
    const { page } = routes(module.path, resolved);
    const taken = claimed.get(page);
    if (taken !== undefined) {
      throw new ReferenceRenderError(
        `${taken} and ${module.path} are the same route once slugged (${page}). ` +
          'Rename one of them.',
      );
    }
    claimed.set(page, module.path);
  }

  const orders = new Map();
  const pages = modules.map((module) => {
    const parent = segmentsOf(module.path).slice(0, -1).join('.');
    const order = (orders.get(parent) ?? 0) + 1;
    orders.set(parent, order);
    const page = renderModulePage(module, {
      index,
      options: resolved,
      order,
    });
    warnings.push(...page.warnings);
    return page;
  });

  const stamped = {
    $schema: REFERENCE_MODEL_SCHEMA,
    ...model,
  };

  const artifacts = [
    {
      path: `${resolved.routePrefix}/reference.json`,
      contents: canonicalJson(stamped),
    },
    ...modules.map((module) => ({
      path: routes(module.path, resolved).artifact,
      contents: canonicalJson({
        $schema: REFERENCE_MODEL_SCHEMA,
        name: model.name,
        language: model.language,
        ...(model.generatedFrom ? { generatedFrom: model.generatedFrom } : {}),
        /* The subtree is not repeated here: `reference.json` is the whole
         * document and `llms.txt` lists every module, so a per-module file that
         * carried its children would be the same bytes in n places. */
        modules: [{ ...module, submodules: [] }],
      }),
    })),
    {
      path: `${resolved.routePrefix}/llms.txt`,
      contents: renderLlmsTxt(model, resolved),
    },
    {
      path: `${resolved.routePrefix}/llms-full.txt`,
      contents: renderLlmsFull(model, { index, options: resolved }),
    },
  ];

  return {
    pages,
    artifacts,
    sidebar: buildSidebar(model, resolved),
    nav: buildNav(model, resolved),
    options: resolved,
    warnings,
  };
}
