// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
/*
 * Renders Starlight's markdown asides as the package callout.
 *
 * Starlight turns `:::note` into `<aside class="starlight-aside ...">` during
 * the remark pass, so by the time rehype runs there is an element tree to
 * rewrite rather than a directive to re-parse. That is the whole reason this
 * is a rehype plugin: one transform covers `.md` and `.mdx`, and a site needs
 * no import in either.
 *
 * Only the four directive names Starlight defines arrive here. The remaining
 * callout tones have no markdown spelling and stay with the component.
 */

import type { AstroIntegration } from 'astro';

import {
  calloutClasses,
  calloutDefinition,
  calloutIcon,
  type CalloutTone,
} from '../callout-tones.ts';

interface HastElement {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}

interface HastParent {
  children?: HastNode[];
}

type HastNode = HastParent & { type: string };

/** Starlight's four aside names, in the package's own tone vocabulary. */
const ASIDE_TONES = {
  note: 'note',
  tip: 'tip',
  caution: 'warning',
  danger: 'critical',
} as const satisfies Record<string, CalloutTone>;

const isElement = (node: HastNode): node is HastElement =>
  node.type === 'element';

function classesOf(node: HastElement): string[] {
  const value = node.properties?.['className'] ?? node.properties?.['class'];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function toneOf(classes: readonly string[]): CalloutTone | undefined {
  if (!classes.includes('starlight-aside')) return undefined;
  for (const [name, tone] of Object.entries(ASIDE_TONES)) {
    if (classes.includes(`starlight-aside--${name}`)) return tone;
  }
  return undefined;
}

const childByClass = (node: HastElement, className: string) =>
  node.children.find(
    (child) => isElement(child) && classesOf(child).includes(className),
  ) as HastElement | undefined;

const element = (
  tagName: string,
  properties: Record<string, unknown>,
  children: HastNode[],
): HastElement => ({ type: 'element', tagName, properties, children });

function iconElement(tone: CalloutTone): HastElement {
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

/**
 * The callout equivalent of one Starlight aside.
 *
 * The title comes from the aside rather than from a table of defaults here:
 * Starlight has already resolved a `:::tip[label]` to its label and an
 * unlabeled directive to the translated default, so reading it back keeps both
 * cases and the site's language right. Its icon is dropped, because the tone
 * picks the package one.
 *
 * The surface classes are restated rather than composed from `Surface.astro`,
 * which cannot be rendered from a rehype transform; they are that component's
 * defaults for `tone="card"` and `padding="4"`.
 */
function calloutElement(aside: HastElement, tone: CalloutTone): HastElement {
  const title = childByClass(aside, 'starlight-aside__title');
  const content = childByClass(aside, 'starlight-aside__content');
  const titleChildren = (title?.children ?? []).filter(
    (child) =>
      !(isElement(child) && classesOf(child).includes('starlight-aside__icon')),
  );

  return element(
    'aside',
    {
      className: [
        'helia-surface',
        'helia-surface--pad-4',
        ...calloutClasses(tone),
      ],
      role: calloutDefinition(tone).role,
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
 * A rewritten aside no longer carries `starlight-aside`, so running this twice
 * over one tree changes nothing the second time.
 */
export function transformAsides(tree: HastNode): void {
  const children = tree.children;
  if (!Array.isArray(children)) return;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    if (!isElement(child)) continue;

    const classes = classesOf(child);
    /* `not-content` is Starlight's mark for markup that is not prose, which
       its own styling steps around; an aside inside one belongs to whoever
       wrote it. */
    if (classes.includes('not-content')) continue;

    const tone = toneOf(classes);
    const next = tone ? calloutElement(child, tone) : child;
    if (tone) children[index] = next;
    /* A rewritten aside is descended into as well: the body of one aside can
       hold another. */
    transformAsides(next);
  }
}

/** The rehype plugin the integration below installs. */
export default function rehypeHeliaCallouts() {
  return transformAsides;
}

/**
 * Installs the transform. It goes through an integration rather than through
 * the Starlight plugin's own `updateConfig`, because `markdown` belongs to
 * Astro's config rather than Starlight's. Astro concatenates arrays when an
 * integration updates config, so a site's own rehype plugins still run.
 */
export function markdownCalloutsIntegration(): AstroIntegration {
  return {
    name: '@ambiqai/helia-ui/starlight:markdown-callouts',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({ markdown: { rehypePlugins: [rehypeHeliaCallouts] } });
      },
    },
  };
}
