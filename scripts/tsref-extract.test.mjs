// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The extractor's contract: which TypeDoc reflection and which TSDoc tag lands
 * in which field of the reference model, and what the TypeScript reference
 * looks like once the shared renderer has had it.
 *
 * Fixture provenance: `fixtures/typedoc/src/index.ts` is the sample, and
 * `fixtures/typedoc/api.json` is its TypeDoc JSON. The JSON is hand-written
 * against TypeDoc's documented `ProjectReflection` shape at schema version 2.0
 * rather than captured from a run: TypeDoc is not a dependency of this package
 * and nothing in the repository pulls it in, and the rule here is that a
 * generator adds no dependency a product repository would then have to
 * install. Regenerating it is one command in a scratch directory --
 * `npx typedoc --json api.json --entryPoints src/index.ts` from
 * `fixtures/typedoc` -- and the file the run writes should replace this one
 * the first time TypeDoc is installed for another reason.
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import {
  TsrefSchemaError,
  extractModel,
  parseTypedocJson,
  readTypedocJson,
  renderComment,
  summarize,
  typeText,
} from './lib/tsref-extract.mjs';
import { renderReference } from './lib/reference-render.mjs';
import {
  flattenModules,
  flattenSymbols,
  validateReferenceModel,
} from '../reference-model.ts';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/typedoc/api.json',
);

const project = await readTypedocJson(FIXTURE);

/** The fixture as a model, with the warnings the run produced. */
const extract = (options = {}) =>
  extractModel(project, options, { schema: 'urn:test:schema' });

const { model, warnings } = extract();
const root = model.modules[0];
/** Every symbol in the model, on the root module and in the namespace alike. */
const everySymbol = (value = model) =>
  flattenModules(value).flatMap((module) => flattenSymbols(module));
const find = (id) => everySymbol().find((symbol) => symbol.id.endsWith(id));

test('a file that is not a TypeDoc dump is refused, not misread', async () => {
  await assert.rejects(
    () => readTypedocJson(join(FIXTURE, 'nope.json')),
    TsrefSchemaError,
  );
  assert.throws(() => parseTypedocJson([]), /is not an object/);
  assert.throws(
    () => parseTypedocJson({ kind: 2, variant: 'declaration' }),
    /expected 1/,
  );
  assert.throws(
    () => parseTypedocJson({ kind: 1, variant: 'project', children: [] }),
    /documented nothing/,
  );
});

test('the project becomes the root module, named for the package', () => {
  assert.equal(model.name, '@ambiqai/helia-sample');
  assert.equal(model.language, 'typescript');
  assert.deepEqual(model.generatedFrom, { tool: 'tsref', version: '2.0' });
  assert.equal(model.modules.length, 1);
  assert.equal(root.path, 'ambiqai-helia-sample');
  assert.equal(root.summary, 'A miniature HELIA runtime, in TypeScript.');
  assert.match(root.description, /Deliberately small and deliberately varied/);
  assert.deepEqual(warnings, []);
  assert.equal(
    extract({ name: 'helia-sdk' }).model.modules[0].path,
    'helia-sdk',
  );
});

test('every reflection kind lands on the model kind it maps to', () => {
  assert.deepEqual(
    root.symbols.map((symbol) => [symbol.name, symbol.kind]),
    [
      ['Status', 'enum'],
      ['ModelRunner', 'class'],
      /* An interface and a type alias are both a name for a shape. */
      ['ModelConfig', 'type'],
      ['Precision', 'type'],
      ['MAX_ARENA_BYTES', 'constant'],
      ['loadModel', 'function'],
      ['describeStatus', 'function'],
    ],
  );
  for (const symbol of everySymbol())
    assert.equal(symbol.language, 'typescript');
  /* Seven top-level symbols, nine nested members, and the namespace's one. */
  assert.equal(everySymbol().length, 17);
});

test('a namespace becomes a module of its own, not a symbol', () => {
  assert.equal(root.submodules.length, 1);
  const [tensors] = root.submodules;
  assert.equal(tensors.path, 'ambiqai-helia-sample.tensors');
  assert.equal(tensors.name, 'tensors');
  assert.equal(
    tensors.summary,
    'Helpers for building the tensors a model takes.',
  );
  assert.deepEqual(
    tensors.symbols.map((symbol) => [symbol.id, symbol.kind]),
    [['@ambiqai/helia-sample.tensors.zeros', 'function']],
  );
});

test('an enum carries its values as constants, with their initializers', () => {
  const status = find('.Status');
  assert.equal(status.signature, 'enum Status');
  assert.deepEqual(
    status.members.map((member) => [
      member.id,
      member.kind,
      member.signature,
      member.summary,
    ]),
    [
      [
        '@ambiqai/helia-sample.Status.Ok',
        'constant',
        'Ok = 0',
        'The call succeeded.',
      ],
      [
        '@ambiqai/helia-sample.Status.BadArgument',
        'constant',
        'BadArgument = 1',
        'An argument was missing or out of range.',
      ],
      [
        '@ambiqai/helia-sample.Status.OutOfMemory',
        'constant',
        'OutOfMemory = 2',
        'The arena could not satisfy the allocation.',
      ],
    ],
  );
});

test('a class nests its constructor, property and method as members', () => {
  const runner = find('.ModelRunner');
  assert.equal(runner.signature, 'class ModelRunner');
  assert.deepEqual(
    runner.members.map((member) => [
      member.name,
      member.kind,
      member.signature,
    ]),
    [
      ['constructor', 'method', 'constructor(name: string): ModelRunner'],
      ['name', 'attribute', 'readonly name: string'],
      [
        'run',
        'method',
        'run(input: Float32Array, scratch?: Float32Array): Float32Array',
      ],
    ],
  );
});

test('an interface keeps its optional properties optional', () => {
  const config = find('.ModelConfig');
  assert.equal(config.signature, 'interface ModelConfig');
  assert.equal(config.since, '0.2');
  assert.deepEqual(
    config.members.map((member) => member.signature),
    ['arenaBytes: number', 'name?: string', 'precision?: Precision'],
  );
});

test('a type alias and a const are spelled the way TypeScript spells them', () => {
  assert.equal(
    find('.Precision').signature,
    'type Precision = "f32" | "f16" | "int8"',
  );
  /* The inferred type of a literal const is the literal, so annotating it
   * would tell the reader the same number twice. */
  assert.equal(
    find('.MAX_ARENA_BYTES').signature,
    'const MAX_ARENA_BYTES = 1048576',
  );
});

test('a parameter default reaches the model and the declaration', () => {
  const load = find('.loadModel');
  assert.equal(
    load.signature,
    'function loadModel(source: string, config: ModelConfig = { arenaBytes: 65536 }): ModelRunner',
  );
  assert.deepEqual(load.params, [
    {
      name: 'source',
      description: 'Descriptor name to load.',
      type: 'string',
    },
    {
      name: 'config',
      description: 'Arena and precision for the model.',
      type: 'ModelConfig',
      default: '{ arenaBytes: 65536 }',
    },
  ]);
  assert.deepEqual(find('.describeStatus').params[1], {
    name: 'verbose',
    description: 'Whether to append the numeric value.',
    type: 'boolean',
    default: 'false',
  });
  assert.deepEqual(find('tensors.zeros').params[1].default, "'f32'");
});

test('@throws becomes a raise carrying the type it names', () => {
  assert.deepEqual(find('.loadModel').raises, [
    {
      description: 'when `config.arenaBytes` exceeds `MAX_ARENA_BYTES`.',
      type: 'RangeError',
    },
  ]);
  assert.deepEqual(find('.ModelRunner.run').raises, [
    {
      description: 'when `input` is not the length the model expects.',
      type: 'RangeError',
    },
  ]);
  assert.deepEqual(find('tensors.zeros').raises, [
    { description: 'when `length` is negative.', type: 'RangeError' },
  ]);
});

test('@returns takes the declared return type, not a repeated sentence', () => {
  assert.deepEqual(find('.loadModel').returns, [
    { description: 'A runner bound to the arena.', type: 'ModelRunner' },
  ]);
  /* Everything the tags claimed is out of the prose, so a reader does not meet
   * the same sentence twice. */
  assert.equal(
    find('.loadModel').description,
    'Load a model into a fresh arena.',
  );
});

test('@since, @deprecated and @example land on their own fields', () => {
  assert.equal(find('.ModelRunner.run').since, '0.3');
  assert.equal(find('.loadModel').since, '0.2');
  assert.equal(find('.loadModel').deprecated, undefined);
  assert.equal(
    find('.describeStatus').deprecated,
    'Use the `Status` enum directly; this table is not localized.',
  );
  assert.deepEqual(find('.ModelRunner.run').examples, [
    {
      code: "const runner = loadModel('kws');\nconst output = runner.run(new Float32Array(320));",
      language: 'ts',
      description: 'Run a single frame through a freshly loaded model.',
    },
  ]);
});

test('comment parts render to Markdown, with links as inline code', () => {
  assert.equal(
    renderComment([
      { kind: 'text', text: 'Bytes, up to ' },
      { kind: 'inline-tag', tag: '@link', text: 'MAX_ARENA_BYTES', target: 24 },
      { kind: 'text', text: ', held in ' },
      { kind: 'code', text: '`arena`' },
      { kind: 'text', text: '.' },
    ]),
    'Bytes, up to `MAX_ARENA_BYTES`, held in `arena`.',
  );
  assert.equal(summarize('One. Two.'), 'One.');
  assert.equal(summarize('**No** `markup` here'), 'No markup here');
});

test('a structured type is rebuilt as the source text a reader would write', () => {
  assert.equal(
    typeText({
      type: 'array',
      elementType: {
        type: 'union',
        types: [
          { type: 'intrinsic', name: 'string' },
          { type: 'literal', value: null },
        ],
      },
    }),
    '(string | null)[]',
  );
  assert.equal(
    typeText({
      type: 'reference',
      name: 'Promise',
      target: 1,
      typeArguments: [{ type: 'intrinsic', name: 'void' }],
    }),
    'Promise<void>',
  );
});

test('source paths are recorded and can be linked to a code host', () => {
  assert.deepEqual(find('.loadModel').source, {
    path: 'src/index.ts',
    line: 84,
  });
  const linked = extract({
    sourceUrl: 'https://example.test/blob/main/{path}#L{line}',
  }).model.modules[0];
  assert.deepEqual(
    linked.symbols.find((symbol) => symbol.name === 'loadModel').source,
    {
      path: 'src/index.ts',
      line: 84,
      url: 'https://example.test/blob/main/src/index.ts#L84',
    },
  );
});

test('a stale @param is reported rather than rendered as a row', () => {
  const stale = {
    kind: 1,
    variant: 'project',
    name: 'stale',
    children: [
      {
        id: 1,
        name: 'f',
        variant: 'declaration',
        kind: 64,
        flags: {},
        sources: [{ fileName: 'src/f.ts', line: 1, character: 0 }],
        signatures: [
          {
            id: 2,
            name: 'f',
            variant: 'signature',
            kind: 4096,
            flags: {},
            comment: {
              summary: [{ kind: 'text', text: 'Takes one thing.' }],
              blockTags: [
                {
                  tag: '@param',
                  name: 'gone',
                  content: [{ kind: 'text', text: 'Not a parameter.' }],
                },
              ],
            },
            parameters: [
              {
                id: 3,
                name: 'here',
                variant: 'param',
                kind: 32768,
                flags: {},
                type: { type: 'intrinsic', name: 'string' },
              },
            ],
            type: { type: 'intrinsic', name: 'void' },
          },
        ],
      },
    ],
  };
  const result = extractModel(parseTypedocJson(stale), { name: 'stale' });
  assert.deepEqual(result.warnings, [
    'stale.f: documents a parameter "gone" it does not declare',
  ]);
  assert.deepEqual(result.model.modules[0].symbols[0].params, [
    { name: 'here', description: '', type: 'string' },
  ]);
});

/* -------------------------------------------------------------------------
 * Through the shared renderer
 * ---------------------------------------------------------------------- */

const options = { base: '/helia-sdk/', routePrefix: 'reference/api' };
const rendered = renderReference(model, options);

test('the extracted model is a reference model the guard accepts', () => {
  assert.deepEqual(validateReferenceModel(model), model);
});

test('the TypeScript reference renders the page set the other two do', () => {
  assert.deepEqual(
    rendered.pages.map((page) => page.path),
    [
      'ambiqai-helia-sample/index.mdx',
      'ambiqai-helia-sample/tensors/index.mdx',
    ],
  );
  assert.deepEqual(
    rendered.artifacts.map((artifact) => artifact.path),
    [
      'reference/api/reference.json',
      'reference/api/ambiqai-helia-sample.json',
      'reference/api/ambiqai-helia-sample/tensors.json',
      'reference/api/llms.txt',
      'reference/api/llms-full.txt',
    ],
  );
  assert.deepEqual(rendered.warnings, []);
});

test('a symbol page carries the anchors a link is written against', () => {
  const page = rendered.pages[0];
  assert.equal(page.route, '/helia-sdk/reference/api/ambiqai-helia-sample/');
  assert.deepEqual(page.anchors.slice(0, 5), [
    '@ambiqai/helia-sample.Status',
    '@ambiqai/helia-sample.Status.Ok',
    '@ambiqai/helia-sample.Status.BadArgument',
    '@ambiqai/helia-sample.Status.OutOfMemory',
    '@ambiqai/helia-sample.ModelRunner',
  ]);
  assert.match(page.mdx, /language=\{"typescript"\}/);
  assert.match(page.mdx, /kind=\{"class"\}/);
  assert.match(page.mdx, /"name":"config","type":"ModelConfig"/);
  assert.match(page.mdx, /deprecated=\{"Use the `Status` enum directly/);
});

test('llms-full.txt is the reference as Markdown, signatures and all', () => {
  const full = rendered.artifacts.find((artifact) =>
    artifact.path.endsWith('llms-full.txt'),
  ).contents;
  assert.match(full, /```typescript\nenum Status\n```/);
  assert.match(full, /`constant` · `typescript`/);
  assert.match(full, /Available since 0\.3\./);
  assert.match(full, /\*\*Deprecated\.\*\* Use the `Status` enum directly/);
});
