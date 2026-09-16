// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The renderer's contract, from a hand-written model rather than a griffe dump:
 * the shape of a page, the anchors that have to outlive it, and the artifacts
 * an agent reads instead of it.
 *
 * The model here is written out in full on purpose. It is the thing extractors
 * are asked to produce, so a test that built it with helpers would hide the
 * one question these assertions exist to answer: what does a reference look
 * like as data.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ReferenceRenderError,
  buildSidebar,
  canonicalJson,
  renderReference,
  slugSegment,
} from './lib/reference-render.mjs';
import { validateReferenceModel } from '../reference-model.ts';

const symbol = (overrides) => ({
  kind: 'function',
  language: 'python',
  signature: 'run()',
  summary: '',
  description: '',
  params: [],
  returns: [],
  raises: [],
  examples: [],
  source: { path: 'src/pkg/__init__.py', line: 12 },
  members: [],
  ...overrides,
});

const model = {
  name: 'pkg',
  language: 'python',
  generatedFrom: { tool: 'pyref', version: '1.7.3', sourceCommit: 'abc1234' },
  modules: [
    {
      path: 'pkg',
      name: 'pkg',
      summary: 'The package.',
      description: 'The package. See [run][pkg.run] and [core][pkg.core].',
      symbols: [
        symbol({
          id: 'pkg.run',
          name: 'run',
          signature: 'run(path: str, retries: int = 3) -> Result',
          summary: 'Run it.',
          description: 'Prose with {braces} and a <placeholder> in it.',
          params: [
            { name: 'path', type: 'str', description: 'Where.' },
            {
              name: 'retries',
              type: 'int',
              default: '3',
              description: 'How often.',
            },
          ],
          returns: [{ type: 'Result', description: 'What happened.' }],
          raises: [{ type: 'ValueError', description: 'Bad path.' }],
          examples: [{ code: 'run("a")', language: 'python' }],
        }),
        symbol({
          id: 'pkg.Handler',
          name: 'Handler',
          kind: 'class',
          signature: 'Handler()',
          summary: 'Handles things.',
          since: '0.8',
          deprecated: 'Since 0.9. Use `Runner` instead.',
          members: [
            symbol({
              id: 'pkg.Handler.resolve',
              name: 'resolve',
              kind: 'method',
              signature: 'resolve() -> bool',
              summary: 'Resolve it.',
            }),
          ],
        }),
      ],
      submodules: [
        {
          path: 'pkg.core',
          name: 'core',
          summary: 'The core.',
          description: '',
          symbols: [],
          submodules: [],
        },
      ],
    },
  ],
};

const options = { base: '/site/', routePrefix: 'reference/api' };

const render = (overrides = {}) =>
  renderReference(model, { ...options, ...overrides });

const pageFor = (result, path) =>
  result.pages.find((page) => page.path === path);

const artifactFor = (result, path) =>
  result.artifacts.find((artifact) => artifact.path === path);

test('one page per module, at the module path under the route prefix', () => {
  const { pages } = render();
  assert.deepEqual(
    pages.map((page) => page.path),
    ['pkg/index.mdx', 'pkg/core/index.mdx'],
  );
  assert.equal(pages[0].route, '/site/reference/api/pkg/');
});

test('a page imports the parts it composes and one RefSymbol per symbol', () => {
  const { mdx } = pageFor(render(), 'pkg/index.mdx');

  assert.match(mdx, /^---\ntitle: "pkg"\ndescription: "The package\."/);
  assert.match(
    mdx,
    /import RefSymbol from '@ambiqai\/helia-ui\/astro\/RefSymbol';/,
  );
  assert.match(
    mdx,
    /import RefParams from '@ambiqai\/helia-ui\/astro\/RefParams';/,
  );
  assert.match(
    mdx,
    /import RefSection from '@ambiqai\/helia-ui\/astro\/RefSection';/,
  );
  assert.match(
    mdx,
    /import RefMembers from '@ambiqai\/helia-ui\/astro\/RefMembers';/,
  );

  /* Three entries: the two module symbols and the class's one method. */
  assert.equal(mdx.match(/<RefSymbol\n/g).length, 3);
  assert.equal(mdx.match(/<\/RefSymbol>/g).length, 3);
});

test('the symbol id is the anchor, so an old mkdocstrings link still resolves', () => {
  const page = pageFor(render(), 'pkg/index.mdx');
  assert.deepEqual(page.anchors, [
    'pkg.run',
    'pkg.Handler',
    'pkg.Handler.resolve',
  ]);
  assert.match(page.mdx, /id=\{"pkg\.Handler\.resolve"\}/);
});

test('parameters become a RefParams with the four columns', () => {
  const { mdx } = pageFor(render(), 'pkg/index.mdx');
  const rows = JSON.parse(/rows=\{(\[\{"name":"path".*?\}\])\}/s.exec(mdx)[1]);
  assert.deepEqual(rows, [
    { name: 'path', type: 'str', default: 'Required', description: 'Where.' },
    { name: 'retries', type: 'int', default: '3', description: 'How often.' },
  ]);
  assert.match(mdx, /<RefSection title="Parameters">/);
  assert.match(mdx, /<RefSection title="Returns">/);
  assert.match(mdx, /<RefSection title="Raises">/);
  assert.match(mdx, /<RefSection title="Examples">/);
});

test('a symbol carries its since and deprecated marks', () => {
  const { mdx } = pageFor(render(), 'pkg/index.mdx');
  assert.match(mdx, /since=\{"0\.8"\}/);
  assert.match(mdx, /deprecated=\{"Since 0\.9\. Use `Runner` instead\."\}/);
});

test('a cross-reference resolves to a base-prefixed route and anchor', () => {
  const { mdx } = pageFor(render(), 'pkg/index.mdx');
  assert.match(mdx, /\[run\]\(\/site\/reference\/api\/pkg\/#pkg\.run\)/);
  assert.match(mdx, /\[core\]\(\/site\/reference\/api\/pkg\/core\/\)/);
});

test('an unresolved cross-reference becomes plain text and warns', () => {
  const broken = structuredClone(model);
  broken.modules[0].description = 'See [gone][pkg.gone].';
  const { pages, warnings } = renderReference(broken, options);
  assert.match(pages[0].mdx, /See gone\./);
  assert.deepEqual(warnings, [
    'pkg: unresolved cross-reference [gone][pkg.gone]',
  ]);
});

test('prose that MDX would read as syntax is escaped', () => {
  const { mdx } = pageFor(render(), 'pkg/index.mdx');
  assert.match(mdx, /Prose with \\\{braces\\\} and a &lt;placeholder> in it\./);
});

test('every page links to its own module JSON', () => {
  const { pages } = render();
  assert.match(
    pageFor({ pages }, 'pkg/index.mdx').mdx,
    /\[Machine-readable model\]\(\/site\/reference\/api\/pkg\.json\)/,
  );
  assert.match(
    pageFor({ pages }, 'pkg/core/index.mdx').mdx,
    /\[Machine-readable model\]\(\/site\/reference\/api\/pkg\/core\.json\)/,
  );
});

test('the artifacts are the whole model, one file per module, and the text pair', () => {
  const { artifacts } = render();
  assert.deepEqual(
    artifacts.map((artifact) => artifact.path),
    [
      'reference/api/reference.json',
      'reference/api/pkg.json',
      'reference/api/pkg/core.json',
      'reference/api/llms.txt',
      'reference/api/llms-full.txt',
    ],
  );
});

test('reference.json validates against the model guard', () => {
  const whole = JSON.parse(
    artifactFor(render(), 'reference/api/reference.json').contents,
  );
  const validated = validateReferenceModel(whole);
  assert.equal(validated.name, 'pkg');
  assert.equal(validated.$schema.startsWith('https://'), true);
  assert.equal(validated.generatedFrom.sourceCommit, 'abc1234');
  assert.deepEqual(
    validated.modules[0].submodules.map((child) => child.path),
    ['pkg.core'],
  );
});

test('a per-module artifact is that module alone and validates too', () => {
  const one = JSON.parse(
    artifactFor(render(), 'reference/api/pkg.json').contents,
  );
  const validated = validateReferenceModel(one);
  assert.deepEqual(validated.modules[0].submodules, []);
  assert.equal(validated.modules[0].path, 'pkg');
});

test('the JSON is byte-stable: sorted keys and no timestamp', () => {
  const first = artifactFor(render(), 'reference/api/reference.json').contents;
  const second = artifactFor(render(), 'reference/api/reference.json').contents;
  assert.equal(first, second);
  assert.equal(
    canonicalJson({ b: 1, a: { d: 2, c: 3 } }),
    '{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n',
  );
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(first), false);
});

test('llms.txt names the reference and lists every module with its JSON', () => {
  const llms = artifactFor(render(), 'reference/api/llms.txt').contents;
  assert.match(llms, /^# pkg API reference\n\n> The package\./);
  for (const path of ['pkg', 'pkg.core']) {
    assert.match(
      llms,
      new RegExp(`^- \\[${path.replace('.', '\\.')}\\]\\(`, 'm'),
    );
  }
  assert.match(
    llms,
    /- \[pkg\.core\]\(\/site\/reference\/api\/pkg\/core\/\): The core\. \(\[JSON\]\(\/site\/reference\/api\/pkg\/core\.json\)\)/,
  );
  assert.match(
    llms,
    /\[reference\.json\]\(\/site\/reference\/api\/reference\.json\)/,
  );
});

test('llms.txt takes absolute URLs when the site origin is known', () => {
  const llms = artifactFor(
    render({ site: 'https://docs.example.test' }),
    'reference/api/llms.txt',
  ).contents;
  assert.match(
    llms,
    /\(https:\/\/docs\.example\.test\/site\/reference\/api\/pkg\/\)/,
  );
});

test('llms-full.txt is every module as Markdown, in module order', () => {
  const full = artifactFor(render(), 'reference/api/llms-full.txt').contents;
  assert.equal(full.indexOf('# pkg\n') < full.indexOf('# pkg.core\n'), true);
  assert.match(full, /## pkg\.run/);
  assert.match(
    full,
    /```python\nrun\(path: str, retries: int = 3\) -> Result\n```/,
  );
  assert.match(full, /\| Name \| Type \| Default \| Description \|/);
  /* The text artifact is Markdown, not MDX: nothing is escaped for JSX. */
  assert.match(full, /Prose with \{braces\} and a <placeholder> in it\./);
});

test('the sidebar nests by module path with an overview per group', () => {
  assert.deepEqual(
    buildSidebar(model, { ...options, routePrefix: 'reference/api' }),
    {
      label: 'pkg',
      items: [
        { label: 'Overview', slug: 'reference/api/pkg' },
        { label: 'core', slug: 'reference/api/pkg/core' },
      ],
    },
  );
});

test('a model the renderer cannot render fails naming what is missing', () => {
  const broken = structuredClone(model);
  delete broken.modules[0].symbols[0].id;
  assert.throws(() => renderReference(broken, options), ReferenceRenderError);
  assert.throws(
    () => renderReference({ modules: [] }, options),
    /The model has no modules/,
  );
});

test('a route segment is slugged the way Starlight slugs a content id', () => {
  assert.equal(slugSegment('NNConv'), 'nnconv');
  assert.equal(slugSegment('arm_nn_conv_s8'), 'arm_nn_conv_s8');
  assert.equal(slugSegment('Fully Connected'), 'fully-connected');
  assert.equal(slugSegment('Basic Math (int8)'), 'basic-math-int8');
});

test('a mixed-case module path keeps its name and loses its case in the route', () => {
  const mixed = structuredClone(model);
  mixed.modules[0].submodules[0].path = 'pkg.NNConv';
  mixed.modules[0].submodules[0].name = 'NNConv';
  mixed.modules[0].description = 'See [NNConv][pkg.NNConv].';
  const { pages, artifacts, sidebar, nav } = renderReference(mixed, options);

  assert.equal(pages[1].path, 'pkg/nnconv/index.mdx');
  assert.equal(pages[1].route, '/site/reference/api/pkg/nnconv/');
  assert.match(pages[1].mdx, /^---\ntitle: "NNConv"/);
  assert.match(
    pages[0].mdx,
    /\[NNConv\]\(\/site\/reference\/api\/pkg\/nnconv\/\)/,
  );
  assert.equal(
    artifacts.some((artifact) => artifact.path.includes('NNConv')),
    false,
  );
  assert.equal(sidebar.items[1].slug, 'reference/api/pkg/nnconv');
  assert.equal(nav[0].items[0].href, '/site/reference/api/pkg/nnconv/');
  const llms = artifacts.find((artifact) =>
    artifact.path.endsWith('llms.txt'),
  ).contents;
  assert.match(
    llms,
    /\[pkg\.NNConv\]\(\/site\/reference\/api\/pkg\/nnconv\/\)/,
  );
});

test('two module paths that slug to one route fail rather than overwrite', () => {
  const clashing = structuredClone(model);
  clashing.modules[0].submodules.push({
    ...clashing.modules[0].submodules[0],
    path: 'pkg.Core',
    name: 'Core',
  });
  assert.throws(
    () => renderReference(clashing, options),
    /pkg\.core and pkg\.Core are the same route once slugged/,
  );
});

test('a module with no summary still gets a description, in its own language', () => {
  const bare = structuredClone(model);
  bare.modules[0].summary = '';
  bare.modules[0].submodules[0].summary = '';

  const descriptions = (language) => {
    const typed = { ...structuredClone(bare), language };
    return renderReference(typed, options).pages.map(
      (page) => /^description: "(.*)"$/m.exec(page.mdx)[1],
    );
  };

  assert.deepEqual(descriptions('python'), [
    'Classes and functions in pkg.',
    'Classes and functions in core.',
  ]);
  assert.equal(descriptions('c')[1], 'Functions, types and macros in core.');
  assert.equal(descriptions('cpp')[1], 'Functions, types and classes in core.');
  assert.equal(
    descriptions('typescript')[1],
    'Exported types and functions in core.',
  );
});

test('a summary is still the description when the source has one', () => {
  const { pages } = render();
  assert.match(pages[0].mdx, /^description: "The package\."$/m);
  assert.match(pages[1].mdx, /^description: "The core\."$/m);
});

test('a module name that trails into its members is not punctuated twice', () => {
  const titled = structuredClone(model);
  titled.modules[0].submodules[0].summary = '';
  titled.modules[0].submodules[0].name = 'Gather Functions:';
  const { pages } = renderReference(titled, options);
  assert.match(
    pages[1].mdx,
    /^description: "Classes and functions in Gather Functions\."$/m,
  );
});
