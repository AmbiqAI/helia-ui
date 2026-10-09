// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * The markdown aside transform, over the tree Starlight actually hands it.
 *
 * The fixture below is the hast `remark-asides` produces: an `<aside>` with a
 * title paragraph that opens with an icon, and a content div. Asserting
 * against that shape rather than against rendered HTML is the point -- the
 * transform's contract is with Starlight's markup, and this fails the day that
 * markup changes rather than the day a page looks wrong.
 *
 * Neither markdown processor is driven for real here. This package declares no
 * processor: Satteri and unified are the consuming site's, and pulling one in
 * as a development dependency to render a fixture string rewrites a thousand
 * lines of the lockfile for a pipeline the gallery build and a packed-consumer
 * build already exercise end to end. So the shapes both processors produce are
 * fixtures, and the registration is driven through the integration hook.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import rehypeHeliaCallouts, {
  markdownCalloutsIntegration,
  satteriHeliaCallouts,
  transformAsides,
} from '../starlight/markdown-callouts.ts';
import { heliaStarlight } from '../starlight/index.ts';
import { renderMarkdown } from '../starlight/discoverability.ts';

const element = (tagName, properties, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});

const text = (value) => ({ type: 'text', value });

const paragraph = (value) => element('p', {}, [text(value)]);

const jsx = (name, attributes, children) => ({
  type: 'mdxJsxFlowElement',
  name,
  attributes,
  children,
});

const jsxAttribute = (name, value) => ({
  type: 'mdxJsxAttribute',
  name,
  value,
});

/**
 * One aside as the Satteri processor materializes it: `class` rather than
 * `className`, and the icon as a raw HTML node in `.md` or a `set:html`
 * fragment in `.mdx` instead of an SVG element.
 */
function satteriAside(variant, title, { mdx = false } = {}) {
  const icon =
    '<svg viewBox="0 0 24 24" class="starlight-aside__icon"><path d="M0 0"/></svg>';
  const iconNode = mdx
    ? {
        type: 'mdxJsxTextElement',
        name: 'Fragment',
        attributes: [jsxAttribute('set:html', icon)],
      }
    : { type: 'raw', value: icon };
  return {
    type: 'element',
    tagName: 'aside',
    properties: {
      'aria-label': title,
      class: `starlight-aside starlight-aside--${variant}`,
    },
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: { class: 'starlight-aside__title' },
        children: [iconNode, text(title)],
      },
      {
        type: 'element',
        tagName: 'div',
        properties: { class: 'starlight-aside__content' },
        children: [paragraph('Body.')],
      },
    ],
  };
}

/** One aside in the shape Starlight's remark plugin leaves behind. */
function aside(variant, title, content = [paragraph('Body.')]) {
  return element(
    'aside',
    {
      'aria-label': title,
      className: ['starlight-aside', `starlight-aside--${variant}`],
    },
    [
      element(
        'p',
        { className: ['starlight-aside__title'], ariaHidden: 'true' },
        [
          element('svg', { className: ['starlight-aside__icon'] }, []),
          text(title),
        ],
      ),
      element('div', { className: ['starlight-aside__content'] }, content),
    ],
  );
}

const root = (...children) => ({ type: 'root', children });

const classesOf = (node) => node.properties.className;

const bodyOf = (node) => node.children[1].children[1];

const titleOf = (node) => node.children[1].children[0];

test('each Starlight aside name becomes its callout tone', () => {
  const tree = root(
    aside('note', 'Note'),
    aside('tip', 'Tip'),
    aside('caution', 'Caution'),
    aside('danger', 'Danger'),
  );

  transformAsides(tree);

  assert.deepEqual(
    tree.children.map((node) => classesOf(node).at(-1)),
    [
      'helia-callout--note',
      'helia-callout--tip',
      'helia-callout--warning',
      'helia-callout--critical',
    ],
  );
  /* No explicit role: the implicit complementary landmark stands, and build-time
     content must not announce itself. The name comes across instead. */
  assert.deepEqual(
    tree.children.map((node) => node.properties.role),
    [undefined, undefined, undefined, undefined],
  );
  assert.deepEqual(
    tree.children.map((node) => node.properties['aria-label']),
    ['Note', 'Tip', 'Caution', 'Danger'],
  );
  for (const node of tree.children) {
    assert.equal(node.tagName, 'aside');
    assert.deepEqual(classesOf(node).slice(0, 3), [
      'helia-surface',
      'helia-surface--pad-4',
      'helia-callout',
    ]);
  }
});

test('the callout carries the package icon and drops the Starlight one', () => {
  const tree = root(aside('danger', 'Danger'));

  transformAsides(tree);

  const icon = tree.children[0].children[0];
  assert.deepEqual(icon.properties.className, ['helia-callout__icon']);
  assert.equal(icon.properties['aria-hidden'], 'true');
  const svg = icon.children[0];
  assert.equal(svg.tagName, 'svg');
  assert.equal(svg.properties.viewBox, '0 0 512 512');
  assert.ok(svg.children.every((child) => child.tagName === 'path'));
  assert.ok(svg.children[0].properties.d.length > 0);
  /* Starlight's own icon traveled inside the title and must not survive. */
  assert.ok(
    !JSON.stringify(titleOf(tree.children[0])).includes('starlight-aside'),
  );
});

test('a directive label becomes the title, and the default one otherwise', () => {
  const tree = root(aside('tip', 'Recommended path'), aside('note', 'Note'));

  transformAsides(tree);

  assert.deepEqual(titleOf(tree.children[0]).children, [
    text('Recommended path'),
  ]);
  assert.equal(titleOf(tree.children[0]).tagName, 'strong');
  assert.deepEqual(titleOf(tree.children[1]).children, [text('Note')]);
});

test('nested markdown inside the aside is carried over untouched', () => {
  const list = element('ul', {}, [
    element('li', {}, [text('One')]),
    element('li', {}, [text('Two')]),
  ]);
  const code = element('pre', {}, [element('code', {}, [text('make all')])]);
  const tree = root(aside('note', 'Note', [paragraph('Steps:'), list, code]));

  transformAsides(tree);

  const body = bodyOf(tree.children[0]);
  assert.deepEqual(body.properties.className, ['helia-callout__body']);
  assert.equal(body.children.length, 3);
  assert.equal(body.children[1], list);
  assert.equal(body.children[2], code);
});

test('an aside inside a not-content region is left alone', () => {
  const inner = aside('note', 'Note');
  const tree = root(element('div', { className: ['not-content'] }, [inner]));

  transformAsides(tree);

  assert.equal(tree.children[0].children[0], inner);
  assert.deepEqual(classesOf(inner), [
    'starlight-aside',
    'starlight-aside--note',
  ]);
});

test('an aside nested in another aside is rewritten too', () => {
  const tree = root(aside('note', 'Note', [aside('danger', 'Danger')]));

  transformAsides(tree);

  const nested = bodyOf(tree.children[0]).children[0];
  assert.deepEqual(classesOf(nested).at(-1), 'helia-callout--critical');
});

test('markup that is not a Starlight aside is untouched', () => {
  const other = element('aside', { className: ['helia-callout'] }, [
    text('Written as the component.'),
  ]);
  const tree = root(other, element('p', {}, [text('Prose.')]));
  const before = JSON.stringify(tree);

  transformAsides(tree);

  assert.equal(JSON.stringify(tree), before);
});

test('a second pass changes nothing', () => {
  const tree = root(aside('caution', 'Caution'));

  transformAsides(tree);
  const once = JSON.stringify(tree);
  transformAsides(tree);

  assert.equal(JSON.stringify(tree), once);
});

/*
 * The markdown renditions and llms.txt are built from the authored source
 * rather than from the rendered page, so the transform cannot reach them. An
 * agent reading `<route>/index.md` must find the directive, not the markup the
 * browser gets. Asserted here as well as on the built site, because this is
 * the function both artifacts are produced by.
 */
test('the markdown rendition keeps the directive and no callout markup', () => {
  const rendition = renderMarkdown(
    ':::note\nProfiling results vary with board revision.\n:::\n',
    {
      pageUrl: 'https://example.com/docs/callouts/',
      origin: 'https://example.com',
      title: 'Callouts',
    },
  );

  assert.match(rendition, /:::note/);
  assert.match(rendition, /Profiling results vary with board revision\./);
  for (const markup of ['helia-callout', 'helia-surface', '<svg', '<aside']) {
    assert.ok(
      !rendition.includes(markup),
      `rendition should not contain ${markup}`,
    );
  }
});

test('an aside inside an MDX JSX wrapper is transformed', () => {
  const tree = root(
    jsx('Steps', [], [element('ol', {}, [aside('tip', 'Tip')])]),
    jsx('CardGrid', [], [aside('danger', 'Danger')]),
  );

  transformAsides(tree);

  const inSteps = tree.children[0].children[0].children[0];
  assert.deepEqual(classesOf(inSteps).at(-1), 'helia-callout--tip');
  assert.deepEqual(
    classesOf(tree.children[1].children[0]).at(-1),
    'helia-callout--critical',
  );
});

test('an aside inside a not-content JSX wrapper is left alone', () => {
  const inner = aside('note', 'Note');
  const tree = root(
    jsx('div', [jsxAttribute('className', 'helia-stack not-content')], [inner]),
  );

  transformAsides(tree);

  assert.equal(tree.children[0].children[0], inner);
  assert.deepEqual(classesOf(inner), [
    'starlight-aside',
    'starlight-aside--note',
  ]);
});

test('the Satteri shape is transformed in .md and .mdx alike', () => {
  for (const mdx of [false, true]) {
    const tree = root(satteriAside('caution', 'Watch out', { mdx }));

    transformAsides(tree);

    const callout = tree.children[0];
    assert.deepEqual(classesOf(callout).at(-1), 'helia-callout--warning');
    assert.equal(callout.properties['aria-label'], 'Watch out');
    /* The raw SVG and the `set:html` fragment are Starlight's icon in the two
       shapes Satteri builds it in; neither may survive into the title. */
    assert.deepEqual(titleOf(callout).children, [text('Watch out')]);
    assert.ok(!JSON.stringify(callout).includes('starlight-aside__icon'));
  }
});

test('an aside with no label takes its name from the title text', () => {
  const tree = root(aside('note', 'Note'));
  delete tree.children[0].properties['aria-label'];

  transformAsides(tree);

  assert.equal(tree.children[0].properties['aria-label'], 'Note');
});

/*
 * Satteri hands a node over frozen, so anything carried out of the aside has
 * to be copied before the transform rewrites a child list. A nested aside is
 * the case that writes: without the copy the first replacement throws.
 */
function deepFreeze(node) {
  if (Array.isArray(node.children)) {
    node.children.forEach(deepFreeze);
    Object.freeze(node.children);
  }
  if (node.properties) Object.freeze(node.properties);
  return Object.freeze(node);
}

const noParents = { parent: () => undefined };

test('a frozen aside holding another is rewritten without writing to it', () => {
  const inner = satteriAside('danger', 'Inner');
  const outer = satteriAside('note', 'Outer');
  outer.children[1].children = [paragraph('Before.'), inner];
  deepFreeze(outer);

  const callout = satteriHeliaCallouts().element.visit(outer, noParents);

  const body = bodyOf(callout);
  assert.deepEqual(classesOf(callout).at(-1), 'helia-callout--note');
  assert.deepEqual(
    classesOf(body.children[1]).at(-1),
    'helia-callout--critical',
  );
  /* The original is still Starlight's, which is what frozen means. */
  assert.ok(Object.isFrozen(outer));
  assert.equal(
    inner.properties.class,
    'starlight-aside starlight-aside--danger',
  );
});

test('a frozen aside under a wrapper inside another is rewritten too', () => {
  const inner = satteriAside('tip', 'Inner');
  const outer = satteriAside('note', 'Outer');
  outer.children[1].children = [
    { type: 'element', tagName: 'div', properties: {}, children: [inner] },
  ];
  deepFreeze(outer);

  const callout = satteriHeliaCallouts().element.visit(outer, noParents);

  const wrapper = bodyOf(callout).children[0];
  assert.deepEqual(classesOf(wrapper.children[0]).at(-1), 'helia-callout--tip');
});

test('a nested aside is left for its ancestor under Satteri', () => {
  const inner = satteriAside('danger', 'Inner');
  const outer = satteriAside('note', 'Outer');
  const ctx = { parent: (node) => (node === inner ? outer : undefined) };

  assert.equal(
    satteriHeliaCallouts().element.visit(inner, ctx),
    undefined,
    'the outer replacement carries it, so a second patch would be dropped',
  );
});

test('an aside under a not-content ancestor is left alone under Satteri', () => {
  const aside = satteriAside('note', 'Note');
  const wrapper = {
    type: 'element',
    tagName: 'div',
    properties: { class: 'not-content' },
    children: [aside],
  };
  const ctx = { parent: (node) => (node === aside ? wrapper : undefined) };

  assert.equal(satteriHeliaCallouts().element.visit(aside, ctx), undefined);
});

/*
 * The registration itself. Which list the transform lands on decides whether
 * it runs at all: Satteri is Astro's default processor and does not read
 * `rehypePlugins`, so a plugin on the wrong list is silently inert and every
 * assertion above would still pass.
 */
const setup = async (processor, options = {}) => {
  const warnings = [];
  const integration = markdownCalloutsIntegration();
  await integration.hooks['astro:config:setup']({
    config: { markdown: { processor } },
    logger: { warn: (message) => warnings.push(message) },
    ...options,
  });
  return warnings;
};

const satteriProcessor = () => ({
  name: 'satteri',
  options: { mdastPlugins: [], hastPlugins: [], features: {} },
});

const unifiedProcessor = () => ({
  name: 'unified',
  options: { remarkPlugins: [], rehypePlugins: [], remarkRehype: {} },
});

test('a Satteri processor gets the transform as a hast plugin', async () => {
  const processor = satteriProcessor();

  const warnings = await setup(processor);

  assert.deepEqual(warnings, []);
  assert.deepEqual(processor.options.hastPlugins, [satteriHeliaCallouts]);
  assert.deepEqual(processor.options.mdastPlugins, []);
});

test('a unified processor gets the transform as a rehype plugin', async () => {
  const processor = unifiedProcessor();

  const warnings = await setup(processor);

  assert.deepEqual(warnings, []);
  assert.deepEqual(processor.options.rehypePlugins, [rehypeHeliaCallouts]);
  assert.deepEqual(processor.options.remarkPlugins, []);
});

test('a processor that reads neither list is named in a warning', async () => {
  const processor = { name: 'homegrown', options: {} };

  const warnings = await setup(processor);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /homegrown/);
  assert.match(warnings[0], /markdownCallouts: false/);
  assert.deepEqual(processor.options, {});
});

test('markdownCallouts: false adds no integration', () => {
  const added = [];
  const collect = (options) => {
    heliaStarlight(options).hooks['config:setup']({
      addIntegration: (integration) => added.push(integration.name),
      addRouteMiddleware: () => {},
      config: { title: 'Site' },
      updateConfig: () => {},
    });
    return added.splice(0);
  };

  const withCallouts = collect({});
  const without = collect({ markdownCallouts: false });

  const name = '@ambiqai/helia-ui/starlight:markdown-callouts';
  assert.ok(withCallouts.includes(name), 'installed by default');
  assert.ok(!without.includes(name));
  /* The rest of the plugin is untouched by the opt-out. */
  assert.deepEqual(
    without,
    withCallouts.filter((added) => added !== name),
  );
});
