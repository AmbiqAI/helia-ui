// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The converter's contract with MkDocs Material, one rewrite at a time.
 *
 * The fixtures are the smallest page that carries each feature, so a failure
 * names the rewrite that broke rather than a diff of a whole page. The real
 * pages are covered elsewhere: the tool is run against a product's `docs/` and
 * the output diffed against what the site already serves.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ASIDE,
  SnippetError,
  buildSidebar,
  convertPage,
  createState,
  navPaths,
  normaliseBase,
  parseNav,
  slugFor,
} from './lib/mkdocs-convert-render.mjs';

const ICONS = JSON.parse(
  readFileSync(new URL('./lib/material-icons.json', import.meta.url), 'utf8'),
);

const lines = (...ls) => ls.join('\n');

/** Convert a fixture with a fresh tally, returning both. */
function convert(raw, { relPath = 'guide.md', base = '/site' } = {}) {
  const state = createState();
  const page = convertPage(raw, relPath, { state, icons: ICONS, base });
  return { ...page, state, counts: state.counts };
}

test('front matter comes from the H1 and the lead paragraph', () => {
  const { text, title, description } = convert(
    lines(
      '# Build a model',
      '',
      'How to take a model through the compiler.',
      '',
      '## Steps',
    ),
  );
  assert.equal(title, 'Build a model');
  assert.equal(description, 'How to take a model through the compiler.');
  assert.match(
    text,
    /^---\ntitle: "Build a model"\ndescription: "How to take a model/,
  );
  /* The H1 is the frontmatter title, so Starlight does not render it twice. */
  assert.doesNotMatch(text, /^# Build a model$/m);
});

test('a page with no H1 derives its title from the filename and is reported', () => {
  const state = createState();
  const page = convertPage('Body text.\n', 'how-to/model-attributes.md', {
    state,
    icons: ICONS,
  });
  assert.equal(page.title, 'Model Attributes');
  assert.deepEqual(state.missingTitle, ['how-to/model-attributes.md']);
});

test('a long lead paragraph is cut to a description on a word boundary', () => {
  const long = `${'word '.repeat(60)}end.`;
  const { description } = convert(lines('# T', '', long));
  assert.ok(description.length <= 161, description.length);
  assert.ok(description.endsWith('…'));
  assert.doesNotMatch(description, /wor…$/);
});

test('admonitions become asides, with and without a title', () => {
  const { text, counts } = convert(
    lines(
      '# T',
      '',
      '!!! note "Read this"',
      '    Body line.',
      '',
      '!!! warning',
      '    Careful.',
    ),
  );
  assert.match(text, /:::note\[Read this\]\nBody line\.\n:::/);
  assert.match(text, /:::caution\nCareful\.\n:::/);
  assert.equal(counts.admonitions, 2);
  assert.equal(counts.collapsibleAdmonitions, 0);
});

test('the migration table mapping holds for the collapsed types', () => {
  /* Starlight's Aside takes four types; everything else collapses onto them. */
  assert.deepEqual(
    Object.fromEntries(
      [
        'success',
        'info',
        'question',
        'example',
        'quote',
        'abstract',
        'failure',
        'bug',
        'important',
      ].map((t) => [t, ASIDE[t]]),
    ),
    {
      success: 'tip',
      info: 'note',
      question: 'note',
      example: 'note',
      quote: 'note',
      abstract: 'note',
      failure: 'caution',
      bug: 'danger',
      important: 'tip',
    },
  );
});

test('a collapsible admonition is counted and still an aside', () => {
  const { text, counts } = convert(
    lines('# T', '', '???+ tip "Open"', '    Body.'),
  );
  assert.match(text, /:::tip\[Open\]/);
  assert.equal(counts.collapsibleAdmonitions, 1);
});

test('a quote admonition asks for a hand pass', () => {
  const { handPass } = convert(lines('# T', '', '!!! quote', '    Said so.'));
  assert.ok(
    handPass.some((h) => h.includes('prefers a blockquote')),
    handPass.join(';'),
  );
});

test('an unknown admonition type falls back to note and asks for a hand pass', () => {
  const { text, handPass } = convert(
    lines('# T', '', '!!! nonsense', '    Body.'),
  );
  assert.match(text, /:::note\nBody\./);
  assert.ok(
    handPass.some((h) => h.includes('unknown admonition type "nonsense"')),
  );
});

test('content tabs become Tabs and TabItem with the import', () => {
  const { text, counts } = convert(
    lines(
      '# T',
      '',
      '=== "Linux"',
      '    Run it.',
      '',
      '=== "macOS"',
      '    Run it too.',
    ),
  );
  assert.match(
    text,
    /import \{ Tabs, TabItem \} from '@astrojs\/starlight\/components';/,
  );
  assert.match(text, /<Tabs>/);
  assert.match(text, /<TabItem label="Linux">/);
  assert.match(text, /<TabItem label="macOS">/);
  assert.equal(counts.tabGroups, 1);
  assert.equal(counts.tabItems, 2);
});

test('a mapped icon becomes an Icon element and pulls its import', () => {
  const { text, counts } = convert(
    lines('# T', '', 'Fast :material-rocket-launch: start.'),
  );
  assert.match(text, /import Icon from '@ambiqai\/helia-ui\/astro\/Icon';/);
  assert.match(text, /Fast <Icon name="rocket" \/> start\./);
  assert.equal(counts.icons, 1);
  assert.equal(counts.unmappedIcons, 0);
});

test('an unmapped icon is a visible marker, not a guess', () => {
  const { text, counts, state } = convert(
    lines('# T', '', 'A :material-not-an-icon: here.'),
  );
  assert.match(text, /\[unmapped icon: not-an-icon\]/);
  assert.equal(counts.unmappedIcons, 1);
  assert.equal(state.unmapped.get('not-an-icon'), 1);
  assert.doesNotMatch(text, /import Icon from/);
});

test('relative links are re-expressed against the route, not the source path', () => {
  /* `how-to/build.md` is read at `how-to/build/`, one level deeper than its
   * directory, which is what a naive copy of the target gets wrong. */
  const { text, counts } = convert(
    lines(
      '# T',
      '',
      'See [reference](../reference/index.md) and [next](other.md#anchor).',
    ),
    { relPath: 'how-to/build.md' },
  );
  assert.match(text, /\[reference\]\(\.\.\/\.\.\/reference\/\)/);
  assert.match(text, /\[next\]\(\.\.\/other\/#anchor\)/);
  assert.equal(counts.links, 2);
});

test('a root-relative link picks up the site base', () => {
  const { text, counts } = convert(lines('# T', '', 'See [home](/usage/).'), {
    base: '/site',
  });
  assert.match(text, /\[home\]\(\/site\/usage\/\)/);
  assert.equal(counts.baseRelativeLinks, 1);
});

test('a link already under the base, and an external link, are left alone', () => {
  const { text, counts } = convert(
    lines(
      '# T',
      '',
      '[a](/site/usage/) [b](https://ambiq.com) [c](mailto:x@y.z) [d](#anchor)',
    ),
    { base: '/site' },
  );
  assert.match(text, /\[a\]\(\/site\/usage\/\)/);
  assert.match(text, /\[b\]\(https:\/\/ambiq\.com\)/);
  assert.match(text, /\[c\]\(mailto:x@y\.z\)/);
  assert.match(text, /\[d\]\(#anchor\)/);
  assert.equal(counts.baseRelativeLinks, 0);
});

test('an image is rewritten and reported for copying', () => {
  const { text, images, counts } = convert(
    lines('# T', '', '![Chart](../assets/chart.png)'),
    {
      relPath: 'how-to/build.md',
    },
  );
  assert.match(text, /!\[Chart\]\(\.\.\/\.\.\/assets\/chart\.png\)/);
  assert.deepEqual(images, ['assets/chart.png']);
  assert.equal(counts.images, 1);
});

test('a termy block becomes an AsciiTerminal with the transcript kinds', () => {
  const { text, counts } = convert(
    lines(
      '# T',
      '',
      '<div class="termy">',
      '',
      '```console',
      '$ helia build',
      '# a comment',
      'output line',
      '```',
      '',
      '</div>',
    ),
  );
  assert.match(
    text,
    /import AsciiTerminal from '@ambiqai\/helia-ui\/astro\/AsciiTerminal';/,
  );
  assert.match(text, /<AsciiTerminal/);
  const payload = JSON.parse(text.match(/lines=\{(\[.*?\])\}/s)[1]);
  assert.deepEqual(payload, [
    { text: 'helia build', kind: 'command' },
    { text: '# a comment', kind: 'muted' },
    { text: 'output line', kind: 'output' },
  ]);
  assert.equal(counts.terminals, 1);
});

test('an HTML comment becomes a JSX expression comment', () => {
  const { text, counts } = convert(
    lines('# T', '', '<!-- hidden note -->', '', 'Body.'),
  );
  assert.match(text, /\{\/\* hidden note \*\/\}/);
  assert.doesNotMatch(text, /<!--/);
  assert.equal(counts.htmlComments, 1);
});

test('attribute lists and markdown-in-HTML attributes are stripped', () => {
  const { text, counts } = convert(
    lines(
      '# T',
      '',
      'Lead.',
      '',
      'Text { .class }',
      '',
      '<div class="grid" markdown>',
      'Body.',
      '</div>',
    ),
  );
  assert.doesNotMatch(text, /\{ \.class \}/);
  assert.match(text, /<div class="grid">/);
  assert.equal(counts.attrListsStripped, 1);
  assert.equal(counts.mdInHtmlAttrs, 1);
});

test('void tags are closed for MDX', () => {
  const { text, counts } = convert(
    lines('# T', '', '<div><img src="a.png"><br></div>'),
  );
  assert.match(text, /<img src="a\.png" \/>/);
  assert.match(text, /<br \/>/);
  assert.equal(counts.voidTagsClosed, 2);
});

test('raw HTML blocks are kept verbatim and listed for the hand pass', () => {
  const { counts, handPass } = convert(
    lines('# T', '', '<section class="cards">', '</section>'),
  );
  assert.equal(counts.rawHtmlBlocks, 1);
  assert.ok(handPass.some((h) => h.includes('raw HTML block')));
});

test('a chart canvas is counted and listed for the hand pass', () => {
  const { counts, handPass } = convert(
    lines('# T', '', '<canvas data-chart-config="a.json"></canvas>'),
  );
  assert.equal(counts.charts, 1);
  assert.ok(handPass.some((h) => h.includes('Chart.js')));
});

test('prose that meant a brace or an angle bracket literally is escaped', () => {
  const { text } = convert(
    lines('# T', '', 'Lead.', '', 'Pass <prefix> and {value}, not `x < y`.'),
  );
  assert.match(text, /&lt;prefix>/);
  assert.match(text, /\\\{value\\\}/);
  /* Code spans are exempt: MDX does not read inside them. */
  assert.match(text, /`x < y`/);
});

test('a table-reader macro leaves a marker and asks for a DataTable', () => {
  const { text, counts, handPass } = convert(
    lines('# T', '', "{{ read_csv('./assets/ops.csv') }}"),
  );
  assert.match(text, /\[table-reader: read_csv\('\.\/assets\/ops\.csv'\)\]/);
  assert.equal(counts.tableReaderMacros, 1);
  assert.ok(handPass.some((h) => h.includes('DataTable')));
});

test('fenced code is left alone and mermaid and math are counted', () => {
  const { text, counts } = convert(
    lines(
      '# T',
      '',
      'Inline $a_1$ math.',
      '',
      '```mermaid',
      'graph TD; A-->B;',
      '```',
      '',
      '```python',
      'x = {"a": 1}  # not escaped',
      'print(x, "<not a tag>")',
      '```',
    ),
  );
  assert.equal(counts.mermaidBlocks, 1);
  assert.equal(counts.mathExpressions, 1);
  assert.match(text, /x = \{"a": 1\}  # not escaped/);
  assert.match(text, /print\(x, "<not a tag>"\)/);
  assert.match(text, /Inline \$a_1\$ math\./);
});

test('a pymdownx snippet fails loudly rather than dropping content', () => {
  assert.throws(
    () => convert(lines('# T', '', '--8<-- "shared/note.md"')),
    (err) => err instanceof SnippetError && /--8<--/.test(err.message),
  );
});

test('converting the same page twice gives the same output and the same tallies', () => {
  const raw = lines(
    '# Build',
    '',
    'Lead paragraph.',
    '',
    '!!! note "Read"',
    '    Body with :material-rocket: and [a link](../usage/index.md).',
    '',
    '=== "Linux"',
    '    Tab body.',
  );
  const first = convert(raw, { relPath: 'how-to/build.md' });
  const second = convert(raw, { relPath: 'how-to/build.md' });
  assert.equal(first.text, second.text);
  assert.deepEqual(first.counts, second.counts);

  /* The tool is re-run over a tree that has not changed, so a second pass over
   * one state must add the same amounts rather than drift. */
  const state = createState();
  convertPage(raw, 'how-to/build.md', { state, icons: ICONS, base: '/site' });
  const afterOne = { ...state.counts };
  convertPage(raw, 'how-to/build.md', { state, icons: ICONS, base: '/site' });
  for (const [k, v] of Object.entries(state.counts))
    assert.equal(v, afterOne[k] * 2, k);
});

test('a site base is normalised to one leading and no trailing slash', () => {
  assert.equal(normaliseBase('/helia-aot/'), '/helia-aot');
  assert.equal(normaliseBase('helia-aot'), '/helia-aot');
  assert.equal(normaliseBase('/'), '');
  assert.equal(normaliseBase(undefined), '');
});

test('the mkdocs nav parses into groups, pages and bare paths', () => {
  const nav = parseNav(
    lines(
      'site_name: Thing',
      'nav:',
      '  - Home: index.md',
      '  - Getting Started:',
      '    - Install: usage/install.md',
      '    - usage/overview.md',
      '  - Reference:',
      '    - Commands:',
      '      - reference/commands/index.md',
      '  - API: api/',
      '',
      'theme:',
      '  name: material',
    ),
  );
  assert.deepEqual(nav, [
    { label: 'Home', path: 'index.md' },
    {
      label: 'Getting Started',
      items: [
        { label: 'Install', path: 'usage/install.md' },
        { label: null, path: 'usage/overview.md' },
      ],
    },
    {
      label: 'Reference',
      items: [
        {
          label: 'Commands',
          items: [{ label: null, path: 'reference/commands/index.md' }],
        },
      ],
    },
    { label: 'API', path: 'api/' },
  ]);
  assert.deepEqual(navPaths(nav), [
    'index.md',
    'usage/install.md',
    'usage/overview.md',
    'reference/commands/index.md',
  ]);
});

test('a nav with no nav: block is empty rather than a guess', () => {
  assert.deepEqual(
    parseNav('site_name: Thing\ntheme:\n  name: material\n'),
    [],
  );
});

test('the sidebar fragment keeps groups and routes pages at their slug', () => {
  const nav = parseNav(
    lines(
      'nav:',
      '  - Home: index.md',
      '  - Guides:',
      '    - Install: usage/install.md',
      '    - usage/overview.md',
      '  - API: api/',
    ),
  );
  assert.deepEqual(buildSidebar(nav, { 'usage/overview.md': 'Overview' }), [
    /* The site root is the empty slug, which is how the template's own
     * sidebar names its overview page. */
    { label: 'Home', slug: '' },
    {
      label: 'Guides',
      items: [
        { label: 'Install', slug: 'usage/install' },
        { label: 'Overview', slug: 'usage/overview' },
      ],
    },
    { label: 'API', slug: 'api' },
  ]);
});

test('an unlabelled nav entry with no known title falls back to the filename', () => {
  assert.deepEqual(
    buildSidebar([{ label: null, path: 'how-to/model-attributes.md' }]),
    [{ label: 'Model Attributes', slug: 'how-to/model-attributes' }],
  );
});

test('slugs drop the index segment and any trailing slash', () => {
  assert.equal(slugFor('usage/index.md'), 'usage');
  assert.equal(slugFor('usage/install.md'), 'usage/install');
  assert.equal(slugFor('api/'), 'api');
  assert.equal(slugFor('index.md'), '');
});

test('every icon in the map has a kebab-case Font Awesome name', () => {
  for (const [material, fa] of Object.entries(ICONS)) {
    assert.match(material, /^[a-z0-9-]+$/, material);
    assert.match(fa, /^[a-z0-9-]+$/, `${material} -> ${fa}`);
  }
});
