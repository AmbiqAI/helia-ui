#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Two claims about the built docs site that nothing else checks.
 *
 * 1. Every route the sidebar offers exists. A Starlight sidebar entry naming a
 *    slug that no page resolves is a build error, but a page that quietly
 *    stops being emitted -- renamed, moved, or dropped from the collection --
 *    is not, and the sidebar would follow it out of the build.
 *
 * 2. React reaches only the React-components section. The site documents three
 *    lanes and the whole point of the Astro lane is that it costs no
 *    JavaScript, so a hydrated component on a page outside `react/` means a
 *    part was documented through an island that did not need to be one.
 *    `<astro-island>` is the marker: Astro emits one per hydrated component
 *    and nothing else on these pages produces it.
 *
 * 3. A Markdown aside reaches the page as a callout and reaches an agent as
 *    the directive that was written. The two artifacts come from different
 *    ends of the build -- the rehype transform rewrites the rendered tree, the
 *    renditions are read off the source -- and only a built site proves both.
 *
 * 4. A rendition carries what a component rendered rather than what it was
 *    written as: a card's link and title, a transcript's lines, and none of
 *    the props or comments those were authored in. The gallery is where every
 *    one of those shapes is on a page, so it is where the claim is provable.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import process from 'node:process';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

/* Mirrors the sidebar in astro.config.mjs. Kept by hand on purpose: the point
 * is to state the expected shape independently of the config that produces
 * it. */
const ASTRO_LANE = [
  '',
  'foundations',
  'foundations/tokens',
  'foundations/site-theme',
  /* The gallery is the busiest Astro-lane page there is; if anything on it
     needed an island the lane's whole premise would be in question. */
  'gallery',
  'starlight-plugin',
  'starlight-plugin/discoverability',
  'starlight-plugin/landing-example',
  'migrating-from-mkdocs',
  'python-api-reference',
  'primitives',
  'cards',
  'media',
  'code',
  'callouts',
  'disclosure',
  'timeline',
  /* Diagrams belongs here rather than anywhere else: build-time mermaid is
     only worth the browser it costs if the page ships no island. */
  'diagrams',
  'block-diagrams',
  'layout',
  'reference/astro-parts',
];

/* Prose about the starters. They document an app lane that does hydrate, but
 * these pages are docs and must not. */
const TEMPLATE_LANE = ['templates/docs-sites', 'templates/web-apps'];

const REACT_LANE = [
  'react/inputs',
  'react/form-depth',
  'react/overlays',
  'react/feedback',
  'react/data-display',
  'react/navigation',
  'react/versioning',
  'react/charts-candidates',
];

const failures = [];

if (!existsSync(dist)) {
  throw new Error('dist/ does not exist. Run npm run build first.');
}

const ISLAND = /<astro-island\b/;

for (const route of [...ASTRO_LANE, ...TEMPLATE_LANE, ...REACT_LANE]) {
  const path = join(dist, route, 'index.html');
  if (!existsSync(path)) {
    failures.push(`/${route} was not emitted (${path} is missing).`);
    continue;
  }

  const html = readFileSync(path, 'utf8');
  const hydrated = ISLAND.test(html);
  const expected = REACT_LANE.includes(route);

  if (hydrated && !expected) {
    failures.push(
      `/${route} hydrates a React component. Only the React-components section may.`,
    );
  }
  if (!hydrated && expected) {
    failures.push(
      `/${route} is in the React-components section but hydrates nothing.`,
    );
  }
}

/* The Callouts page is the one that carries aside directives; see its
   "Markdown form" section. */
const CALLOUT_PAGE = 'callouts';

/*
 * One authored directive per tone, each with body text used nowhere else on
 * the page. Matching on the body rather than counting asides is what makes a
 * drifted mapping fail: the page also renders a component callout of every
 * tone, so a `:::caution` that started resolving to `critical` would leave the
 * tone counts untouched.
 */
const AUTHORED_ASIDES = [
  ['note', 'Directive asides carry the package surface without an import.'],
  ['tip', 'Reach for the component only when the tone has no directive name.'],
  [
    'warning',
    'A directive aside is prose, so a long one reads better as a section.',
  ],
  [
    'critical',
    'A destructive step earns the strongest tone the directive set offers.',
  ],
];

/* Markup an agent reading the Callouts rendition must never be handed. The
   page is one route, so the whole rendered vocabulary can be ruled out. */
const RENDERED_MARKUP = ['helia-callout', 'helia-surface', '<svg', '<aside'];
/* The same claim over llms-full.txt, which is the whole site: `<svg` and the
   recipe class names are legitimate content on the pages that document them,
   so only what the aside transform itself emits is ruled out here. */
const CALLOUT_MARKUP = [
  'helia-callout__body',
  'helia-callout__icon',
  'helia-callout--',
  'helia-surface--pad-4',
  'starlight-aside',
];

const calloutHtmlPath = join(dist, CALLOUT_PAGE, 'index.html');
if (!existsSync(calloutHtmlPath)) {
  failures.push(
    `/${CALLOUT_PAGE} was not emitted; the aside checks cannot run.`,
  );
} else {
  const html = readFileSync(calloutHtmlPath, 'utf8');
  const asides = [
    ...html.matchAll(/<aside class="([^"]*)"[^>]*>([\s\S]*?)<\/aside>/g),
  ];

  for (const [tone, body] of AUTHORED_ASIDES) {
    const match = asides.find(([, , inner]) => inner.includes(body));
    if (!match) {
      failures.push(
        `/${CALLOUT_PAGE} renders no aside carrying "${body}"; the aside transform did not run.`,
      );
      continue;
    }
    const classes = match[1].split(/\s+/);
    if (!classes.includes(`helia-callout--${tone}`)) {
      failures.push(
        `/${CALLOUT_PAGE}: the aside carrying "${body}" is ${match[1]}, not helia-callout--${tone}.`,
      );
    }
    /* A component callout is scoped by Astro; a transformed one cannot be,
       because the transform emits markup rather than rendering a component. */
    if (classes.some((name) => name.startsWith('astro-'))) {
      failures.push(
        `/${CALLOUT_PAGE}: the aside carrying "${body}" came from the component, not the transform.`,
      );
    }
  }

  if (html.includes('starlight-aside')) {
    failures.push(
      `/${CALLOUT_PAGE} still carries Starlight's own aside markup.`,
    );
  }
}

for (const [label, path, forbidden] of [
  [
    'the Callouts rendition',
    join(dist, CALLOUT_PAGE, 'index.md'),
    RENDERED_MARKUP,
  ],
  ['llms-full.txt', join(dist, 'llms-full.txt'), CALLOUT_MARKUP],
]) {
  if (!existsSync(path)) {
    failures.push(`${label} was not emitted (${path} is missing).`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  for (const directive of [':::note', ':::tip[', ':::caution', ':::danger[']) {
    if (!text.includes(directive)) {
      failures.push(`${label} lost the ${directive} it was written with.`);
    }
  }
  for (const markup of forbidden) {
    if (text.includes(markup)) {
      failures.push(`${label} carries rendered markup: ${markup}.`);
    }
  }
}

/*
 * The rendition of a page whose content is in its props. The gallery writes
 * `LinkCard` with a title and an href, and `AsciiTerminal` with an inline
 * transcript; both used to reduce to nothing or to their children, which is
 * how a section index reached an agent with none of its links. Matched on the
 * authored strings rather than on a count, so a card that stops carrying its
 * href fails here rather than passing with a link to the wrong place.
 */
const RENDITION_CLAIMS = [
  [
    'gallery',
    [
      /- \[The card parts]\(\S+\/cards\/\): What each part owns/,
      /- \[Tokens and scales]\(\S+\/foundations\/\): The spacing, radius/,
      /```text\n\$ npm run build\n/,
    ],
    ['<LinkCard', '<AsciiTerminal', "{ kind: 'command'", 'titleAs='],
  ],
  /* Generated pages open with a comment naming the script that wrote them.
     A comment renders nothing, so a rendition must not carry one. */
  ['foundations/tokens', [], ['{/*']],
  ['reference/astro-parts', [], ['{/*']],
];

for (const [route, expected, forbidden] of RENDITION_CLAIMS) {
  const path = join(dist, route, 'index.md');
  if (!existsSync(path)) {
    failures.push(`the /${route} rendition was not emitted (${path}).`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  for (const pattern of expected) {
    if (!pattern.test(text)) {
      failures.push(`the /${route} rendition does not match ${pattern}.`);
    }
  }
  for (const source of forbidden) {
    if (text.includes(source)) {
      failures.push(`the /${route} rendition carries MDX source: ${source}.`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(
    `\n${failures.length} docs build assertion${failures.length === 1 ? '' : 's'} failed.`,
  );
  process.exit(1);
}

console.log(
  `assert: ${ASTRO_LANE.length + TEMPLATE_LANE.length + REACT_LANE.length} routes emitted, React confined to ${REACT_LANE.length}, ${AUTHORED_ASIDES.length} markdown asides rendered as callouts and absent from the text artifacts, ${RENDITION_CLAIMS.length} renditions carrying what their components rendered.`,
);
