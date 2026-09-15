// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/**
 * The one shape an API reference takes, whatever language it came from.
 *
 * HELIA publishes references for Python, C, C++ and TypeScript, and the list is
 * open. Each of those has its own extractor -- griffe, Doxygen, the TypeScript
 * compiler -- and each of those tools has its own tree. Rendering from those
 * trees directly is how a site ends up with four reference designs that drift
 * apart, so every extractor lands here first and the parts render this and
 * nothing else.
 *
 * The model is the source of truth and the pages are a view of it. The renderer
 * writes the validated model out as JSON beside the pages precisely so that the
 * next reader -- increasingly an agent rather than a person -- can take the data
 * instead of scraping the rendering of it.
 *
 * Neutrality is the constraint on every field below. A field earns its place
 * only if all four languages have something to put in it; anything that is true
 * of one language alone is prose in `description`, not structure. That is why
 * there is no `decorators`, no `template parameters`, no `visibility`.
 *
 * This file is types and a guard, with no imports, so that it costs a consumer
 * nothing to depend on and cannot drag a runtime in behind it.
 */

/**
 * The kinds a documented symbol can be, across the four languages.
 *
 * The list is the union rather than the intersection: a C header has no
 * classes and Python has no macros, and forcing either into a shared word
 * would lose the one thing the reader wants from the badge. `type` covers a
 * TypeScript type alias, a C `typedef` and a Python `TypeAlias` alike, because
 * those really are the same thing wearing three syntaxes.
 */
export const SYMBOL_KINDS = [
  'module',
  'class',
  'function',
  'method',
  'attribute',
  'constant',
  'type',
  'macro',
  'struct',
  'enum',
  'namespace',
] as const;

export type SymbolKind = (typeof SYMBOL_KINDS)[number];

/**
 * The languages an extractor may declare.
 *
 * Closed rather than a free string: the chip on every symbol header and the
 * grammar the signature highlights with are both driven off this, and a typo
 * in an extractor should fail the run rather than ship a reference labeled
 * "pyhton". Adding a language is a deliberate edit here plus its extractor.
 */
export const REFERENCE_LANGUAGES = [
  'python',
  'c',
  'cpp',
  'typescript',
  'rust',
] as const;

export type ReferenceLanguage = (typeof REFERENCE_LANGUAGES)[number];

/** The stable identifier the emitted JSON carries in `$schema`. */
export const REFERENCE_MODEL_SCHEMA =
  'https://ambiqai.github.io/helia-ui/schema/reference-model-1.json';

/** Where a symbol is written, so a reader can go and read it. */
export interface RefSource {
  /** Repository-relative path. Relative because an absolute one is a build machine's path, not a fact about the code. */
  path: string;
  /** 1-based line of the declaration. */
  line: number;
  /** Resolved link to the line in a code host. Optional: a repository that is not published has no such URL and should say nothing rather than guess one. */
  url?: string;
}

/**
 * One input to a callable.
 *
 * `default` is a string rather than a value because the interesting default is
 * the one the reader would type: `()` in C++, `None` in Python, `undefined` in
 * TypeScript. Serializing the real value loses that and gains nothing.
 */
export interface RefParam {
  name: string;
  /** The declared type, as source text. Absent when the language or the declaration has none. */
  type?: string;
  /** The default as written. Absent means the parameter is required. */
  default?: string;
  description: string;
  /**
   * Whether the callee reads the parameter, writes through it, or both.
   *
   * This exists for C and C++, where an out-parameter is the return value and
   * a reference that omits it is wrong. Languages that have no such concept
   * leave it unset rather than defaulting to `in`, so the table can tell "does
   * not apply" from "in".
   */
  direction?: 'in' | 'out' | 'inout';
}

/**
 * One value a callable hands back.
 *
 * A list rather than a single value: a Python function returns a tuple whose
 * members are documented one by one, a C function returns a status alongside
 * its out-parameters, and a generator has a yield type as well as a return
 * type. `name` carries the label when the docstring gave the value one.
 */
export interface RefReturn {
  name?: string;
  type?: string;
  description: string;
}

/**
 * An error a symbol can raise, throw, or report through a status code.
 *
 * Same shape as a return because that is what it is from the reader's side: a
 * type and what it means. The word "raises" is Python's; C maps its error
 * enum onto it and TypeScript its thrown types.
 */
export interface RefThrow {
  type?: string;
  description: string;
}

/**
 * A worked example: the code, and optionally the sentence that sets it up.
 *
 * Code is required and prose is not, because an example with no code is just
 * more description and belongs there instead.
 */
export interface RefExample {
  code: string;
  /** Grammar to highlight with. Defaults to the symbol's language. */
  language?: string;
  /** The prose that introduces the snippet, if the source had any. */
  description?: string;
}

/**
 * One documented symbol.
 *
 * `id` is the contract with the outside world: it is the language's own fully
 * qualified path (`helia.profiler.profile_model`, `helia_status_t`,
 * `@ambiqai/helia.loadModel`) and it is also the page anchor, so a URL plus a
 * fragment names one symbol and keeps naming it after the page is restyled or
 * regenerated. Nothing else in the model is allowed to be a link target.
 */
export interface RefSymbol {
  id: string;
  /** The short name, as it appears in the header. `id` carries the qualification. */
  name: string;
  kind: SymbolKind;
  language: ReferenceLanguage;
  /** The declaration, as source text, already wrapped for display. The extractor formats it because only the extractor knows the language's conventions. */
  signature: string;
  /** One sentence. Used for the member index and the page description, where a paragraph would not fit. */
  summary: string;
  /** The full prose, as Markdown. Markdown rather than HTML so the page and the concatenated text artifact can carry the same bytes. */
  description: string;
  params: RefParam[];
  returns: RefReturn[];
  raises: RefThrow[];
  examples: RefExample[];
  source: RefSource;
  /** The release the symbol first appeared in, as the project spells versions. */
  since?: string;
  /**
   * The deprecation notice, already composed into one sentence.
   *
   * A sentence rather than `{ since, replacement, reason }` because every
   * language and tool spells that metadata differently and the reader only
   * ever sees the sentence. The extractor does the composing, once.
   */
  deprecated?: string;
  /** Methods of a class, fields of a struct, values of an enum. Recursive because a nested class is a real thing in three of the four languages. */
  members: RefSymbol[];
}

/**
 * One documented unit: a Python module, a C header, a TypeScript entry point.
 *
 * `path` is the dotted or slash-separated identity the language gives it and
 * it is what the page route is built from, so it is stable in the same way a
 * symbol `id` is.
 */
export interface RefModule {
  path: string;
  /** The last segment of `path`, which is what the page title shows. */
  name: string;
  summary: string;
  description: string;
  symbols: RefSymbol[];
  submodules: RefModule[];
}

/** What produced the model, so a stale artifact can be traced to its run. */
export interface ReferenceGeneratedFrom {
  /** The extractor's name, for example `pyref`. */
  tool: string;
  /** The extractor's version, or the version of the upstream dump format it pins. */
  version: string;
  /** The commit of the documented source, when the caller knows it. Absent rather than invented. */
  sourceCommit?: string;
}

/** A whole reference: one language, one or more top-level modules. */
export interface ReferenceModel {
  /** The stable schema identifier, `REFERENCE_MODEL_SCHEMA`. */
  $schema?: string;
  /** The package or library the reference documents. */
  name: string;
  language: ReferenceLanguage;
  generatedFrom?: ReferenceGeneratedFrom;
  modules: RefModule[];
}

/** Thrown by {@link validateReferenceModel}, naming the field that failed. */
export class ReferenceModelError extends Error {}

/*
 * A hand-written guard rather than a schema library: this file is imported by
 * product sites that pin nothing but this package, and a validator that drags
 * a dependency in would be the reason someone skips validating.
 */

const fail = (path: string, wanted: string, got: unknown): never => {
  throw new ReferenceModelError(
    `${path}: expected ${wanted}, got ${got === null ? 'null' : Array.isArray(got) ? 'an array' : typeof got}`,
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown, path: string): string =>
  typeof value === 'string' ? value : fail(path, 'a string', value);

const optionalStr = (value: unknown, path: string): string | undefined =>
  value === undefined ? undefined : str(value, path);

const list = (value: unknown, path: string): unknown[] =>
  Array.isArray(value) ? value : fail(path, 'an array', value);

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T => {
  if (
    typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
  )
    return value as T;
  throw new ReferenceModelError(
    `${path}: expected one of ${allowed.join(', ')}, got ${JSON.stringify(value)}`,
  );
};

const source = (value: unknown, path: string): RefSource => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  if (typeof value.line !== 'number' || !Number.isInteger(value.line))
    fail(`${path}.line`, 'an integer', value.line);
  return {
    path: str(value.path, `${path}.path`),
    line: value.line as number,
    ...(value.url === undefined ? {} : { url: str(value.url, `${path}.url`) }),
  };
};

const param = (value: unknown, path: string): RefParam => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    name: str(value.name, `${path}.name`),
    description: str(value.description, `${path}.description`),
    ...(value.type === undefined
      ? {}
      : { type: str(value.type, `${path}.type`) }),
    ...(value.default === undefined
      ? {}
      : { default: str(value.default, `${path}.default`) }),
    ...(value.direction === undefined
      ? {}
      : {
          direction: oneOf(
            value.direction,
            ['in', 'out', 'inout'] as const,
            `${path}.direction`,
          ),
        }),
  };
};

const returned = (value: unknown, path: string): RefReturn => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    description: str(value.description, `${path}.description`),
    ...(value.name === undefined
      ? {}
      : { name: str(value.name, `${path}.name`) }),
    ...(value.type === undefined
      ? {}
      : { type: str(value.type, `${path}.type`) }),
  };
};

const thrown = (value: unknown, path: string): RefThrow => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    description: str(value.description, `${path}.description`),
    ...(value.type === undefined
      ? {}
      : { type: str(value.type, `${path}.type`) }),
  };
};

const example = (value: unknown, path: string): RefExample => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    code: str(value.code, `${path}.code`),
    ...(value.language === undefined
      ? {}
      : { language: str(value.language, `${path}.language`) }),
    ...(value.description === undefined
      ? {}
      : { description: str(value.description, `${path}.description`) }),
  };
};

const symbol = (value: unknown, path: string): RefSymbol => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    id: str(value.id, `${path}.id`),
    name: str(value.name, `${path}.name`),
    kind: oneOf(value.kind, SYMBOL_KINDS, `${path}.kind`),
    language: oneOf(value.language, REFERENCE_LANGUAGES, `${path}.language`),
    signature: str(value.signature, `${path}.signature`),
    summary: str(value.summary, `${path}.summary`),
    description: str(value.description, `${path}.description`),
    params: list(value.params, `${path}.params`).map((item, i) =>
      param(item, `${path}.params[${i}]`),
    ),
    returns: list(value.returns, `${path}.returns`).map((item, i) =>
      returned(item, `${path}.returns[${i}]`),
    ),
    raises: list(value.raises, `${path}.raises`).map((item, i) =>
      thrown(item, `${path}.raises[${i}]`),
    ),
    examples: list(value.examples, `${path}.examples`).map((item, i) =>
      example(item, `${path}.examples[${i}]`),
    ),
    source: source(value.source, `${path}.source`),
    ...(value.since === undefined
      ? {}
      : { since: str(value.since, `${path}.since`) }),
    ...(value.deprecated === undefined
      ? {}
      : { deprecated: str(value.deprecated, `${path}.deprecated`) }),
    members: list(value.members, `${path}.members`).map((item, i) =>
      symbol(item, `${path}.members[${i}]`),
    ),
  };
};

const module_ = (value: unknown, path: string): RefModule => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    path: str(value.path, `${path}.path`),
    name: str(value.name, `${path}.name`),
    summary: str(value.summary, `${path}.summary`),
    description: str(value.description, `${path}.description`),
    symbols: list(value.symbols, `${path}.symbols`).map((item, i) =>
      symbol(item, `${path}.symbols[${i}]`),
    ),
    submodules: list(value.submodules, `${path}.submodules`).map((item, i) =>
      module_(item, `${path}.submodules[${i}]`),
    ),
  };
};

const generatedFrom = (
  value: unknown,
  path: string,
): ReferenceGeneratedFrom => {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    tool: str(value.tool, `${path}.tool`),
    version: str(value.version, `${path}.version`),
    ...(value.sourceCommit === undefined
      ? {}
      : { sourceCommit: str(value.sourceCommit, `${path}.sourceCommit`) }),
  };
};

/**
 * Check a parsed JSON value against the model and return it typed.
 *
 * Returns a rebuilt object rather than the input: unknown keys are dropped, so
 * a model that round-trips through this is exactly the model and an extractor
 * cannot smuggle a language-specific field through to the parts.
 *
 * @param value Parsed JSON, from a `reference.json` artifact or a hand-written fixture.
 * @param path Prefix for error messages, when the caller knows where the value came from.
 * @throws {ReferenceModelError} naming the first field that does not fit.
 */
export function validateReferenceModel(
  value: unknown,
  path = 'model',
): ReferenceModel {
  if (!isRecord(value)) return fail(path, 'an object', value);
  return {
    name: str(value.name, `${path}.name`),
    language: oneOf(value.language, REFERENCE_LANGUAGES, `${path}.language`),
    modules: list(value.modules, `${path}.modules`).map((item, i) =>
      module_(item, `${path}.modules[${i}]`),
    ),
    ...(value.$schema === undefined
      ? {}
      : { $schema: str(value.$schema, `${path}.$schema`) }),
    ...(value.generatedFrom === undefined
      ? {}
      : {
          generatedFrom: generatedFrom(
            value.generatedFrom,
            `${path}.generatedFrom`,
          ),
        }),
  };
}

/** Every module in a model, parents before children, as the pages are ordered. */
export function flattenModules(model: ReferenceModel): RefModule[] {
  const out: RefModule[] = [];
  const visit = (module: RefModule): void => {
    out.push(module);
    for (const child of module.submodules) visit(child);
  };
  for (const module of model.modules) visit(module);
  return out;
}

/** Every symbol on a module, parents before members, as the page renders them. */
export function flattenSymbols(module: RefModule): RefSymbol[] {
  const out: RefSymbol[] = [];
  const visit = (sym: RefSymbol): void => {
    out.push(sym);
    for (const member of sym.members) visit(member);
  };
  for (const sym of module.symbols) visit(sym);
  return out;
}
