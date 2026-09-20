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

/* A sentence is not a statement, and the rendition used to lose any line that
   opened with the word. */
test('prose that opens with the word import is kept', () => {
  const line = 'import that module: it is an implementation detail.';

  assert.equal(stripEsm(line), line);
});

test('a code sample in a prop is not read as this file ESM', () => {
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
