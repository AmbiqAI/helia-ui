// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The renderer's contract against mkdocstrings, expressed as the smallest
 * griffe dumps that carry each behaviour: the Google sections, the class
 * merge, the filters, and the two cross-reference outcomes.
 *
 * The fixtures are hand-written rather than captured from a real dump so that
 * a schema change shows up as a failing assertion here and not as a silently
 * different page.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULTS,
  PyrefSchemaError,
  buildSidebar,
  compileFilters,
  parseDump,
  renderAll,
  renderExpr,
} from './lib/pyref-render.mjs';

const name = (n) => ({ cls: 'ExprName', name: n });

const options = { ...DEFAULTS, base: '/site/' };

let lineno = 0;
const at = () => ({ lineno: (lineno += 10) });

const fn = (path, { parameters = [], returns = null, parsed = [] } = {}) => ({
  ...at(),
  kind: 'function',
  name: path.split('.').pop(),
  path,
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
  members,
  labels: [],
  docstring: { parsed },
});

/** Render a one-module package and return its only page. */
function render(members, moduleParsed = [], overrides = {}) {
  const root = mod('pkg', members, moduleParsed);
  const { pages, warnings } = renderAll(root, { ...options, ...overrides });
  return { markdown: pages[0].markdown, page: pages[0], pages, warnings };
}

test('a function renders Args, Returns and Raises as tables', () => {
  const { markdown, warnings } = render({
    convert: fn('pkg.convert', {
      parameters: [
        {
          name: 'path',
          annotation: name('Path'),
          default: null,
          kind: 'positional or keyword',
        },
        {
          name: 'strict',
          annotation: name('bool'),
          default: 'False',
          kind: 'keyword-only',
        },
      ],
      returns: name('Model'),
      parsed: [
        { kind: 'text', value: 'Convert a model.' },
        {
          kind: 'parameters',
          value: [
            {
              name: 'path',
              annotation: name('Path'),
              description: 'Source file.',
              value: null,
            },
            {
              name: 'strict',
              annotation: name('bool'),
              description: 'Fail on warnings.',
              value: 'False',
            },
          ],
        },
        {
          kind: 'returns',
          value: [
            {
              name: '',
              annotation: name('Model'),
              description: 'The converted model.',
            },
          ],
        },
        {
          kind: 'raises',
          value: [
            {
              annotation: name('ValueError'),
              description: 'If the file is empty.',
            },
          ],
        },
      ],
    }),
  });

  assert.equal(warnings.length, 0);
  assert.match(markdown, /^## <span id="pkg\.convert"><\/span>convert$/m);
  assert.match(
    markdown,
    /```python\nconvert\(path: Path, \*, strict: bool = False\) -> Model\n```/,
  );
  assert.match(markdown, /\*\*Parameters\*\*/);
  assert.match(
    markdown,
    /\| `path` \| `Path` \| Source file\. \| _required_ \|/,
  );
  assert.match(
    markdown,
    /\| `strict` \| `bool` \| Fail on warnings\. \| `False` \|/,
  );
  /* No entry is named, so Returns drops the Name column. */
  assert.match(markdown, /\*\*Returns\*\*\n\n\| Type \| Description \|/);
  assert.match(
    markdown,
    /\*\*Raises\*\*\n\n\| Type \| Description \|\n\| --- \| --- \|\n\| `ValueError` \| If the file is empty\. \|/,
  );
});

test('a dataclass renders its Attributes section with the member defaults', () => {
  const { markdown } = render({
    Pad: cls('pkg.Pad', {
      labels: ['dataclass'],
      parsed: [
        { kind: 'text', value: 'Spatial padding.' },
        {
          kind: 'attributes',
          value: [
            {
              name: 'top',
              annotation: name('int'),
              description: 'Padding on the top.',
            },
            {
              name: 'left',
              annotation: name('int'),
              description: 'Padding on the left.',
            },
          ],
        },
      ],
      members: {
        top: {
          ...at(),
          kind: 'attribute',
          name: 'top',
          path: 'pkg.Pad.top',
          members: {},
          labels: ['class-attribute'],
          annotation: name('int'),
          value: '0',
        },
        left: {
          ...at(),
          kind: 'attribute',
          name: 'left',
          path: 'pkg.Pad.left',
          members: {},
          labels: ['class-attribute'],
          annotation: name('int'),
          value: '1',
        },
      },
    }),
  });

  assert.match(markdown, /`dataclass`/);
  assert.match(
    markdown,
    /\*\*Attributes\*\*\n\n\| Name \| Type \| Description \| Default \|/,
  );
  assert.match(markdown, /\| `top` \| `int` \| Padding on the top\. \| `0` \|/);
  assert.match(
    markdown,
    /\| `left` \| `int` \| Padding on the left\. \| `1` \|/,
  );
});

test('__init__ merges into the class and its summary is not repeated', () => {
  const { markdown } = render({
    Handler: cls('pkg.Handler', {
      parsed: [{ kind: 'text', value: 'Base class for handlers.' }],
      members: {
        __init__: fn('pkg.Handler.__init__', {
          parameters: [
            {
              name: 'self',
              annotation: null,
              default: null,
              kind: 'positional or keyword',
            },
            {
              name: 'context',
              annotation: name('Context'),
              default: null,
              kind: 'positional or keyword',
            },
          ],
          parsed: [
            { kind: 'text', value: 'Base class for handlers.' },
            {
              kind: 'parameters',
              value: [
                {
                  name: 'context',
                  annotation: name('Context'),
                  description: 'Codegen context.',
                  value: null,
                },
              ],
            },
          ],
        }),
      },
    }),
  });

  /* The class signature is __init__'s, without the receiver. */
  assert.match(markdown, /```python\nHandler\(context: Context\)\n```/);
  assert.match(
    markdown,
    /\| `context` \| `Context` \| Codegen context\. \| _required_ \|/,
  );
  /* No separate heading for the constructor, and one copy of the summary. */
  assert.doesNotMatch(markdown, /Handler\.__init__/);
  assert.equal(markdown.match(/Base class for handlers\./g).length, 1);
});

test('the default filters drop private members and keep __init__', () => {
  const keep = compileFilters(DEFAULTS.filters);
  assert.equal(keep('__init__'), true);
  assert.equal(keep('public'), true);
  assert.equal(keep('_private'), false);
  assert.equal(keep('__dunder__'), false);

  const { markdown } = render({
    Thing: cls('pkg.Thing', {
      members: {
        visible: fn('pkg.Thing.visible'),
        _hidden: fn('pkg.Thing._hidden'),
      },
    }),
    _helper: fn('pkg._helper'),
  });

  assert.match(markdown, /Thing\.visible/);
  assert.doesNotMatch(markdown, /_hidden/);
  assert.doesNotMatch(markdown, /_helper/);
});

test('a cross-reference resolves to a base-prefixed route and anchor', () => {
  const root = mod('pkg', {
    api: mod('pkg.api', {
      Model: cls('pkg.api.Model', {
        parsed: [{ kind: 'text', value: 'A model.' }],
      }),
    }),
    use: mod('pkg.use', {
      load: fn('pkg.use.load', {
        parsed: [
          { kind: 'text', value: 'Returns a [Model][pkg.api.Model] instance.' },
        ],
      }),
    }),
  });

  const { pages, warnings } = renderAll(root, options);
  const page = pages.find((candidate) => candidate.path === 'pkg/use/index.md');

  assert.equal(warnings.length, 0);
  assert.match(
    page.markdown,
    /\[Model\]\(\/site\/reference\/api\/pkg\/api\/#pkg\.api\.Model\)/,
  );
});

test('an unresolved cross-reference becomes plain text and warns', () => {
  const { markdown, warnings } = render({
    load: fn('pkg.load', {
      parsed: [
        {
          kind: 'text',
          value: 'Returns a [Widget][pkg.nowhere.Widget] instance.',
        },
      ],
    }),
  });

  assert.match(markdown, /Returns a Widget instance\./);
  assert.doesNotMatch(markdown, /\]\(/);
  assert.equal(warnings.length, 1);
  assert.match(
    warnings[0],
    /pkg\.load: unresolved cross-reference \[Widget\]\[pkg\.nowhere\.Widget\]/,
  );
});

test('cross-reference syntax inside code is left alone', () => {
  const { markdown, warnings } = render({
    load: fn('pkg.load', {
      parsed: [
        {
          kind: 'text',
          value:
            'CMSIS layout is `[w][z][y][x]` with x contiguous.\n\n```py\nq = a[w][z]\n```',
        },
      ],
    }),
  });

  assert.equal(warnings.length, 0);
  assert.match(markdown, /`\[w\]\[z\]\[y\]\[x\]`/);
  assert.match(markdown, /q = a\[w\]\[z\]/);
});

test('module docstring headings are shifted below the page title', () => {
  const { markdown } = render({}, [
    { kind: 'text', value: '# API\n\n## Parts\n\n```md\n# not a heading\n```' },
  ]);

  assert.match(markdown, /^## API$/m);
  assert.match(markdown, /^### Parts$/m);
  assert.match(markdown, /^# not a heading$/m);
});

test('frontmatter carries the title, the summary and a sidebar order', () => {
  const { pages } = renderAll(
    mod('pkg', {
      sub: mod('pkg.sub', {}, [
        { kind: 'text', value: 'Does one thing. And another.' },
      ]),
    }),
    options,
  );
  const sub = pages.find((page) => page.path === 'pkg/sub/index.md');

  assert.match(
    sub.markdown,
    /^---\ntitle: "sub"\ndescription: "Does one thing\."\nsidebar:\n {2}order: 1\n---\n/,
  );
  assert.equal(sub.route, 'reference/api/pkg/sub/');
});

test('the sidebar nests by package path with an overview per package', () => {
  const root = mod('pkg', {
    air: mod('pkg.air', { enums: mod('pkg.air.enums', {}) }),
    cli: mod('pkg.cli', {}),
    __main__: mod('pkg.__main__', {}),
  });

  assert.deepEqual(buildSidebar(root, options), {
    label: 'pkg',
    items: [
      { label: 'Overview', slug: 'reference/api/pkg' },
      {
        label: 'air',
        collapsed: true,
        items: [
          { label: 'Overview', slug: 'reference/api/pkg/air' },
          { label: 'enums', slug: 'reference/api/pkg/air/enums' },
        ],
      },
      { label: 'cli', slug: 'reference/api/pkg/cli' },
    ],
  });
});

test('an unknown docstring section is reported rather than dropped silently', () => {
  const { warnings } = render({
    load: fn('pkg.load', { parsed: [{ kind: 'sidenote', value: [] }] }),
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unsupported docstring section "sidenote"/);
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
    () => parseDump({ pkg: { kind: 'module', name: 'pkg' } }),
    /missing path, members/,
  );
  assert.throws(
    () => parseDump({ a: mod('a', {}), b: mod('b', {}) }),
    /Pass --package/,
  );
  assert.equal(parseDump({ pkg: mod('pkg', {}) }).name, 'pkg');
  assert.equal(parseDump({ a: mod('a', {}), b: mod('b', {}) }, 'b').name, 'b');
});

test('annotations render back to Python source', () => {
  assert.equal(
    renderExpr({
      cls: 'ExprSubscript',
      left: name('list'),
      slice: name('int'),
    }),
    'list[int]',
  );
  assert.equal(
    renderExpr({
      cls: 'ExprBinOp',
      left: name('str'),
      operator: '|',
      right: name('None'),
    }),
    'str | None',
  );
  assert.equal(
    renderExpr({
      cls: 'ExprSubscript',
      left: name('tuple'),
      slice: {
        cls: 'ExprTuple',
        elements: [name('int'), '...'],
        implicit: true,
      },
    }),
    'tuple[int, ...]',
  );
  assert.equal(
    renderExpr({ cls: 'ExprAttribute', values: [name('np'), name('int8')] }),
    'np.int8',
  );
});
