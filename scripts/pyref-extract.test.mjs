// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The extractor's contract: which griffe node and which Google-style section
 * lands in which field of the reference model.
 *
 * The fixtures are hand-written rather than captured from a real dump, so a
 * change in the shape this reader pins shows up as a failing assertion here
 * and not as a silently different page.
 *
 * Nothing here asserts on Markdown or MDX. What a model looks like rendered is
 * `reference-render.test.mjs`, and keeping the two apart is what stops a
 * styling change from being a change to the data.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULTS,
  PyrefSchemaError,
  compileFilters,
  extractModel,
  parseDump,
  renderExpr,
} from './lib/pyref-extract.mjs';
import { validateReferenceModel } from '../reference-model.ts';

const name = (n) => ({ cls: 'ExprName', name: n });

let lineno = 0;
const at = () => ({ lineno: (lineno += 10) });

const fn = (path, { parameters = [], returns = null, parsed = [] } = {}) => ({
  ...at(),
  kind: 'function',
  name: path.split('.').pop(),
  path,
  filepath: `/build/src/${path.split('.')[0]}/__init__.py`,
  members: {},
  labels: [],
  parameters,
  returns,
  docstring: { parsed },
});

const cls = (path, { parsed = [], members = {}, labels = [] } = {}) => ({
  ...at(),
  kind: 'class',
  name: path.split('.').pop(),
  path,
  filepath: `/build/src/${path.split('.')[0]}/__init__.py`,
  members,
  labels,
  bases: [],
  decorators: [],
  docstring: { parsed },
});

const mod = (path, members, parsed = []) => ({
  ...at(),
  kind: 'module',
  name: path.split('.').pop(),
  path,
  filepath: `/build/src/${path.split('.').join('/')}/__init__.py`,
  members,
  labels: [],
  docstring: { parsed },
});

/** Extract a one-module package and return its module plus the warnings. */
function extract(members, moduleParsed = [], overrides = {}) {
  const { model, warnings } = extractModel(
    mod('pkg', members, moduleParsed),
    { ...DEFAULTS, ...overrides },
    { schema: 'urn:test:schema' },
  );
  return { model, module: model.modules[0], warnings };
}

const find = (module, id) => module.symbols.find((symbol) => symbol.id === id);

test('a function becomes a symbol with its parameters, returns and raises', () => {
  const { module, warnings } = extract({
    run: fn('pkg.run', {
      parameters: [
        {
          name: 'path',
          kind: 'positional or keyword',
          annotation: name('str'),
          default: null,
        },
        {
          name: 'retries',
          kind: 'keyword-only',
          annotation: name('int'),
          default: '3',
        },
      ],
      returns: name('Result'),
      parsed: [
        { kind: 'text', value: 'Run it. And then some more prose.' },
        {
          kind: 'parameters',
          value: [
            {
              name: 'path',
              annotation: name('str'),
              description: 'Where.',
              value: null,
            },
            {
              name: 'retries',
              annotation: name('int'),
              description: 'How often.',
              value: '3',
            },
          ],
        },
        {
          kind: 'returns',
          value: [
            {
              name: '',
              annotation: name('Result'),
              description: 'What happened.',
            },
          ],
        },
        {
          kind: 'raises',
          value: [{ annotation: name('ValueError'), description: 'Bad path.' }],
        },
      ],
    }),
  });

  assert.deepEqual(warnings, []);
  const symbol = find(module, 'pkg.run');
  assert.equal(symbol.kind, 'function');
  assert.equal(symbol.language, 'python');
  assert.equal(symbol.summary, 'Run it.');
  assert.equal(
    symbol.signature,
    'run(path: str, *, retries: int = 3) -> Result',
  );
  assert.deepEqual(symbol.params, [
    { name: 'path', description: 'Where.', type: 'str' },
    { name: 'retries', description: 'How often.', type: 'int', default: '3' },
  ]);
  assert.deepEqual(symbol.returns, [
    { description: 'What happened.', type: 'Result' },
  ]);
  assert.deepEqual(symbol.raises, [
    { description: 'Bad path.', type: 'ValueError' },
  ]);
});

test('a parameter with no default carries no default key', () => {
  const { module } = extract({
    run: fn('pkg.run', {
      parsed: [
        {
          kind: 'parameters',
          value: [
            {
              name: 'path',
              annotation: name('str'),
              description: 'Where.',
              value: null,
            },
          ],
        },
      ],
    }),
  });
  assert.equal('default' in find(module, 'pkg.run').params[0], false);
});

test('__init__ merges into the class and its methods become members', () => {
  const { module } = extract({
    Handler: cls('pkg.Handler', {
      parsed: [{ kind: 'text', value: 'Handles things.' }],
      members: {
        __init__: fn('pkg.Handler.__init__', {
          parameters: [
            {
              name: 'self',
              kind: 'positional or keyword',
              annotation: null,
              default: null,
            },
            {
              name: 'size',
              kind: 'positional or keyword',
              annotation: name('int'),
              default: '8',
            },
          ],
          parsed: [
            {
              kind: 'parameters',
              value: [
                {
                  name: 'size',
                  annotation: name('int'),
                  description: 'How big.',
                  value: '8',
                },
              ],
            },
          ],
        }),
        resolve: fn('pkg.Handler.resolve', {
          parameters: [
            {
              name: 'self',
              kind: 'positional or keyword',
              annotation: null,
              default: null,
            },
          ],
          returns: name('bool'),
          parsed: [{ kind: 'text', value: 'Resolve it.' }],
        }),
      },
    }),
  });

  const handler = find(module, 'pkg.Handler');
  assert.equal(handler.kind, 'class');
  assert.equal(handler.signature, 'Handler(size: int = 8)');
  assert.deepEqual(handler.params, [
    { name: 'size', description: 'How big.', type: 'int', default: '8' },
  ]);

  const resolve = handler.members.find((m) => m.id === 'pkg.Handler.resolve');
  assert.equal(resolve.kind, 'method');
  assert.equal(resolve.signature, 'resolve() -> bool');
  assert.equal(
    handler.members.some((m) => m.name === '__init__'),
    false,
  );
});

test('attributes become member symbols and UPPER_CASE ones are constants', () => {
  const attribute = (path, annotation, value) => ({
    ...at(),
    kind: 'attribute',
    name: path.split('.').pop(),
    path,
    filepath: '/build/src/pkg/__init__.py',
    members: {},
    labels: [],
    annotation,
    value,
    docstring: { parsed: [{ kind: 'text', value: 'A field.' }] },
  });

  const { module } = extract({
    LIMIT: attribute('pkg.LIMIT', name('int'), '30'),
    registry: attribute('pkg.registry', name('dict'), null),
  });

  assert.equal(find(module, 'pkg.LIMIT').kind, 'constant');
  assert.equal(find(module, 'pkg.LIMIT').signature, 'LIMIT: int = 30');
  assert.equal(find(module, 'pkg.registry').kind, 'attribute');
});

test('the default filters drop private members and keep __init__', () => {
  const keep = compileFilters(DEFAULTS.filters);
  assert.equal(keep('public'), true);
  assert.equal(keep('_private'), false);
  assert.equal(keep('__init__'), true);

  const { module } = extract({
    _hidden: fn('pkg._hidden'),
    shown: fn('pkg.shown'),
  });
  assert.deepEqual(
    module.symbols.map((symbol) => symbol.name),
    ['shown'],
  );
});

test('an examples section pairs its prose with the snippet that follows', () => {
  const { module } = extract({
    run: fn('pkg.run', {
      parsed: [
        {
          kind: 'examples',
          value: [
            ['text', 'Call it like this:'],
            ['examples', 'run("a")\n'],
          ],
        },
      ],
    }),
  });
  assert.deepEqual(find(module, 'pkg.run').examples, [
    { code: 'run("a")', language: 'python', description: 'Call it like this:' },
  ]);
});

test('a deprecated section becomes one composed sentence', () => {
  const { module } = extract({
    run: fn('pkg.run', {
      parsed: [
        {
          kind: 'deprecated',
          value: { version: '0.9', description: 'Use `start` instead.' },
        },
      ],
    }),
  });
  assert.equal(
    find(module, 'pkg.run').deprecated,
    'Since 0.9. Use `start` instead.',
  );
});

test('source paths lose the build machine prefix', () => {
  const { module } = extract({ run: fn('pkg.run') }, [], {
    sourceRoot: '/build',
    sourceUrl: 'https://example.test/{path}#L{line}',
  });
  const { source } = find(module, 'pkg.run');
  assert.equal(source.path, 'src/pkg/__init__.py');
  assert.equal(
    source.url,
    `https://example.test/src/pkg/__init__.py#L${source.line}`,
  );
});

test('submodules nest under the package they belong to', () => {
  const { model } = extract({
    core: mod('pkg.core', { go: fn('pkg.core.go') }),
  });
  assert.deepEqual(
    model.modules[0].submodules.map((child) => child.path),
    ['pkg.core'],
  );
});

test('an unknown docstring section is reported rather than dropped silently', () => {
  const { warnings } = extract({
    run: fn('pkg.run', { parsed: [{ kind: 'invented', value: [] }] }),
  });
  assert.deepEqual(warnings, [
    'pkg.run: unsupported docstring section "invented"',
  ]);
});

test('the extracted model satisfies the model guard', () => {
  const { model } = extract({
    Handler: cls('pkg.Handler', {
      parsed: [{ kind: 'text', value: 'Handles things.' }],
      members: { resolve: fn('pkg.Handler.resolve') },
    }),
    run: fn('pkg.run', {
      parsed: [
        {
          kind: 'parameters',
          value: [
            {
              name: 'path',
              annotation: name('str'),
              description: 'Where.',
              value: null,
            },
          ],
        },
      ],
    }),
  });

  const validated = validateReferenceModel(model);
  assert.equal(validated.language, 'python');
  assert.equal(validated.generatedFrom.tool, 'pyref');
  assert.deepEqual(validated, JSON.parse(JSON.stringify(model)));
});

test('the dump shape is pinned', () => {
  assert.throws(() => parseDump([]), PyrefSchemaError);
  assert.throws(() => parseDump({}), PyrefSchemaError);
  assert.throws(
    () =>
      parseDump({
        pkg: { kind: 'class', name: 'pkg', path: 'pkg', members: {} },
      }),
    PyrefSchemaError,
  );
  assert.throws(
    () => parseDump({ a: mod('a', {}), b: mod('b', {}) }),
    /Pass --package/,
  );
  assert.equal(parseDump({ pkg: mod('pkg', {}) }).name, 'pkg');
});

test('annotations render back to Python source', () => {
  assert.equal(
    renderExpr({
      cls: 'ExprSubscript',
      left: name('Sequence'),
      slice: {
        cls: 'ExprBinOp',
        left: name('int'),
        operator: '|',
        right: name('None'),
      },
    }),
    'Sequence[int | None]',
  );
});
