// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Renders Starlight's markdown asides as the package callout.
 *
 * Starlight turns `:::note` into `<aside class="starlight-aside ...">` while
 * it is still working on the document tree, so by the time the HTML tree
 * exists there is an element to rewrite rather than a directive to re-parse.
 * That is the whole reason this runs where it does: one transform covers `.md`
 * and `.mdx`, and a site needs no import in either.
 *
 * Astro 7 has two markdown processors and Starlight supports both, so this
 * does too. Satteri is the default, and it does not run `rehypePlugins`; a
 * plugin registered the way Astro's deprecated `markdown.rehypePlugins` option
 * registers one would silently do nothing on a stock site. The transform is
 * therefore pushed onto whichever plugin list the configured processor
 * actually reads, which is what `@astrojs/starlight` does with its own.
 *
 * Only the four directive names Starlight defines arrive here. The remaining
 * callout tones have no markdown spelling and stay with the component.
 */

import type { AstroIntegration } from 'astro';

import {
  calloutClasses,
  calloutIcon,
  type CalloutTone,
} from '../callout-tones.ts';

/**
 * The tree nodes this touches, structurally.
 *
 * The hast types are not a dependency of this package and the two processors
 * materialize MDX slightly differently, so the shapes are described here by
 * what the transform reads rather than imported.
 */
interface HastElement {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}

interface JsxAttribute {
  type?: string;
  name?: string;
  value?: unknown;
}

interface HastNode {
  type: string;
  children?: HastNode[];
  properties?: Record<string, unknown>;
  attributes?: JsxAttribute[];
  value?: string;
  [key: string]: unknown;
}

/** Starlight's four aside names, in the package's own tone vocabulary. */
const ASIDE_TONES = {
  note: 'note',
  tip: 'tip',
  caution: 'warning',
  danger: 'critical',
} as const satisfies Record<string, CalloutTone>;

const isElement = (node: HastNode): node is HastNode & HastElement =>
  node.type === 'element';

/**
 * The classes on a node, whichever way it spells them.
 *
 * An element carries `className` or `class` in its properties, depending on
 * which processor built it; a JSX element in MDX carries either as an
 * attribute instead, which is how a site's own `<div class="not-content">`
 * arrives.
 */
function classesOf(node: HastNode): string[] {
  const raw: unknown[] = [];
  const properties = node.properties;
  if (properties) raw.push(properties['className'], properties['class']);
  if (Array.isArray(node.attributes)) {
    for (const attribute of node.attributes) {
      if (attribute?.name === 'className' || attribute?.name === 'class') {
        raw.push(attribute.value);
      }
    }
  }

  const classes: string[] = [];
  for (const value of raw) {
    if (Array.isArray(value)) classes.push(...value.map(String));
    else if (typeof value === 'string')
      classes.push(...value.split(/\s+/).filter(Boolean));
  }
  return classes;
}

const isNotContent = (node: HastNode) =>
  classesOf(node).includes('not-content');

function toneOf(node: HastNode): CalloutTone | undefined {
  if (!isElement(node) || node.tagName !== 'aside') return undefined;
  const classes = classesOf(node);
  if (!classes.includes('starlight-aside')) return undefined;
  for (const [name, tone] of Object.entries(ASIDE_TONES)) {
    if (classes.includes(`starlight-aside--${name}`)) return tone;
  }
  return undefined;
}

const childByClass = (node: HastElement, className: string) =>
  node.children.find((child) => classesOf(child).includes(className));

/**
 * Starlight's own aside icon, in any of the three shapes it is built in: an
 * SVG element under the unified processor, a raw HTML node under Satteri in
 * `.md`, and a `set:html` fragment under Satteri in `.mdx`.
 */
function isAsideIcon(node: HastNode): boolean {
  if (classesOf(node).includes('starlight-aside__icon')) return true;
  if (typeof node.value === 'string')
    return node.value.includes('starlight-aside__icon');
  if (Array.isArray(node.attributes)) {
    return node.attributes.some(
      (attribute) =>
        typeof attribute?.value === 'string' &&
        attribute.value.includes('starlight-aside__icon'),
    );
  }
  return false;
}

const element = (
  tagName: string,
  properties: Record<string, unknown>,
  children: HastNode[],
): HastNode => ({ type: 'element', tagName, properties, children });

function iconElement(tone: CalloutTone): HastNode {
  const { attributes, paths } = calloutIcon(tone);
  return element(
    'span',
    { className: ['helia-callout__icon'], 'aria-hidden': 'true' },
    [
      element(
        'svg',
        { ...attributes },
        paths.map((d) => element('path', { d }, [])),
      ),
    ],
  );
}

/** The concatenated text of a subtree, for an aside that carries no label. */
function textOf(nodes: readonly HastNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' && typeof node.value === 'string'
        ? node.value
        : textOf(node.children ?? []),
    )
    .join('');
}

/**
 * The callout equivalent of one Starlight aside.
 *
 * The title comes from the aside rather than from a table of defaults here:
 * Starlight has already resolved a `:::tip[label]` to its label and an
 * unlabeled directive to the translated default, so reading it back keeps both
 * cases and the site's language right. Its icon is dropped, because the tone
 * picks the package one, and its `aria-label` is carried across, because that
 * is the accessible name the reader would otherwise lose.
 *
 * The surface classes are restated rather than composed from `Surface.astro`,
 * which cannot be rendered from a tree transform; they are that component's
 * defaults for `tone="card"` and `padding="4"`.
 */
function calloutElement(aside: HastElement, tone: CalloutTone): HastNode {
  const title = childByClass(aside, 'starlight-aside__title');
  const content = childByClass(aside, 'starlight-aside__content');
  const titleChildren = (title?.children ?? []).filter(
    (child) => !isAsideIcon(child),
  );
  const label =
    aside.properties?.['aria-label'] ??
    aside.properties?.['ariaLabel'] ??
    textOf(titleChildren).trim();

  return element(
    'aside',
    {
      className: [
        'helia-surface',
        'helia-surface--pad-4',
        ...calloutClasses(tone),
      ],
      'aria-label': label,
    },
    [
      iconElement(tone),
      element('div', { className: ['helia-callout__content'] }, [
        element('strong', {}, titleChildren),
        element(
          'div',
          { className: ['helia-callout__body'] },
          content?.children ?? [],
        ),
      ]),
    ],
  );
}

/**
 * Rewrites every Starlight aside in the tree, in place.
 *
 * Anything with children is descended into, not only elements: in `.mdx` an
 * aside can sit inside a JSX wrapper -- `<Steps>`, `<Tabs>`, a plain `<div>`
 * -- and those are neither elements nor transparent to the walk. A rewritten
 * aside no longer carries `starlight-aside`, so a second pass changes nothing.
 */
export function transformAsides(tree: HastNode): void {
  const children = tree.children;
  if (!Array.isArray(children)) return;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    /* `not-content` is Starlight's mark for markup that is not prose, which
       its own styling steps around; an aside inside one belongs to whoever
       wrote it. */
    if (isNotContent(child)) continue;

    const tone = toneOf(child);
    const next = tone ? calloutElement(child as HastElement, tone) : child;
    if (tone) children[index] = next;
    /* A rewritten aside is descended into as well: the body of one aside can
       hold another. */
    transformAsides(next);
  }
}

/** The transform as a plugin for the unified processor. */
export default function rehypeHeliaCallouts() {
  return transformAsides;
}

/**
 * The transform as a plugin for the Satteri processor.
 *
 * Satteri drives the walk itself and hands back matched nodes, so the ancestor
 * check `transformAsides` gets from its own recursion is done by climbing
 * parents instead.
 */
export function satteriHeliaCallouts() {
  return {
    name: 'helia-ui-markdown-callouts',
    element: {
      filter: ['aside'],
      visit(node: HastNode, ctx: SatteriHastContext) {
        const tone = toneOf(node);
        if (!tone) return undefined;

        let ancestor = ctx.parent(node);
        while (ancestor) {
          if (isNotContent(ancestor)) return undefined;
          /* Only the outermost aside is replaced. A patch aimed at a node an
             earlier replacement removed is dropped, so a nested aside is
             rewritten as part of its ancestor's new subtree instead. */
          if (toneOf(ancestor)) return undefined;
          ancestor = ctx.parent(ancestor);
        }

        const callout = calloutElement(node as HastElement, tone);
        transformAsides(callout);
        return callout;
      },
    },
  };
}

interface SatteriHastContext {
  parent(node: HastNode): HastNode | undefined;
}

/** What a processor exposes of the plugin lists it runs. */
interface ProcessorLike {
  name?: string;
  options?: {
    hastPlugins?: unknown[];
    rehypePlugins?: unknown[];
  };
}

/**
 * Installs the transform on whichever processor the site configured.
 *
 * The lists are pushed onto directly, the way Starlight registers its own
 * transforms. Going through `updateConfig({ markdown: { rehypePlugins } })`
 * instead would reach the unified processor only, and on the default one it
 * would both do nothing and earn the site a deprecation warning it did not
 * write.
 */
export function markdownCalloutsIntegration(): AstroIntegration {
  return {
    name: '@ambiqai/helia-ui/starlight:markdown-callouts',
    hooks: {
      'astro:config:setup': ({ config, logger }) => {
        const processor = config.markdown?.processor as
          ProcessorLike | undefined;
        const options = processor?.options;

        if (Array.isArray(options?.hastPlugins)) {
          options.hastPlugins.push(satteriHeliaCallouts);
        } else if (Array.isArray(options?.rehypePlugins)) {
          options.rehypePlugins.push(rehypeHeliaCallouts);
        } else {
          logger.warn(
            `The configured \`markdown.processor\` (${processor?.name ?? 'unknown'}) exposes neither \`hastPlugins\` nor \`rehypePlugins\`, so markdown asides will keep Starlight's own styling. Use \`satteri()\` from \`@astrojs/markdown-satteri\` or \`unified()\` from \`@astrojs/markdown-remark\`, or set \`markdownCallouts: false\` to silence this.`,
          );
        }
      },
    },
  };
}
