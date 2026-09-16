// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * The index a reader searches, derived from the reference the pages render.
 *
 * A generated reference answers "what does this symbol do" well and "which
 * symbol do I want" badly: six hundred kernels spread over fifty module pages
 * is a corpus, not an index. The answer a reader actually asks for is a filter
 * -- this group, this data type, this acceleration path -- over one flat list
 * whose every row links into the page that documents it.
 *
 * A row is therefore a projection of `reference-model.ts` and nothing else,
 * plus facets. Facets are the part that cannot be one fixed list: a C kernel
 * library faceted by data type and header has nothing in common with a Python
 * package faceted by stability, so the extractors are pluggable and the
 * defaults are only the ones every reference can answer from the model it
 * already has.
 *
 * What the model cannot know at all -- prerequisites, the buffer-size rule,
 * tolerances, which acceleration paths are implemented -- comes from an
 * overlay keyed by symbol name, which is the shape a kernel manifest takes
 * when a product repository publishes one. A row carries those fields when the
 * overlay covers the symbol and carries nothing when it does not, so the index
 * ships before the manifest does and gains detail without a schema change.
 *
 * This file is types and pure functions with no runtime imports, for the same
 * reason `reference-model.ts` is: it is evaluated at build by a site, in a test
 * by Node, and its types are read by the island in the browser.
 */

import type {
  RefModule,
  RefSymbol,
  ReferenceModel,
  SymbolKind,
} from './reference-model';

/** One facet family a group config describes: an id, a label, and the names that join it. */
export interface RefIndexGroup {
  /** Stable id. Not shown; use it to key a manifest or a page anchor. */
  id: string;
  /** What the chip and the table cell say. */
  label: string;
  /** Regular expression sources, tested against the bare symbol name. A symbol joins the first group that matches. */
  patterns: readonly string[];
}

/**
 * What a symbol promises, beyond what its declaration says.
 *
 * Every field is optional because the manifest that carries them is a product
 * repository's, published on its own schedule. A row with none of them renders
 * as a row; a row with any of them gains a detail panel.
 */
export interface RefIndexContract {
  /** What has to be true before the call: an init, a scratch buffer, an alignment. */
  prerequisites?: string[];
  /** How the caller computes the scratch size, as the rule rather than a number. */
  bufferSize?: string;
  /** The accuracy the implementation is held to, as the manifest states it. */
  tolerances?: string;
  /** Anything else the reader needs before choosing the symbol. */
  notes?: string;
}

/** One row of the index: a symbol, where it is documented, and what it filters by. */
export interface RefIndexRow {
  /** The symbol's fully qualified id, which is also the anchor `href` points at. */
  id: string;
  /** The short name, which is what the reader searches and the row links from. */
  name: string;
  kind: SymbolKind;
  /** The module path the symbol is documented on. */
  module: string;
  /** The family label from the group config, or the `ungrouped` label. */
  group: string;
  /** Page route plus `#id`: the anchor on the generated page, base path included. */
  href: string;
  /** One sentence, from the model. */
  summary: string;
  /** Facet id to values. Repeated for `group` so the island filters every facet the same way. */
  facets: Record<string, string[]>;
  /** Present only when the overlay covers the symbol. */
  contract?: RefIndexContract;
}

/** One filter control: the facet's id, its label, and every value present in the rows. */
export interface RefIndexFacet {
  id: string;
  label: string;
  values: string[];
}

/** One overlay entry: extra facet values, contract fields, or both. */
export interface RefIndexEntry extends RefIndexContract {
  /** Facet values keyed by facet id. These replace the derived values for that facet. */
  facets?: Record<string, readonly string[]>;
}

/** An overlay file: entries keyed by bare symbol name. */
export interface RefIndexOverlay {
  $schema?: string;
  symbols: Record<string, RefIndexEntry>;
}

/** What a facet extractor is given: one symbol, and the module it is documented on. */
export interface RefIndexFacetContext {
  symbol: RefSymbol;
  module: RefModule;
}

/** Derives one facet's values for one symbol. Returning an empty array means the facet does not apply. */
export type RefIndexFacetExtractor = (
  context: RefIndexFacetContext,
) => readonly string[];

export interface RefIndexOptions {
  /** Site base path. The same value the renderer was given, so the hrefs match the routes. */
  base?: string;
  /** Where the generated pages live under the content root. The renderer's own default is `reference/api`. */
  routePrefix?: string;
  /** Which kinds to index. Defaults to functions, which is what an operator index is. */
  kinds?: readonly SymbolKind[];
  /** Whether to index members -- struct fields, enum values -- as rows of their own. */
  includeMembers?: boolean;
  /** The families, in the order they should be offered. */
  groups?: readonly RefIndexGroup[];
  /** What a symbol no group matches is called. */
  ungrouped?: string;
  /** Facet extractors, merged over the defaults. Pass `null` to drop a default. */
  facets?: Record<string, RefIndexFacetExtractor | null>;
  /** The manifest, as the parsed file or as the bare map of entries. */
  overlay?: RefIndexOverlay | Record<string, RefIndexEntry>;
}

/** The defaults `buildRefIndex` applies. `base` and `routePrefix` mirror the renderer's. */
export const REF_INDEX_DEFAULTS = {
  base: '/',
  routePrefix: 'reference/api',
  ungrouped: 'Other',
  kinds: ['function'] as readonly SymbolKind[],
};

/** Labels for the facets the defaults produce. A caller's own facet ids fall back to their id. */
export const REF_INDEX_FACET_LABELS: Record<string, string> = {
  group: 'Group',
  dtypes: 'Data type',
  paths: 'Path',
  headers: 'Header',
};

/* -------------------------------------------------------------------------
 * Routes
 *
 * Mirrors `scripts/lib/reference-render.mjs`, which is the renderer and cannot
 * be imported here: it is a build script a product repository runs with nothing
 * installed, and this file is read in a browser bundle. The unit tests assert
 * the two agree on every symbol of a model rather than trusting the copy.
 * ---------------------------------------------------------------------- */

const SLUG_STRIP = new RegExp(
  '[\\0-\\x1F!-,.\\/:-@\\[-\\^`\\{-~\\x7F-\\x9F\\xA0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]',
  'g',
);

/** A base path is always absolute and always ends in a slash. */
export function normalizeIndexBase(base: string | undefined): string {
  if (!base || base === '/') return '/';
  const withLead = base.startsWith('/') ? base : `/${base}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}

const slugSegment = (text: string): string =>
  String(text).toLowerCase().replace(SLUG_STRIP, '').replace(/ /g, '-');

/** The URL of a symbol's anchor on its generated module page. */
export function refIndexHref(
  modulePath: string,
  symbolId: string,
  options: RefIndexOptions = {},
): string {
  const base = normalizeIndexBase(options.base ?? REF_INDEX_DEFAULTS.base);
  const prefix = options.routePrefix ?? REF_INDEX_DEFAULTS.routePrefix;
  const segments = modulePath.split('.').map(slugSegment).join('/');
  return `${base.replace(/\/$/, '')}/${prefix}/${segments}/#${symbolId}`;
}

/* -------------------------------------------------------------------------
 * Default extractors
 * ---------------------------------------------------------------------- */

/*
 * The data-type vocabulary, widest first so `_fp16` is read as one suffix
 * rather than as `f16` with a stray letter. A kernel library spells the type
 * in the name because the name is the overload set -- `arm_convolve_s8` and
 * `arm_convolve_f16` are two functions -- so the suffix is data, not a naming
 * convention, and reading it is how a reader gets "show me the int8 kernels".
 */
const DTYPE_PATTERN =
  /_(s4|s8|s16|s32|s64|u8|q7|q15|q31|bf16|fp16|f16|f32|f64)(?![0-9A-Za-z])/g;

/** Spellings that mean the same type. The reader gets one chip, not two. */
const DTYPE_ALIASES: Record<string, string> = { fp16: 'f16' };

/** Every data type a symbol's name declares, in the order the name gives them. */
export const dtypesFromName: RefIndexFacetExtractor = ({ symbol }) => {
  const found: string[] = [];
  for (const match of symbol.name.matchAll(DTYPE_PATTERN)) {
    const dtype = DTYPE_ALIASES[match[1]] ?? match[1];
    if (!found.includes(dtype)) found.push(dtype);
  }
  return found;
};

/**
 * The file a symbol is declared in, as its basename.
 *
 * The declaring file rather than the module: a documentation module is a
 * doxygen group or a Python package, and what a C caller has to `#include` is
 * the header. The module path is the fallback for a language where the two are
 * the same thing.
 */
export const headerFromSource: RefIndexFacetExtractor = ({
  symbol,
  module,
}) => {
  const path = symbol.source?.path ?? '';
  if (!path) return [module.name];
  const name = path.split('/').pop() ?? '';
  return name ? [name] : [module.name];
};

/*
 * No default for `paths`. Which acceleration path a kernel has -- helium,
 * DSP, plain C -- is not in any declaration; it is a build fact the library
 * knows and the overlay carries. Deriving it from a name would be a guess
 * printed as a fact.
 */
const DEFAULT_FACETS: Record<string, RefIndexFacetExtractor> = {
  dtypes: dtypesFromName,
  headers: headerFromSource,
};

/* -------------------------------------------------------------------------
 * Building
 * ---------------------------------------------------------------------- */

const flattenModules = (model: ReferenceModel): RefModule[] => {
  const out: RefModule[] = [];
  const visit = (module: RefModule): void => {
    out.push(module);
    for (const child of module.submodules ?? []) visit(child);
  };
  for (const module of model.modules ?? []) visit(module);
  return out;
};

const flattenSymbols = (
  module: RefModule,
  includeMembers: boolean,
): RefSymbol[] => {
  const out: RefSymbol[] = [];
  const visit = (symbol: RefSymbol): void => {
    out.push(symbol);
    if (!includeMembers) return;
    for (const member of symbol.members ?? []) visit(member);
  };
  for (const symbol of module.symbols ?? []) visit(symbol);
  return out;
};

const overlayEntries = (
  overlay: RefIndexOptions['overlay'],
): Record<string, RefIndexEntry> => {
  if (!overlay) return {};
  const record = overlay as RefIndexOverlay;
  return record.symbols ?? (overlay as Record<string, RefIndexEntry>);
};

const contractOf = (entry: RefIndexEntry): RefIndexContract | undefined => {
  const contract: RefIndexContract = {};
  if (entry.prerequisites?.length)
    contract.prerequisites = [...entry.prerequisites];
  if (entry.bufferSize) contract.bufferSize = entry.bufferSize;
  if (entry.tolerances) contract.tolerances = entry.tolerances;
  if (entry.notes) contract.notes = entry.notes;
  return Object.keys(contract).length > 0 ? contract : undefined;
};

/** Compiles the group config once per build rather than once per symbol. */
const groupMatcher = (
  groups: readonly RefIndexGroup[] | undefined,
): ((name: string) => string | null) => {
  if (!groups || groups.length === 0) return () => null;
  const compiled = groups.map((group) => ({
    label: group.label,
    patterns: group.patterns.map((pattern) => new RegExp(pattern)),
  }));
  return (name) => {
    for (const group of compiled) {
      if (group.patterns.some((pattern) => pattern.test(name)))
        return group.label;
    }
    return null;
  };
};

/**
 * Derive the index rows from a reference model.
 *
 * Pure and deterministic: the same model and options give the same rows in the
 * same order, so the artifact diffs and a site can serve it as JSON beside the
 * pages.
 *
 * @param reference A parsed `reference.json`, or any value of that shape.
 * @param options Routes, which kinds to index, the group config, the facet extractors, and the overlay.
 * @returns Rows sorted by name, then by id for the names a language overloads.
 */
export function buildRefIndex(
  reference: ReferenceModel,
  options: RefIndexOptions = {},
): RefIndexRow[] {
  const kinds = new Set(options.kinds ?? REF_INDEX_DEFAULTS.kinds);
  const ungrouped = options.ungrouped ?? REF_INDEX_DEFAULTS.ungrouped;
  const grouped = options.groups && options.groups.length > 0;
  const groupOf = groupMatcher(options.groups);
  const entries = overlayEntries(options.overlay);

  const extractors: Record<string, RefIndexFacetExtractor> = {
    ...DEFAULT_FACETS,
  };
  for (const [id, extractor] of Object.entries(options.facets ?? {})) {
    if (extractor === null) delete extractors[id];
    else extractors[id] = extractor;
  }

  const rows: RefIndexRow[] = [];

  for (const module of flattenModules(reference)) {
    for (const symbol of flattenSymbols(
      module,
      options.includeMembers ?? false,
    )) {
      if (kinds.size > 0 && !kinds.has(symbol.kind)) continue;

      const group = groupOf(symbol.name) ?? ungrouped;
      const context = { symbol, module };
      const facets: Record<string, string[]> = {};
      if (grouped) facets.group = [group];
      for (const [id, extract] of Object.entries(extractors)) {
        const values = [...extract(context)].filter(Boolean);
        if (values.length > 0) facets[id] = values;
      }

      const entry = entries[symbol.name];
      if (entry?.facets) {
        for (const [id, values] of Object.entries(entry.facets)) {
          const merged = [...values].filter(Boolean);
          if (merged.length > 0) facets[id] = merged;
          else delete facets[id];
        }
      }

      const contract = entry ? contractOf(entry) : undefined;

      rows.push({
        id: symbol.id,
        name: symbol.name,
        kind: symbol.kind,
        module: module.path,
        group,
        href: refIndexHref(module.path, symbol.id, options),
        summary: symbol.summary ?? '',
        facets,
        ...(contract ? { contract } : {}),
      });
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return rows;
}

/*
 * Numeric-aware, so a data-type facet reads s4, s8, s16, s32 rather than the
 * alphabetical s16, s32, s4, s8 that puts the narrowest type third.
 */
const byValue = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true });

/**
 * The filter controls a set of rows can offer: every facet that has values.
 *
 * Derived from the rows rather than declared, so a facet whose extractor found
 * nothing -- `paths`, before a manifest exists -- produces no empty control.
 *
 * @param rows The rows the island will render.
 * @param labels Labels by facet id, merged over {@link REF_INDEX_FACET_LABELS}.
 * @returns Facets in label-table order, then any of the caller's own by id.
 */
export function refIndexFacets(
  rows: readonly RefIndexRow[],
  labels: Record<string, string> = {},
): RefIndexFacet[] {
  const values = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const [id, list] of Object.entries(row.facets)) {
      const seen = values.get(id) ?? new Set<string>();
      for (const value of list) seen.add(value);
      values.set(id, seen);
    }
  }

  const known = Object.keys(REF_INDEX_FACET_LABELS);
  const rank = (id: string): number => {
    const index = known.indexOf(id);
    return index === -1 ? known.length : index;
  };

  return [...values.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((id) => ({
      id,
      label: labels[id] ?? REF_INDEX_FACET_LABELS[id] ?? id,
      values: [...(values.get(id) ?? [])].sort(byValue),
    }))
    .filter((facet) => facet.values.length > 0);
}
