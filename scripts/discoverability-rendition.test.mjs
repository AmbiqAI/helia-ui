// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The Markdown rendition, transform by transform.
 *
 * The rendition is the artifact an agent reads, and it is built from the
 * authored source rather than from the rendered page, so every claim about it
 * is a claim about what a source shape reduces to. The fixtures here are the
 * shapes that were getting it wrong: a multi-line `export const` whose body
 * reached a reader as prose, and a card whose content is in its props and so
 * reached a reader as nothing at all.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  codeFence,
  escapeRendition,
  inlineLink,
  linkItem,
  renditionText,
  unescapeRendition,
} from '../rendition.ts';
import {
  collectSidecars,
  foreignBindings,
  reduceTags,
  renderMarkdown,
  serializeJsonLd,
  stripComments,
  stripEsm,
  stripExpressions,
} from '../starlight/discoverability.ts';

const render = (body, options = {}) =>
  renderMarkdown(body, {
    pageUrl: 'https://example.com/docs/page/',
    origin: 'https://example.com/docs/',
    title: 'Page',
    mdx: true,
    ...options,
  });

test('a multi-line export const goes with its body', () => {
  const stripped = stripEsm(
    [
      'Before.',
      '',
      'export const lines = [',
      "  { kind: 'command', text: 'npm run build' },",
      '  // A comment among them.',
      "  { kind: 'output', text: 'done' },",
      '];',
      '',
      'After.',
    ].join('\n'),
  );

  assert.match(stripped, /Before\./);
  assert.match(stripped, /After\./);
  for (const leak of ['export const', 'kind:', '];', 'A comment']) {
    assert.ok(!stripped.includes(leak), `rendition should not carry ${leak}`);
  }
});

test('a multi-line export default and export function go whole', () => {
  const stripped = stripEsm(
    [
      'export default {',
      '  title: "Page",',
      '};',
      '',
      'export function averageLatency(values) {',
      '  return values.reduce((sum, value) => sum + value, 0);',
      '}',
      '',
      'Prose.',
    ].join('\n'),
  );

  assert.equal(stripped.trim(), 'Prose.');
});

test('a bracketed statement whose body holds a brace in a string still ends', () => {
  const stripped = stripEsm(
    ['export const closers = {', "  brace: '}',", '};', 'Prose.'].join('\n'),
  );

  assert.equal(stripped.trim(), 'Prose.');
});

test('a multi-line import goes with its specifiers', () => {
  const stripped = stripEsm(
    [
      "import Card from '@ambiqai/helia-ui/astro/Card';",
      'import {',
      '  CardGrid,',
      '  LinkCard,',
      "} from '@ambiqai/helia-ui/astro';",
      'Prose.',
    ].join('\n'),
  );

  assert.equal(stripped.trim(), 'Prose.');
});

/*
 * An import ends at its specifier, not at a bracket, so the clause may sit on
 * a line of its own and the statement is judged on the whole of itself.
 */
test('a multi-line import goes whole, with the clause wherever it sits', () => {
  const split = [
    'import {',
    '  CardGrid,',
    '  LinkCard,',
    '}',
    "from '@ambiqai/helia-ui/astro';",
    'Prose.',
  ].join('\n');

  assert.equal(stripEsm(split).trim(), 'Prose.');
});

/* A brace is not a binding. Prose that opens with the word and happens to
   close a brace later is a sentence either side of it. */
test('prose that opens a brace after the word import is kept whole', () => {
  const unquoted = [
    'import { the values',
    '} and the sentence carries on.',
    '',
    'The paragraph after it.',
  ].join('\n');
  const quoted = [
    'import { the values',
    "} and then the site's own prose follows.",
    '',
    'The paragraph after it.',
  ].join('\n');

  assert.equal(stripEsm(unquoted), unquoted);
  assert.equal(stripEsm(quoted), quoted);
});

/* A sentence is not a statement. A line that opens with one of the words
   keeps itself, and so do the lines after it. */
test('prose that opens with the word import is kept', () => {
  const line = 'import that module: it is an implementation detail.';

  assert.equal(stripEsm(line), line);
  assert.equal(
    stripEsm("import the values from 'the table' above."),
    "import the values from 'the table' above.",
  );
});

test('prose shaped like an export keeps itself and the lines after it', () => {
  const runs = [
    [
      "export default (the site's own) value is used.",
      '',
      'The sentence after it.',
    ],
    [
      '- export const values ... (see the list below for the',
      '  ones a product site overrides).',
      '',
      'The sentence after it.',
    ],
    [
      'export type aliases are re-exported (see the table',
      'below).',
      '',
      'The sentence after it.',
    ],
  ];

  for (const run of runs) {
    assert.equal(stripEsm(run.join('\n')), run.join('\n'));
  }
});

/*
 * A statement closes its own brackets. A run that ends with one still open
 * never held a statement, so its lines go back and a stray backtick or
 * bracket takes nothing after it.
 */
test('a statement that never closes gives its lines back', () => {
  const unbalanced = [
    'export const values = [',
    "  'unclosed',",
    '',
    'The sentence after it.',
  ].join('\n');
  const template = [
    'export const label = `a ` b ` c;',
    '',
    '## The section after it',
    '',
    'The sentence after it.',
  ].join('\n');

  assert.equal(stripEsm(unbalanced), unbalanced);
  assert.equal(stripEsm(template), template);
});

test("a code sample in a prop is not read as this file's ESM", () => {
  const stripped = stripEsm(
    [
      '<CodeBlock',
      '  code={`export function averageLatency(values) {',
      '  return 0;',
      '}`}',
      '/>',
      '',
      '## Next section',
    ].join('\n'),
  );

  assert.match(stripped, /## Next section/);
});

test('an MDX comment renders as nothing, on one line or several', () => {
  assert.equal(stripComments('{/* Generated. */}\n\nProse.').trim(), 'Prose.');
  assert.equal(
    stripComments('{/* One.\n   Two. */}\n\nProse.').trim(),
    'Prose.',
  );
  assert.equal(stripComments('`{/* kept */}`'), '`{/* kept */}`');
});

test('a fenced comment is quoted syntax and survives the rendition', () => {
  const rendition = render('```mdx\n{/* Starlight */}\n```\n');

  assert.match(rendition, /\{\/\* Starlight \*\/\}/);
});

test('an expression is dropped, and a plain markdown brace is not', () => {
  assert.equal(stripExpressions('Latency is {latency} ms.'), 'Latency is  ms.');
  assert.equal(stripExpressions('Nested {a({ b: 1 })} gone.'), 'Nested  gone.');
  assert.equal(stripExpressions('`{kept}`'), '`{kept}`');
  assert.match(render('Use {slug} here.\n', { mdx: false }), /\{slug\}/);
  assert.ok(!render('Use {slug} here.\n').includes('{slug}'));
});

/* A brace in a string is a character. The expression ends where the JavaScript
   says it does, not at the first `}` that happens to be quoted. */
test('a brace inside a string neither closes an expression nor opens one', () => {
  assert.equal(
    stripExpressions("Total: {items.join('} ')} done."),
    'Total:  done.',
  );
  assert.equal(stripExpressions("a {'x { y'} b"), 'a  b');
});

/* A caller that does not say which it has gets the answer that changes
   nothing: MDX syntax is only syntax on a page that is MDX. */
test('renderMarkdown treats a page as plain markdown unless told otherwise', () => {
  const rendition = renderMarkdown('{/* kept */} Use {slug} here.\n', {
    pageUrl: 'https://example.com/docs/page/',
    origin: 'https://example.com/docs/',
    title: 'Page',
  });

  assert.match(rendition, /\{\/\* kept \*\/\}/);
  assert.match(rendition, /\{slug\}/);
});

test('a card grid reduces to its links, in source order', () => {
  const reduced = reduceTags(
    [
      '<CardGrid>',
      '  <LinkCard href="/install/" title="Install">',
      '    What the package needs first.',
      '  </LinkCard>',
      '  <LinkCard href="/tokens/" title="Tokens" />',
      '</CardGrid>',
    ].join('\n'),
  );

  assert.equal(
    reduced.trim(),
    [
      '- [Install](/install/): What the package needs first.',
      '- [Tokens](/tokens/)',
    ].join('\n'),
  );
});

test('a block diagram is its labels as a nested list', () => {
  const reduced = reduceTags(
    [
      '<BlockDiagram title="Pipeline" caption="What a run does" flow="row">',
      '  <Block label="Build" sublabel="firmware">',
      '    <Block label="Compile" href="/compile/" />',
      '    <Block label="Link" />',
      '  </Block>',
      '  <Block label="Capture" />',
      '</BlockDiagram>',
    ].join('\n'),
  );

  assert.equal(
    reduced.trim(),
    [
      'Pipeline: What a run does',
      '',
      '- Build: firmware',
      '  - [Compile](/compile/)',
      '  - Link',
      '- Capture',
    ].join('\n'),
  );
});

test('a link-bearing component is a link wherever it was written', () => {
  const reduced = reduceTags(
    '<Button href="/start/" title="Get started">Go</Button>',
  );

  assert.equal(reduced.trim(), '- [Get started](/start/): Go');
});

/* The value of a prop is the page's to compute; the rendition has the source
   and nothing else, so a computed title is a loss rather than a guess. */
test('a title that is an expression falls back to the children', () => {
  const reduced = reduceTags(
    '<LinkCard href="/install/" title={page.title}>Body.</LinkCard>',
  );

  assert.equal(reduced.trim(), 'Body.');
  assert.ok(!reduced.includes('page.title'));
});

test('a title written as a braced string is still a string', () => {
  const reduced = reduceTags('<LinkCard href="/a/" title={"A"}>B.</LinkCard>');

  assert.equal(reduced.trim(), '- [A](/a/): B.');
});

test('a titled card is a heading over its body, nesting included', () => {
  const reduced = reduceTags(
    [
      '<CardGrid>',
      '  <Card title="Boards">',
      '    <CardContent>Two are supported.</CardContent>',
      '  </Card>',
      '</CardGrid>',
    ].join('\n'),
  );

  assert.equal(reduced.trim(), '### Boards\n\nTwo are supported.');
});

/* A title is prose and a rendition is markdown: a bracket in one would close
   the link text and let the rest of the title pose as the target. */
test('a card title cannot forge a link', () => {
  const reduced = reduceTags(
    '<LinkCard href="/real/" title="Safe page](https://evil.test/pwn) [" />',
  );

  /* Every bracket the title carried is escaped, so the one link text that
     closes is the one this pass wrote, over the target the card named. */
  const unescaped = reduced.replace(/\\./g, '').trim();
  assert.equal(unescaped.match(/]\(/g).length, 1);
  assert.match(unescaped, /]\(\/real\/\)$/);
  assert.equal(
    reduced.trim(),
    '- [Safe page\\](https://evil.test/pwn) \\[](/real/)',
  );
});

test('a bracket in a title is escaped and a parenthesis in a target is enclosed', () => {
  assert.equal(
    reduceTags(
      '<LinkCard href="/slices/" title="Arrays [and] slices" />',
    ).trim(),
    '- [Arrays \\[and\\] slices](/slices/)',
  );
  assert.equal(
    reduceTags('<LinkCard href="/a(b)c" title="Parens" />').trim(),
    '- [Parens](</a(b)c>)',
  );
});

test('an enclosed target still reaches the deployed site', () => {
  const rendition = render('<LinkCard href="/a(b)c" title="Parens" />\n');

  assert.match(rendition, /\(<https:\/\/example\.com\/a\(b\)c>\)/);
});

/* An attribute list wraps, and a value can wrap with it. A list item is one
   line, so the break and the indentation behind it have to go. */
test('a title written across two lines is one line of markdown', () => {
  const reduced = reduceTags(
    [
      '<CardGrid>',
      '  <LinkCard',
      '    href="/cards/"',
      '    title="The card',
      '      parts"',
      '  >',
      '    What each part owns.',
      '  </LinkCard>',
      '</CardGrid>',
    ].join('\n'),
  );

  assert.equal(
    reduced.trim(),
    '- [The card parts](/cards/): What each part owns.',
  );
});

/* An anchor is already the link it makes, and `title` on one is a tooltip. */
test('an HTML anchor is left as the prose it sits in', () => {
  const sentence =
    'See the <a href="/docs/config/" title="Configuration reference">configuration reference</a> for details.';

  assert.equal(
    reduceTags(sentence).trim(),
    'See the configuration reference for details.',
  );
});

test('an unknown component keeps its children and loses its tags', () => {
  const reduced = reduceTags('<Reveal label="More">\n  The body.\n</Reveal>');

  assert.equal(reduced.trim(), 'The body.');
  assert.ok(!reduced.includes('Reveal'));
});

test('an inline literal transcript is a fenced block, prompts included', () => {
  const reduced = reduceTags(
    [
      '<AsciiTerminal',
      '  lines={[',
      "    { kind: 'command', text: 'npm run build' },",
      "    { kind: 'output', text: '  ENTRY  src/index.ts' },",
      "    { kind: 'success', text: 'done' },",
      '  ]}',
      '/>',
    ].join('\n'),
  );

  assert.equal(
    reduced.trim(),
    ['```text', '$ npm run build', '  ENTRY  src/index.ts', 'done', '```'].join(
      '\n',
    ),
  );
});

/* A fence has to clear the longest run of backticks it encloses, or the
   transcript ends the block early. */
test('a transcript holding a fence is enclosed by a longer one', () => {
  const reduced = reduceTags(
    [
      '<AsciiTerminal',
      '  lines={[',
      "    { text: '``` fenced' },",
      '  ]}',
      '/>',
    ].join('\n'),
  );

  assert.equal(reduced.trim(), '````text\n``` fenced\n````');
});

/* An imported transcript is not in this file, so there is nothing to read. */
test('a transcript from a module reduces to nothing', () => {
  assert.equal(reduceTags('<AsciiTerminal lines={transcript} />').trim(), '');
});

test('a rendition resolves the link a card carried', () => {
  const rendition = render(
    [
      "import LinkCard from '@ambiqai/helia-ui/astro/LinkCard';",
      '',
      '<LinkCard href="/install/" title="Install">Start here.</LinkCard>',
    ].join('\n'),
  );

  assert.match(
    rendition,
    /- \[Install]\(https:\/\/example\.com\/install\/\): Start here\./,
  );
});

/* A page description is another repository's prose on a generated page, so
   nothing it says may end the script element it is written into. */
test('JSON-LD escapes what would end the script block', () => {
  const serialized = serializeJsonLd({
    description: 'Summary </script><img src=x> & more',
  });

  for (const raw of ['<', '>', '&']) {
    assert.ok(!serialized.includes(raw), `serialized JSON-LD carries ${raw}`);
  }
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.deepEqual(JSON.parse(serialized), {
    description: 'Summary </script><img src=x> & more',
  });
});

/* ------------------------------------------------------------------ *
 * Rendition sidecars
 * ------------------------------------------------------------------ */

/*
 * The parts state their own markdown at build time and the pass splices it in
 * where the source pass put the component. What each part states is built from
 * the helpers below, so the fixtures here are the text a part writes and the
 * splice that reads it back. That a part writes it at all is a claim about a
 * rendered page, and is asserted against the built gallery in
 * docs/scripts/assert-docs-build.mjs.
 */

const sidecarBlock = (kind, markdown) =>
  `<script type="text/markdown" data-helia-rendition="${kind}" data-pagefind-ignore>${escapeRendition(markdown)}</script>`;

const builtPage = (...blocks) =>
  [
    '<html><body><header><a class="site">Home</a></header><main>',
    '<div class="sl-markdown-content">',
    ...blocks,
    '</div></main><footer>',
    sidecarBlock('button', '[Chrome](/chrome/)'),
    '</footer></body></html>',
  ].join('');

test('a stated transcript is a fenced block, verbatim', () => {
  const transcript = ['$ npm run build', '  ENTRY  src/index.ts', 'done'].join(
    '\n',
  );

  assert.equal(
    codeFence(transcript),
    ['```text', '$ npm run build', '  ENTRY  src/index.ts', 'done', '```'].join(
      '\n',
    ),
  );
});

test('a card is a list item and a button is an inline link', () => {
  assert.equal(
    linkItem('Apollo510', '/modules/apollo510/', 'The evaluation board.'),
    '- [Apollo510](/modules/apollo510/): The evaluation board.',
  );
  assert.equal(linkItem('Install', '/install/'), '- [Install](/install/)');
  assert.equal(inlineLink('Get started', '/start/'), '[Get started](/start/)');
});

/* A title and a target are the page's own prose, and a rendition is markdown:
   see AmbiqAI/helia-ui#146. */
test('a stated card escapes its title and its target', () => {
  assert.equal(
    linkItem('Arrays [and] brackets', '/docs/a (b)/'),
    '- [Arrays \\[and\\] brackets](</docs/a (b)/>)',
  );
});

test('what a part hides from a reader stays out of what it states', () => {
  const title =
    '<span class="title">The card parts<span class="helia-motion-cue" aria-hidden="true">→</span></span>';

  assert.equal(renditionText(title), 'The card parts');
  assert.equal(
    renditionText('<p>Tokens &amp; scales,\n  the whole set.</p>'),
    'Tokens & scales, the whole set.',
  );
  assert.equal(
    renditionText('<svg viewBox="0 0 1 1"><title>Icon</title></svg>Start'),
    'Start',
  );
});

/* A script element ends at `</script`, and a transcript is free to hold one. */
test('a stated transcript survives markup that would end the block', () => {
  const markdown = codeFence('$ cat page.html\n</script><!-- done -->');

  assert.ok(!escapeRendition(markdown).includes('</script'));
  assert.equal(unescapeRendition(escapeRendition(markdown)), markdown);
  assert.deepEqual(
    collectSidecars(builtPage(sidecarBlock('terminal', markdown))),
    [{ kind: 'terminal', markdown }],
  );
});

/* The site chrome renders the same parts as the content does, and only the
   content was ever in the source the rendition is reduced from. */
test('only the rendered content region is read back', () => {
  const html = builtPage(
    sidecarBlock('link-card', '- [Cards](/cards/)'),
    sidecarBlock('terminal', '```text\n$ npm ci\n```'),
  );

  assert.deepEqual(
    collectSidecars(html).map((sidecar) => sidecar.kind),
    ['link-card', 'terminal'],
  );
});

test('two transcripts from a module reach the rendition in order', () => {
  const body = [
    "import { transcripts } from '../../data/transcripts';",
    '',
    '## Install',
    '',
    '<AsciiTerminal title="Install" lines={transcripts.install} />',
    '',
    '## Build',
    '',
    '<AsciiTerminal title="Build" lines={transcripts.build} />',
  ].join('\n');

  const rendition = render(body, {
    sidecars: collectSidecars(
      builtPage(
        sidecarBlock('terminal', '```text\n$ pip install nsx\n```'),
        sidecarBlock('terminal', '```text\n$ nsx build\n```'),
      ),
    ),
  });

  assert.match(
    rendition,
    /## Install\n\n```text\n\$ pip install nsx\n```\n\n## Build\n\n```text\n\$ nsx build\n```/,
  );
});

test('a card built from a record carries its link and its line', () => {
  const body = [
    '<CardGrid>',
    '  <LinkCard href={module.href} title={module.name}>',
    '    {module.summary}',
    '  </LinkCard>',
    '</CardGrid>',
  ].join('\n');

  const rendition = render(body, {
    sidecars: collectSidecars(
      builtPage(
        sidecarBlock(
          'link-card',
          '- [nsx-board-apollo510-evb](/modules/apollo510-evb/): The evaluation board.',
        ),
      ),
    ),
  });

  assert.match(
    rendition,
    /- \[nsx-board-apollo510-evb]\(https:\/\/example\.com\/modules\/apollo510-evb\/\): The evaluation board\./,
  );
});

test('a card whose header carries the link states the whole row', () => {
  const body = [
    '<CardGrid>',
    '  <Card>',
    '    <CardHeader href="/guides/install/">{guide.title}</CardHeader>',
    '    <CardContent>Everything a first build needs.</CardContent>',
    '  </Card>',
    '  <Card>',
    '    <CardHeader href="/guides/deploy/">{guide.title}</CardHeader>',
    '    <CardContent>Shipping it somewhere.</CardContent>',
    '  </Card>',
    '</CardGrid>',
  ].join('\n');

  const rendition = render(body, {
    sidecars: collectSidecars(
      builtPage(
        sidecarBlock('card', '- [Install](/guides/install/)'),
        sidecarBlock('card', '- [Deploy](/guides/deploy/)'),
      ),
    ),
  });

  assert.match(rendition, /- \[Install]\(\S+\/guides\/install\/\)/);
  assert.match(rendition, /Everything a first build needs\./);
  assert.match(rendition, /- \[Deploy]\(\S+\/guides\/deploy\/\)/);
});

test('a button whose label is a child keeps its link', () => {
  const rendition = render('<Button href={cta.href}>{cta.label}</Button>', {
    sidecars: collectSidecars(
      builtPage(sidecarBlock('button', '[Read the guide](/guides/)')),
    ),
  });

  assert.match(
    rendition,
    /\[Read the guide]\(https:\/\/example\.com\/guides\/\)/,
  );
});

/*
 * A grid built by mapping over a model is one tag in the source and a card per
 * record on the page. Nothing orders the second against the first, so the kind
 * is left alone rather than spliced onto the wrong component.
 */
test('a kind the page and the source disagree about is not spliced', () => {
  const body = [
    '<CardGrid>',
    '  {modules.map((module) => (',
    '    <LinkCard href={module.href} title={module.name} />',
    '  ))}',
    '</CardGrid>',
    '',
    '<LinkCard href="/install/" title="Install">Start here.</LinkCard>',
  ].join('\n');

  const rendition = render(body, {
    sidecars: collectSidecars(
      builtPage(
        sidecarBlock('link-card', '- [First](/first/)'),
        sidecarBlock('link-card', '- [Second](/second/)'),
        sidecarBlock('link-card', '- [Install](/install/): Start here.'),
      ),
    ),
  });

  assert.match(
    rendition,
    /- \[Install]\(https:\/\/example\.com\/install\/\): Start here\./,
  );
  for (const wrong of ['First', 'Second']) {
    assert.ok(
      !rendition.includes(wrong),
      `the rendition should not carry ${wrong}`,
    );
  }
});

/* Starlight's own cards take the line as a prop, and no part of this package
   renders them, so the source pass is the only thing that can read it. See
   AmbiqAI/helia-ui#156. */
test("a card's description prop is read like its children", () => {
  const reduced = reduceTags(
    '<LinkCard href="/modules/" title="Modules" description="Seventeen of them." />',
  );

  assert.equal(reduced.trim(), '- [Modules](/modules/): Seventeen of them.');
});

/*
 * An end tag is matched without regard to case and tolerates whitespace before
 * its `>`, so holding only the lowercase form would let a transcript line end
 * the block and put the rest of the sidecar on the page as markup.
 */
test('a stated block holds an end tag in whatever form it was written', () => {
  const markdown = codeFence(
    [
      '$ cat page.html',
      '</SCRIPT >',
      '</script\t>',
      '<!-- a comment -->',
      '<\\/script>',
    ].join('\n'),
  );
  const escaped = escapeRendition(markdown);

  assert.ok(!/<\/script/i.test(escaped), 'an end tag survived the escape');
  assert.ok(!escaped.includes('<!--'), 'a comment opener survived the escape');
  assert.equal(unescapeRendition(escaped), markdown);
  assert.deepEqual(
    collectSidecars(builtPage(sidecarBlock('terminal', markdown))),
    [{ kind: 'terminal', markdown }],
  );
});

/* The children are dropped a pass later when they are an expression, so a link
   made of them would reach a reader with nothing in its text. */
test('a label that is still an expression is not read as a title', () => {
  assert.equal(
    reduceTags('<Button href="/start/">{cta.label}</Button>').trim(),
    '{cta.label}',
  );

  const rendition = render('<Button href="/start/">{cta.label}</Button>');
  assert.ok(!rendition.includes(']('), 'an empty link reached the rendition');
});

/*
 * A page is chrome, content and footer, and only the middle one was ever in
 * the source a rendition is reduced from. The class name is in the stylesheet
 * the page inlines in its head as well, which comes first and is not an
 * element at all.
 */
const chromePage = (chrome, content, footer) =>
  [
    '<html><head><style>.sl-markdown-content :is(h1,h2){margin:0}</style>',
    '</head><body><header><nav>',
    chrome,
    '</nav></header><main><div class="sl-container">',
    '<div class="sl-markdown-content">',
    content,
    '</div></div><footer class="pagination">',
    footer,
    '</footer></main></body></html>',
  ].join('');

test('the site chrome and the page footer are not the page', () => {
  const html = chromePage(
    sidecarBlock('button', '[Search](/search/)'),
    [
      sidecarBlock('link-card', '- [Cards](/cards/)'),
      '<div class="helia-card-grid">',
      sidecarBlock('card', '- [Tokens](/tokens/)'),
      '</div>',
    ].join(''),
    sidecarBlock('button', '[Next](/next/)'),
  );

  assert.deepEqual(collectSidecars(html), [
    { kind: 'link-card', markdown: '- [Cards](/cards/)' },
    { kind: 'card', markdown: '- [Tokens](/tokens/)' },
  ]);
});

/* What a page escaped, a part decodes when it reads its own children back. A
   rendition that handed that on unheld would be markup a page never rendered,
   in an artifact an agent reads. */
test('markup a page escaped stays inert in what a part states', () => {
  const description = renditionText(
    '<p>&lt;img src=x onerror=alert(1)&gt; &amp; more</p>',
  );
  const stated = linkItem('Summary', '/summary/', description);

  assert.equal(description, '<img src=x onerror=alert(1)> & more');
  assert.equal(
    stated,
    '- [Summary](/summary/): \\<img src=x onerror=alert(1)> \\& more',
  );

  const rendition = render(
    '<LinkCard href={entry.href} title={entry.title} />',
    {
      sidecars: collectSidecars(builtPage(sidecarBlock('link-card', stated))),
    },
  );

  assert.ok(
    !/(?<!\\)<img/.test(rendition),
    'live markup reached the rendition',
  );
  assert.match(rendition, /\\<img src=x onerror=alert\(1\)>/);
});

/* A title is read back the same way, so it is held the same way. */
test('markup in a title is held where the link text goes', () => {
  assert.equal(
    inlineLink(
      renditionText('<span>&lt;script&gt;alert(1)&lt;/script&gt;</span>'),
      '/x/',
    ),
    '[\\<script>alert(1)\\</script>](/x/)',
  );
});

/* NUL is what the reduction masks an inline code span with, so one arriving
   from a prop would read as a span that was never there. */
test('a control character in a stated line does not reach the artifact', () => {
  const [sidecar] = collectSidecars(
    builtPage(sidecarBlock('card', '- [Ti\u0000tle](/x/)\u0007')),
  );

  assert.equal(sidecar.markdown, '- [Title](/x/)');
});

/* `rendition={false}` is a part telling the page that something around it
   states the whole card. Counting it would leave the page a sidecar short. */
test('a header told not to state itself is not counted', () => {
  const body = [
    '<Card>',
    '  <CardHeader href="/a/" rendition={false}>Wrapped</CardHeader>',
    '</Card>',
    '<Card>',
    '  <CardHeader href="/b/">{entry.title}</CardHeader>',
    '</Card>',
  ].join('\n');

  const rendition = render(body, {
    sidecars: collectSidecars(
      builtPage(sidecarBlock('card', '- [The second card](/b/)')),
    ),
  });

  assert.match(
    rendition,
    /- \[The second card]\(https:\/\/example\.com\/b\/\)/,
  );
});

/* Starlight names its own card `LinkCard`, and the imports are stripped before
   the tags are read. See AmbiqAI/helia-ui#167. */
test('a tag bound to another package is not one of these parts', () => {
  const imports = [
    "import { LinkCard } from '@astrojs/starlight/components';",
    "import AsciiTerminal from '@ambiqai/helia-ui/astro/AsciiTerminal';",
  ].join('\n');

  assert.deepEqual([...foreignBindings(imports)], ['LinkCard']);

  const body = [
    imports,
    '',
    '<LinkCard href="/install/" title="Install" description="Start here." />',
    '',
    '<AsciiTerminal lines={transcripts.install} />',
  ].join('\n');

  const rendition = render(body, {
    sidecars: collectSidecars(
      builtPage(sidecarBlock('terminal', '```text\n$ pip install nsx\n```')),
    ),
  });

  assert.match(
    rendition,
    /- \[Install]\(https:\/\/example\.com\/install\/\): Start here\./,
  );
  assert.match(rendition, /```text\n\$ pip install nsx\n```/);
});

/* A kind that turns itself off is a fact about the page, not a silence. */
test('a kind the counts disagree about is reported', () => {
  const skips = [];
  render('<LinkCard href="/install/" title="Install" />', {
    sidecars: collectSidecars(
      builtPage(
        sidecarBlock('link-card', '- [First](/first/)'),
        sidecarBlock('link-card', '- [Second](/second/)'),
      ),
    ),
    onSidecarSkipped: (skip) => skips.push(skip),
  });

  assert.deepEqual(skips, [{ kind: 'link-card', source: 1, page: 2 }]);
});

test('a link-bearing part takes its title from its children', () => {
  assert.equal(
    reduceTags('<Button href="/start/">Get started</Button>').trim(),
    '[Get started](/start/)',
  );
  assert.equal(
    reduceTags('<CardHeader href="/cards/">The card parts</CardHeader>').trim(),
    '- [The card parts](/cards/)',
  );
});
